import { describe, it, expect } from '@jest/globals';
import {
    validateKey,
    validateNamespace,
    formatDuration,
    formatUptime,
    padWithDots,
    getErrorMessage,
} from '../src/utils.js';

describe('Validation Functions', () => {
    describe('validateKey', () => {
        it('should accept valid keys', () => {
            expect(validateKey('mykey')).toBe(true);
            expect(validateKey('my-key')).toBe(true);
            expect(validateKey('my_key')).toBe(true);
            expect(validateKey('my.key')).toBe(true);
            expect(validateKey('MyKey123')).toBe(true);
        });

        it('should reject keys that are too short', () => {
            expect(validateKey('ab')).toBe(false);
            expect(validateKey('a')).toBe(false);
        });

        it('should reject keys that are too long', () => {
            const longKey = 'a'.repeat(65);
            expect(validateKey(longKey)).toBe(false);
        });

        it('should reject keys with invalid characters', () => {
            expect(validateKey('my key')).toBe(false);
            expect(validateKey('my@key')).toBe(false);
            expect(validateKey('my/key')).toBe(false);
            expect(validateKey('my:key')).toBe(false);
        });
    });

    describe('validateNamespace', () => {
        it('should use the same validation as validateKey', () => {
            expect(validateNamespace('namespace')).toBe(true);
            expect(validateNamespace('ab')).toBe(false);
            expect(validateNamespace('my@namespace')).toBe(false);
        });
    });
});

describe('Formatting Functions', () => {
    describe('formatDuration', () => {
        it('should format negative durations as nanoseconds', () => {
            expect(formatDuration(-0.000000001)).toBe('-1ns');
        });

        it('should format seconds', () => {
            expect(formatDuration(30)).toBe('30s');
            expect(formatDuration(59)).toBe('59s');
        });

        it('should format minutes', () => {
            expect(formatDuration(60)).toBe('1m');
            expect(formatDuration(120)).toBe('2m');
        });

        it('should format hours', () => {
            expect(formatDuration(3600)).toBe('1h');
            expect(formatDuration(7200)).toBe('2h');
        });

        it('should format days', () => {
            expect(formatDuration(86400)).toBe('1d');
            expect(formatDuration(172800)).toBe('2d');
        });

        it('should format years', () => {
            expect(formatDuration(31536000)).toBe('1y');
            expect(formatDuration(63072000)).toBe('2y');
        });
    });

    describe('formatUptime', () => {
        it('should format uptime correctly', () => {
            expect(formatUptime(0)).toBe('0h0m0s');
            expect(formatUptime(61)).toBe('0h1m1s');
            expect(formatUptime(3661)).toBe('1h1m1s');
            expect(formatUptime(7322)).toBe('2h2m2s');
        });
    });

    describe('padWithDots', () => {
        it('should not pad strings with 3 or more characters', () => {
            expect(padWithDots('abc')).toBe('abc');
            expect(padWithDots('abcd')).toBe('abcd');
        });

        it('should pad strings with less than 3 characters', () => {
            expect(padWithDots('a')).toBe('..a');
            expect(padWithDots('ab')).toBe('.ab');
        });

        it('should handle empty strings', () => {
            expect(padWithDots('')).toBe('...');
        });
    });
});

describe('Error Handling', () => {
    describe('getErrorMessage', () => {
        it('should extract message from Error objects', () => {
            const error = new Error('Test error');
            expect(getErrorMessage(error)).toBe('Test error');
        });

        it('should return string errors as-is', () => {
            expect(getErrorMessage('String error')).toBe('String error');
        });

        it('should return default message for unknown error types', () => {
            expect(getErrorMessage(null)).toBe('Internal server error');
            expect(getErrorMessage(undefined)).toBe('Internal server error');
            expect(getErrorMessage(123)).toBe('Internal server error');
            expect(getErrorMessage({})).toBe('Internal server error');
        });
    });
});
