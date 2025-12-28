import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { statsRoutes } from './routes/stats.routes.js';
import { counterRoutes } from './routes/counter.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { checkRedisConnection } from './redis.js';
import { getErrorMessage } from './utils.js';
import {
    DEV_PORT,
    LOG_LEVEL_DEV,
    LOG_LEVEL_PROD,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW,
    BODY_SIZE_LIMIT,
} from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
    logger: {
        level: config.server.port === DEV_PORT ? LOG_LEVEL_DEV : LOG_LEVEL_PROD,
    },
    bodyLimit: BODY_SIZE_LIMIT,
});

// Register CORS
await fastify.register(cors, {
    origin: true, // Allow all origins
    credentials: true,
});

// Register static file serving
await fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'public'),
    prefix: '/public/',
});

// Register rate limiting
await fastify.register(rateLimit, {
    max: RATE_LIMIT_MAX_REQUESTS,
    timeWindow: RATE_LIMIT_WINDOW,
    addHeadersOnExceeding: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
    },
    addHeaders: {
        'x-ratelimit-limit': true,
        'x-ratelimit-remaining': true,
        'x-ratelimit-reset': true,
    },
    errorResponseBuilder: (_request, context) => {
        const retryAfter = Math.ceil(context.ttl / 1000);
        return {
            error: `Too many requests. Try again in ${retryAfter}s`,
        };
    },
});

// Add RateLimit-Policy header to all responses
fastify.addHook('onSend', async (_request, reply) => {
    reply.header('RateLimit-Policy', `${RATE_LIMIT_MAX_REQUESTS};w=10`);

    // Map x-ratelimit-* to RateLimit-* (Fastify uses x- prefix)
    const remaining = reply.getHeader('x-ratelimit-remaining');
    const reset = reply.getHeader('x-ratelimit-reset');

    if (remaining !== undefined) {
        reply.header('RateLimit-Remaining', remaining);
    }
    if (reset !== undefined) {
        reply.header('RateLimit-Reset', reset);
    }
});

// Root route - serve documentation
fastify.get('/', async (_request, reply) => {
    return reply.sendFile('index.html');
});

// Register routes
await fastify.register(statsRoutes);
await fastify.register(counterRoutes);
await fastify.register(adminRoutes);

// Global error handler
fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);

    const message = getErrorMessage(error);

    reply.status(500).send({
        error: message,
    });
});

// Start server
const start = async () => {
    try {
        // Check Redis connection before starting
        const redisHealthy = await checkRedisConnection();
        if (!redisHealthy) {
            console.error('❌ Failed to connect to Redis. Please check your UPSTASH credentials.');
            process.exit(1);
        }
        console.log('✅ Redis connection established');

        await fastify.listen({
            port: config.server.port,
            host: config.server.host,
        });

        console.log(`🚀 Server listening on http://${config.server.host}:${config.server.port}`);
        console.log(`📊 API Version: ${config.api.version}`);
        console.log(`🔧 Shard: ${config.api.shardName}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
