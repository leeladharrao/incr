import type { FastifyRequest, FastifyReply } from 'fastify';

// Validation regex for keys and namespaces
export const KEY_REGEX = /^[A-Za-z0-9_.-]{3,64}$/;

// Reserved words that get replaced server-side
export const RESERVED_WORDS = [':HOST:', ':PATH:'];

export function validateKey(key: string): boolean {
    return KEY_REGEX.test(key);
}

export function validateNamespace(namespace: string): boolean {
    return KEY_REGEX.test(namespace);
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

// Send JSONP response if callback is provided, otherwise send JSON
export function sendResponse(
    reply: FastifyReply,
    data: any,
    callback?: string
): FastifyReply {
    if (callback) {
        // JSONP response
        const jsonpResponse = `${callback}(${JSON.stringify(data)})`;
        return reply
            .type('application/javascript')
            .send(jsonpResponse);
    }

    // Regular JSON response
    return reply.send(data);
}

