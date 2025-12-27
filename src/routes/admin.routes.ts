import type { FastifyInstance } from 'fastify';
import { counterService } from '../services/counter.service.js';
import { authMiddleware } from '../middleware/auth.js';

export async function adminRoutes(fastify: FastifyInstance) {
    // POST /delete/:namespace/:key - Delete counter
    fastify.post('/delete/:namespace/:key', {
        preHandler: authMiddleware,
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
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });

    // POST /set/:namespace/:key - Set counter value
    fastify.post('/set/:namespace/:key', {
        preHandler: authMiddleware,
    }, async (request, reply) => {
        const { namespace, key } = request.params as { namespace: string; key: string };
        const { value } = request.query as { value?: string };
        const adminKey = request.adminKey!;

        if (!value) {
            return reply.status(400).send({ error: 'Missing value query parameter' });
        }

        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) {
            return reply.status(400).send({ error: 'Invalid value parameter' });
        }

        try {
            const newValue = await counterService.set(namespace, key, numValue, adminKey);
            return { value: newValue };
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('admin key')) {
                    return reply.status(403).send({ error: error.message });
                }
                if (error.message.includes('does not exist')) {
                    return reply.status(404).send({ error: error.message });
                }
            }
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });

    // POST /reset/:namespace/:key - Reset counter to 0
    fastify.post('/reset/:namespace/:key', {
        preHandler: authMiddleware,
    }, async (request, reply) => {
        const { namespace, key } = request.params as { namespace: string; key: string };
        const adminKey = request.adminKey!;

        try {
            const value = await counterService.reset(namespace, key, adminKey);
            return { value };
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('admin key')) {
                    return reply.status(403).send({ error: error.message });
                }
                if (error.message.includes('does not exist')) {
                    return reply.status(404).send({ error: 'Key doesnot exist, please use a different key.' });
                }
            }
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });

    // POST /update/:namespace/:key - Update counter by amount
    fastify.post('/update/:namespace/:key', {
        preHandler: authMiddleware,
    }, async (request, reply) => {
        const { namespace, key } = request.params as { namespace: string; key: string };
        const { value } = request.query as { value?: string };
        const adminKey = request.adminKey!;

        if (!value) {
            return reply.status(400).send({ error: 'Missing value query parameter' });
        }

        const amount = parseInt(value, 10);
        if (isNaN(amount)) {
            return reply.status(400).send({ error: 'Invalid value parameter' });
        }

        try {
            const newValue = await counterService.update(namespace, key, amount, adminKey);
            return { value: newValue };
        } catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('admin key')) {
                    return reply.status(403).send({ error: error.message });
                }
                if (error.message.includes('does not exist')) {
                    return reply.status(404).send({ error: error.message });
                }
            }
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });
}
