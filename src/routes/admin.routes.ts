import type { FastifyInstance } from 'fastify';
import { counterService } from '../services/counter.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { CounterParamsSchema, getErrorMessage } from '../utils.js';

const ValueQuerySchema = {
    type: 'object',
    required: ['value'],
    properties: {
        value: { type: 'string', pattern: '^-?[0-9]+$' },
    },
};

export async function adminRoutes(fastify: FastifyInstance) {
    // POST /delete/:namespace/:key - Delete counter
    fastify.post('/delete/:namespace/:key', {
        preHandler: authMiddleware,
        schema: {
            params: CounterParamsSchema,
        },
    }, async (request, reply) => {
        const { namespace, key } = request.params as { namespace: string; key: string };
        const adminKey = request.adminKey!;

        try {
            await counterService.delete(namespace, key, adminKey);
            return {
                status: 'ok',
                message: `Deleted key: ${namespace}:${key}`,
            };
        } catch (error) {
            if (error instanceof Error && error.message.includes('admin key')) {
                return reply.status(403).send({ error: error.message });
            }
            return reply.status(500).send({
                error: getErrorMessage(error),
            });
        }
    });

    // POST /set/:namespace/:key - Set counter value
    fastify.post('/set/:namespace/:key', {
        preHandler: authMiddleware,
        schema: {
            params: CounterParamsSchema,
            querystring: ValueQuerySchema,
        },
    }, async (request, reply) => {
        const { namespace, key } = request.params as { namespace: string; key: string };
        const { value } = request.query as { value: string };
        const adminKey = request.adminKey!;

        const numValue = parseInt(value, 10);
        // Schema guarantees pattern, but parseInt is still safe.

        try {
            const newValue = await counterService.set(namespace, key, numValue, adminKey);
            return { value: newValue };
        } catch (error) {
            const message = getErrorMessage(error);
            if (message.includes('admin key')) {
                return reply.status(403).send({ error: message });
            }
            if (message.includes('does not exist')) {
                return reply.status(404).send({ error: message });
            }
            return reply.status(500).send({ error: message });
        }
    });

    // POST /reset/:namespace/:key - Reset counter to 0
    fastify.post('/reset/:namespace/:key', {
        preHandler: authMiddleware,
        schema: {
            params: CounterParamsSchema,
        },
    }, async (request, reply) => {
        const { namespace, key } = request.params as { namespace: string; key: string };
        const adminKey = request.adminKey!;

        try {
            const value = await counterService.reset(namespace, key, adminKey);
            return { value };
        } catch (error) {
            const message = getErrorMessage(error);
            if (message.includes('admin key')) {
                return reply.status(403).send({ error: message });
            }
            if (message.includes('does not exist')) {
                return reply.status(404).send({ error: 'Key does not exist, please use a different key.' });
            }
            return reply.status(500).send({ error: message });
        }
    });

    // POST /update/:namespace/:key - Update counter by amount
    fastify.post('/update/:namespace/:key', {
        preHandler: authMiddleware,
        schema: {
            params: CounterParamsSchema,
            querystring: ValueQuerySchema,
        },
    }, async (request, reply) => {
        const { namespace, key } = request.params as { namespace: string; key: string };
        const { value } = request.query as { value: string };
        const adminKey = request.adminKey!;

        const amount = parseInt(value, 10);

        try {
            const newValue = await counterService.update(namespace, key, amount, adminKey);
            return { value: newValue };
        } catch (error) {
            const message = getErrorMessage(error);
            if (message.includes('admin key')) {
                return reply.status(403).send({ error: message });
            }
            if (message.includes('does not exist')) {
                return reply.status(404).send({ error: message });
            }
            return reply.status(500).send({ error: message });
        }
    });
}
