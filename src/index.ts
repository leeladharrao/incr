import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config.js';
import { statsRoutes } from './routes/stats.routes.js';
import { counterRoutes } from './routes/counter.routes.js';
import { adminRoutes } from './routes/admin.routes.js';

const fastify = Fastify({
    logger: {
        level: config.server.port === 3000 ? 'info' : 'warn',
    },
});

// Register CORS
await fastify.register(cors, {
    origin: true, // Allow all origins
    credentials: true,
});

// Register rate limiting
await fastify.register(rateLimit, {
    max: 30, // 30 requests
    timeWindow: '10 seconds', // per 10 seconds
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
    reply.header('RateLimit-Policy', '30;w=10');

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

// Register routes
await fastify.register(statsRoutes);
await fastify.register(counterRoutes);
await fastify.register(adminRoutes);

// Global error handler
fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);

    const message =
        error instanceof Error
            ? error.message
            : typeof error === 'string'
            ? error
            : 'Internal server error';

    reply.status(500).send({
        error: message,
    });
});

// Start server
const start = async () => {
    try {
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
