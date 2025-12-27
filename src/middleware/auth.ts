import type { FastifyRequest, FastifyReply } from 'fastify';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
            error: 'Missing or invalid Authorization header. Expected: Bearer YOUR_ADMIN_KEY',
        });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
        return reply.status(401).send({
            error: 'Admin key is required',
        });
    }

    // Store the admin key in request context for use in handlers
    request.adminKey = token;
}

// Extend FastifyRequest type to include adminKey
declare module 'fastify' {
    interface FastifyRequest {
        adminKey?: string;
    }
}
