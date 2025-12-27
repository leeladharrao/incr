import { Redis } from '@upstash/redis';
import { config } from './config.js';

export const redis = new Redis({
    url: config.upstash.url,
    token: config.upstash.token,
});

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

// Default expiration: 6 months in seconds
export const DEFAULT_EXPIRATION = 60 * 60 * 24 * 180; // 180 days
