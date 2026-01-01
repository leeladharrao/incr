import type { FastifyRequest, FastifyReply } from 'fastify';
import { CALLBACK_REGEX } from './constants.js';

/**
 * Extract a user-friendly error message from an unknown error type.
 * @param error - The error to extract a message from
 * @returns A string error message
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Internal server error';
}

/**
 * Parse a string into an integer with a default fallback.
 * @param value - The string value to parse
 * @param defaultValue - The default value if parsing fails or value is undefined
 * @returns The parsed integer or default value
 */
export function parseInteger(value: string | undefined, defaultValue: number): number {
    if (value === undefined || value === '') {
        return defaultValue;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        return defaultValue;
    }
    return parsed;
}

// Schema patterns

const KEY_PATTERN = '^[A-Za-z0-9_.-]{3,64}$';
const CALLBACK_PATTERN = '^[a-zA-Z_$][a-zA-Z0-9_$.[\\]]*$';

export const CounterParamsSchema = {
    type: 'object',
    required: ['namespace', 'key'],
    properties: {
        namespace: { type: 'string', pattern: KEY_PATTERN },
        key: { type: 'string', pattern: KEY_PATTERN },
    },
};

export const CounterKeyParamsSchema = {
    type: 'object',
    required: ['key'],
    properties: {
        key: { type: 'string', pattern: KEY_PATTERN },
    },
};

export const CallbackQuerySchema = {
    type: 'object',
    properties: {
        callback: { type: 'string', pattern: CALLBACK_PATTERN },
    },
};

export const InitializerQuerySchema = {
    type: 'object',
    properties: {
        initializer: { type: 'string', pattern: '^[0-9]+$' },
    },
};

// ... keep existing functions but remove validateKey and validateNamespace if no longer needed, 
// OR keep them for service-level validation if we want double safety. 
// For now I will keep them but maybe reimplement them using the regex constants to avoid duplication.

export function validateKey(key: string): boolean {
    return new RegExp(KEY_PATTERN).test(key);
}

export function validateNamespace(namespace: string): boolean {
    return new RegExp(KEY_PATTERN).test(namespace);
}

export function formatDuration(seconds: number): string {
    if (seconds < 0) {
        const ns = Math.abs(seconds * 1e9);
        return `-${ns.toFixed(0)}ns`;
    }

    const units = [
        { label: 'y', value: 365 * 24 * 60 * 60 },
        { label: 'd', value: 24 * 60 * 60 },
        { label: 'h', value: 60 * 60 },
        { label: 'm', value: 60 },
        { label: 's', value: 1 },
    ];

    for (const unit of units) {
        if (seconds >= unit.value) {
            const value = Math.floor(seconds / unit.value);
            return `${value}${unit.label}`;
        }
    }

    return `${seconds}s`;
}

export function formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hours}h${minutes}m${secs}s`;
}

// Extract hostname from request
export function extractHost(request: FastifyRequest): string {
    // Try to get from Referer header first
    let referer = request.headers.referer || request.headers.referrer;
    if (Array.isArray(referer)) {
        referer = referer[0];
    }

    if (referer) {
        try {
            const url = new URL(referer);
            return url.hostname;
        } catch {
            // Invalid URL, fall through
        }
    }

    // Fall back to Host header
    const host = request.headers.host;
    if (host) {
        // Remove port if present
        return host.split(':')[0];
    }

    return 'localhost';
}

// Extract path from request
export function extractPath(request: FastifyRequest): string {
    // Try to get from Referer header
    let referer = request.headers.referer || request.headers.referrer;
    if (Array.isArray(referer)) {
        referer = referer[0];
    }

    if (referer) {
        try {
            const url = new URL(referer);
            // Remove leading slash and replace remaining slashes with empty string
            const path = url.pathname.slice(1).replace(/\//g, '');
            return path || 'index';
        } catch {
            // Invalid URL
        }
    }

    return 'index';
}

// Pad string with dots if length < 3
export function padWithDots(str: string): string {
    if (str.length >= 3) {
        return str;
    }
    return str.padStart(3, '.');
}

// Replace reserved words in a string
export function replaceReservedWords(str: string, request: FastifyRequest): string {
    let result = str;

    if (result.includes(':HOST:')) {
        const host = extractHost(request);
        result = result.replace(':HOST:', padWithDots(host));
    }

    if (result.includes(':PATH:')) {
        const path = extractPath(request);
        result = result.replace(':PATH:', padWithDots(path));
    }

    return result;
}

/**
 * Send JSONP response if callback is provided, otherwise send JSON.
 * Validates callback name to prevent XSS attacks.
 * @param reply - Fastify reply object
 * @param data - Data to send in response
 * @param callback - Optional JSONP callback function name
 * @returns Fastify reply
 * @throws {Error} If callback name is invalid
 */
export function sendResponse<T>(
    reply: FastifyReply,
    data: T,
    callback?: string
): FastifyReply {
    if (callback) {
        // Validate callback name to prevent XSS attacks
        if (!CALLBACK_REGEX.test(callback)) {
            throw new Error('Invalid callback name');
        }

        // JSONP response
        const jsonpResponse = `${callback}(${JSON.stringify(data)})`;
        return reply
            .type('application/javascript')
            .send(jsonpResponse);
    }

    // Regular JSON response
    return reply.send(data);
}

