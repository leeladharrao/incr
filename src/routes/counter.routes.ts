import type { FastifyInstance } from 'fastify';
import { counterService } from '../services/counter.service.js';
import { replaceReservedWords, sendResponse } from '../utils.js';

export async function counterRoutes(fastify: FastifyInstance) {
    // GET /get/:namespace/:key - Get counter value
    fastify.get('/get/:namespace/:key', async (request, reply) => {
        let { namespace, key } = request.params as { namespace: string; key: string };
        const { callback } = request.query as { callback?: string };

        // Replace reserved words
        namespace = replaceReservedWords(namespace, request);
        key = replaceReservedWords(key, request);

        try {
            const value = await counterService.get(namespace, key);

            if (value === null) {
                return reply.status(404).send({ error: 'Key not found' });
            }

            // Track stats
            await counterService['incrementStat']('get');

            return sendResponse(reply, { value }, callback);
        } catch (error) {
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });

    // GET /get/:key - Get counter value (default namespace)
    fastify.get('/get/:key', async (request, reply) => {
        let { key } = request.params as { key: string };
        const { callback } = request.query as { callback?: string };

        // Replace reserved words
        key = replaceReservedWords(key, request);

        try {
            const value = await counterService.get('default', key);

            if (value === null) {
                return reply.status(404).send({ error: 'Key not found' });
            }

            // Track stats
            await counterService['incrementStat']('get');

            return sendResponse(reply, { value }, callback);
        } catch (error) {
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });

    // GET /hit/:namespace/:key - Increment counter
    fastify.get('/hit/:namespace/:key', async (request, reply) => {
        let { namespace, key } = request.params as { namespace: string; key: string };
        const { callback } = request.query as { callback?: string };

        // Replace reserved words
        namespace = replaceReservedWords(namespace, request);
        key = replaceReservedWords(key, request);

        try {
            const value = await counterService.hit(namespace, key);
            return sendResponse(reply, { value }, callback);
        } catch (error) {
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });

    // GET /hit/:key - Increment counter (default namespace)
    fastify.get('/hit/:key', async (request, reply) => {
        let { key } = request.params as { key: string };
        const { callback } = request.query as { callback?: string };

        // Replace reserved words
        key = replaceReservedWords(key, request);

        try {
            const value = await counterService.hit('default', key);
            return sendResponse(reply, { value }, callback);
        } catch (error) {
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });

    // GET /info/:namespace/:key - Get counter info
    fastify.get('/info/:namespace/:key', async (request, reply) => {
        let { namespace, key } = request.params as { namespace: string; key: string };

        // Replace reserved words
        namespace = replaceReservedWords(namespace, request);
        key = replaceReservedWords(key, request);

        try {
            const info = await counterService.info(namespace, key);

            if (!info.exists) {
                return reply.status(404).send(info);
            }

            return info;
        } catch (error) {
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });

    // GET /info/:key - Get counter info (default namespace)
    fastify.get('/info/:key', async (request, reply) => {
        let { key } = request.params as { key: string };

        // Replace reserved words
        key = replaceReservedWords(key, request);

        try {
            const info = await counterService.info('default', key);

            if (!info.exists) {
                return reply.status(404).send(info);
            }

            return info;
        } catch (error) {
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });

    // GET /create/:namespace/:key - Create counter with namespace and key
    fastify.get('/create/:namespace/:key', async (request, reply) => {
        let { namespace, key } = request.params as { namespace: string; key: string };
        const { initializer } = request.query as { initializer?: string };

        // Replace reserved words
        namespace = replaceReservedWords(namespace, request);
        key = replaceReservedWords(key, request);

        try {
            const initialValue = initializer ? parseInt(initializer, 10) : 0;

            if (isNaN(initialValue)) {
                return reply.status(400).send({ error: 'Invalid initializer value' });
            }

            const result = await counterService.create(namespace, key, initialValue);
            return reply.status(201).send(result);
        } catch (error) {
            if (error instanceof Error && error.message.includes('already exists')) {
                return reply.status(409).send({ error: error.message });
            }
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });

    // GET /create - Create counter with random namespace and key
    fastify.get('/create', async (request, reply) => {
        const { initializer } = request.query as { initializer?: string };

        try {
            const initialValue = initializer ? parseInt(initializer, 10) : 0;

            if (isNaN(initialValue)) {
                return reply.status(400).send({ error: 'Invalid initializer value' });
            }

            const result = await counterService.createRandom(initialValue);
            return reply.status(201).send(result);
        } catch (error) {
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });
}
