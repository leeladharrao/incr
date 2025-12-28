import { describe, it, expect } from '@jest/globals';
import {
    KEY_REGEX,
    CALLBACK_REGEX,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW,
    DEFAULT_EXPIRATION_DAYS,
    DEFAULT_EXPIRATION,
} from '../src/constants.js';

describe('Constants', () => {
    describe('Validation Patterns', () => {
        it('should have valid KEY_REGEX pattern', () => {
            expect(KEY_REGEX.test('valid-key')).toBe(true);
            expect(KEY_REGEX.test('ab')).toBe(false); // too short
        });

        it('should have valid CALLBACK_REGEX pattern', () => {
            expect(CALLBACK_REGEX.test('validCallback')).toBe(true);
            expect(CALLBACK_REGEX.test('123invalid')).toBe(false); // starts with number
        });
    });

    describe('Rate Limiting', () => {
        it('should have positive rate limit values', () => {
            expect(RATE_LIMIT_MAX_REQUESTS).toBeGreaterThan(0);
            expect(typeof RATE_LIMIT_WINDOW).toBe('string');
        });
    });

    describe('Expiration', () => {
        it('should calculate expiration correctly', () => {
            const expectedSeconds = 60 * 60 * 24 * DEFAULT_EXPIRATION_DAYS;
            expect(DEFAULT_EXPIRATION).toBe(expectedSeconds);
        });

        it('should have reasonable expiration period', () => {
            expect(DEFAULT_EXPIRATION_DAYS).toBeGreaterThan(0);
            expect(DEFAULT_EXPIRATION_DAYS).toBeLessThanOrEqual(365);
        });
    });
});
