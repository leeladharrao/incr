import type { FastifyInstance } from 'fastify';
import { redis } from '../redis.js';
import { formatUptime } from '../utils.js';
import { config } from '../config.js';

const startTime = Date.now();

export async function statsRoutes(fastify: FastifyInstance) {
    // Health check endpoint
    fastify.get('/healthcheck', async () => {
        const uptime = Math.floor((Date.now() - startTime) / 1000);

        return {
            status: 'ok',
            uptime: formatUptime(uptime),
        };
    });

    // Stats endpoint
    fastify.get('/stats', async (_request, reply) => {
        try {
            const uptime = Math.floor((Date.now() - startTime) / 1000);

            // Get command stats
            const [createCount, getCount, hitCount, totalCount] = await Promise.all([
                redis.get<number>('S:commands:create') || 0,
                redis.get<number>('S:commands:get') || 0,
                redis.get<number>('S:commands:hit') || 0,
                redis.get<number>('S:commands:total') || 0,
            ]);

            // Get total keys (approximate - count keys with K: prefix)
            const keys = await redis.keys('K:*');
            const totalKeys = keys.length;

            return {
                commands: {
                    create: createCount,
                    get: getCount,
                    hit: hitCount,
                    total: totalCount,
                },
                total_keys: totalKeys,
                version: config.api.version,
                shard: config.api.shardName,
                uptime: formatUptime(uptime),
            };
        } catch (error) {
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Failed to fetch stats',
            });
        }
    });

    // Docs redirect
    fastify.get('/docs', async (_request, reply) => {
        return reply.redirect('https://github.com/leeladharrao/incr');
    });
}
