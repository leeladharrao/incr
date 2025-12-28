import { describe, it, expect } from '@jest/globals';
import { buildKey, buildAdminKey } from '../src/redis.js';
import { KEY_PREFIX, ADMIN_PREFIX } from '../src/redis.js';

describe('Redis Key Building', () => {
    describe('buildKey', () => {
        it('should build counter keys with correct prefix', () => {
            expect(buildKey('namespace', 'key')).toBe(`${KEY_PREFIX}namespace:key`);
            expect(buildKey('myapp', 'visits')).toBe(`${KEY_PREFIX}myapp:visits`);
        });

        it('should handle default namespace', () => {
            expect(buildKey('default', 'counter')).toBe(`${KEY_PREFIX}default:counter`);
        });
    });

    describe('buildAdminKey', () => {
        it('should build admin keys with correct prefix', () => {
            expect(buildAdminKey('namespace', 'key')).toBe(`${ADMIN_PREFIX}namespace:key`);
            expect(buildAdminKey('myapp', 'visits')).toBe(`${ADMIN_PREFIX}myapp:visits`);
        });
    });

    describe('Key Prefixes', () => {
        it('should have distinct prefixes', () => {
            expect(KEY_PREFIX).not.toBe(ADMIN_PREFIX);
        });

        it('should ensure counter and admin keys are different', () => {
            const counterKey = buildKey('test', 'key');
            const adminKey = buildAdminKey('test', 'key');
            expect(counterKey).not.toBe(adminKey);
        });
    });
});
