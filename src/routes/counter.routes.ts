import type { FastifyInstance, FastifyRequest } from 'fastify';
import { counterService } from '../services/counter.service.js';
import {
    replaceReservedWords,
    sendResponse,
    getErrorMessage,
    CounterParamsSchema,
    CounterKeyParamsSchema,
    CallbackQuerySchema,
    InitializerQuerySchema
} from '../utils.js';
import { DEFAULT_NAMESPACE } from '../constants.js';

// Pre-validation hook to replace reserved words
const replaceWordsHook = async (request: FastifyRequest) => {
    const params = request.params as { namespace?: string; key?: string };
    if (params.namespace) {
        params.namespace = replaceReservedWords(params.namespace, request);
    }
    if (params.key) {
        params.key = replaceReservedWords(params.key, request);
    }
};

export async function counterRoutes(fastify: FastifyInstance) {
    // GET /get/:namespace/:key
    fastify.get('/get/:namespace/:key', {
        schema: {
            params: CounterParamsSchema,
            querystring: CallbackQuerySchema,
        },
        preValidation: replaceWordsHook,
    }, async (request, reply) => {
        // Validation handled by schema
        const { namespace, key } = request.params as { namespace: string; key: string };
        const { callback } = request.query as { callback?: string };

        try {
            const value = await counterService.get(namespace, key);
            if (value === null) {
                return reply.status(404).send({ error: 'Key not found' });
            }
            // Track stats
            await counterService.incrementStat('get');
            return sendResponse(reply, { value }, callback);
        } catch (error) {
            return reply.status(500).send({ error: getErrorMessage(error) });
        }
    });

    // GET /get/:key
    fastify.get('/get/:key', {
        schema: {
            params: CounterKeyParamsSchema,
            querystring: CallbackQuerySchema,
        },
        preValidation: replaceWordsHook,
    }, async (request, reply) => {
        const { key } = request.params as { key: string };
        const { callback } = request.query as { callback?: string };

        // Use defaults
        const namespace = DEFAULT_NAMESPACE;

        try {
            const value = await counterService.get(namespace, key);
            if (value === null) {
                return reply.status(404).send({ error: 'Key not found' });
            }
            await counterService.incrementStat('get');
            return sendResponse(reply, { value }, callback);
        } catch (error) {
            return reply.status(500).send({ error: getErrorMessage(error) });
        }
    });

    // GET /hit/:namespace/:key
    fastify.get('/hit/:namespace/:key', {
        schema: {
            params: CounterParamsSchema,
            querystring: CallbackQuerySchema,
        },
        preValidation: replaceWordsHook,
    }, async (request, reply) => {
        const { namespace, key } = request.params as { namespace: string; key: string };
        const { callback } = request.query as { callback?: string };

        try {
            const value = await counterService.hit(namespace, key);
            return sendResponse(reply, { value }, callback);
        } catch (error) {
            return reply.status(500).send({ error: getErrorMessage(error) });
        }
    });

    // GET /hit/:key
    fastify.get('/hit/:key', {
        schema: {
            params: CounterKeyParamsSchema,
            querystring: CallbackQuerySchema,
        },
        preValidation: replaceWordsHook,
    }, async (request, reply) => {
        const { key } = request.params as { key: string };
        const { callback } = request.query as { callback?: string };
        const namespace = DEFAULT_NAMESPACE;

        try {
            const value = await counterService.hit(namespace, key);
            return sendResponse(reply, { value }, callback);
        } catch (error) {
            return reply.status(500).send({ error: getErrorMessage(error) });
        }
    });

    // GET /info/:namespace/:key
    fastify.get('/info/:namespace/:key', {
        schema: {
            params: CounterParamsSchema,
        },
        preValidation: replaceWordsHook,
    }, async (request, reply) => {
        const { namespace, key } = request.params as { namespace: string; key: string };

        try {
            const info = await counterService.info(namespace, key);
            if (!info.exists) {
                return reply.status(404).send(info);
            }
            return info;
        } catch (error) {
            return reply.status(500).send({ error: getErrorMessage(error) });
        }
    });

    // GET /info/:key
    fastify.get('/info/:key', {
        schema: {
            params: CounterKeyParamsSchema,
        },
        preValidation: replaceWordsHook,
    }, async (request, reply) => {
        const { key } = request.params as { key: string };
        const namespace = DEFAULT_NAMESPACE;

        try {
            const info = await counterService.info(namespace, key);
            if (!info.exists) {
                return reply.status(404).send(info);
            }
            return info;
        } catch (error) {
            return reply.status(500).send({ error: getErrorMessage(error) });
        }
    });

    // GET /create/:namespace/:key
    fastify.get('/create/:namespace/:key', {
        schema: {
            params: CounterParamsSchema,
            querystring: InitializerQuerySchema,
        },
        preValidation: replaceWordsHook,
    }, async (request, reply) => {
        const { namespace, key } = request.params as { namespace: string; key: string };
        const { initializer } = request.query as { initializer?: string };

        try {
            const initialValue = initializer ? parseInt(initializer, 10) : 0;
            // initializer checked by schema pattern but parseInt is good to keep or cast

            const result = await counterService.create(namespace, key, initialValue);
            return reply.status(201).send(result);
        } catch (error) {
            if (error instanceof Error && error.message.includes('already exists')) {
                return reply.status(409).send({ error: error.message });
            }
            return reply.status(500).send({ error: getErrorMessage(error) });
        }
    });

    // GET /create
    fastify.get('/create', {
        schema: {
            querystring: InitializerQuerySchema,
        },
    }, async (request, reply) => {
        const { initializer } = request.query as { initializer?: string };

        try {
            const initialValue = initializer ? parseInt(initializer, 10) : 0;
            const result = await counterService.createRandom(initialValue);
            return reply.status(201).send(result);
        } catch (error) {
            return reply.status(500).send({ error: getErrorMessage(error) });
        }
    });
}

