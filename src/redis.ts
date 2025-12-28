import { Redis } from '@upstash/redis';
import { config } from './config.js';
import { DEFAULT_EXPIRATION } from './constants.js';

export const redis = new Redis({
    url: config.upstash.url,
    token: config.upstash.token,
});

/**
 * Check if Redis connection is healthy
 * @returns Promise<boolean> - true if connection is healthy
 */
export async function checkRedisConnection(): Promise<boolean> {
    try {
        await redis.ping();
        return true;
    } catch (error) {
        console.error('Redis connection failed:', error);
        return false;
    }
}

// Key prefixes for organization
export const KEY_PREFIX = 'K:'; // Counter keys
export const ADMIN_PREFIX = 'A:'; // Admin keys
export const STATS_PREFIX = 'S:'; // Stats keys

// Build full key with namespace
export function buildKey(namespace: string, key: string): string {
    return `${KEY_PREFIX}${namespace}:${key}`;
}

// Build admin key reference
export function buildAdminKey(namespace: string, key: string): string {
    return `${ADMIN_PREFIX}${namespace}:${key}`;
}

// Re-export DEFAULT_EXPIRATION for use in other modules
export { DEFAULT_EXPIRATION };
