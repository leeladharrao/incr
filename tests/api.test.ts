import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { statsRoutes } from '../src/routes/stats.routes.js';
import { counterRoutes } from '../src/routes/counter.routes.js';
import { adminRoutes } from '../src/routes/admin.routes.js';
import { redis, KEY_PREFIX, ADMIN_PREFIX } from '../src/redis.js';

/**
 * API Integration Tests
 * 
 * All test data uses the "TEST_" prefix for namespaces and keys
 * to make it easy to identify and clean up test data in Redis.
 * 
 * Test data patterns:
 * - Namespace: TEST_namespace_*
 * - Key: TEST_key_*
 * 
 * This allows filtering and cleanup with Redis SCAN command:
 * SCAN 0 MATCH K:TEST_* or A:TEST_*
 */

describe('API Integration Tests', () => {
    let app: FastifyInstance;
    const TEST_NAMESPACE = 'TEST_namespace_api';
    const TEST_KEY = 'TEST_key_counter';

    const cleanupTestData = async () => {
        let cursor = '0';
        do {
            const result = await redis.scan(cursor, { match: '*:TEST_*', count: 100 });
            cursor = result[0];
            const keys = result[1];

            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== '0');
    };

    beforeAll(async () => {
        await cleanupTestData();
        // Create Fastify instance with same config as main app
        app = Fastify({
            logger: false,
        });

        // Register plugins
        await app.register(cors, {
            origin: true,
            credentials: true,
        });

        await app.register(rateLimit, {
            max: 100, // Higher limit for tests
            timeWindow: '1 minute',
        });

        // Register routes
        await app.register(statsRoutes);
        await app.register(counterRoutes);
        await app.register(adminRoutes);

        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    describe('Health & Stats Endpoints', () => {
        describe('GET /healthcheck', () => {
            it('should return health status', async () => {
                const response = await app.inject({
                    method: 'GET',
                    url: '/healthcheck',
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('status', 'ok');
                expect(body).toHaveProperty('uptime');
            });
        });

        describe('GET /stats', () => {
            it('should return API statistics', async () => {
                const response = await app.inject({
                    method: 'GET',
                    url: '/stats',
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('commands');
                expect(body.commands).toHaveProperty('create');
                expect(body.commands).toHaveProperty('get');
                expect(body.commands).toHaveProperty('hit');
                expect(body.commands).toHaveProperty('total');
                expect(body).toHaveProperty('total_keys');
                expect(body).toHaveProperty('version');
                expect(body).toHaveProperty('shard');
                expect(body).toHaveProperty('uptime');
            });
        });
    });

    describe('Counter Creation Endpoints', () => {
        describe('GET /create/:namespace/:key', () => {
            it('should create a new counter with default value', async () => {
                const testKey = `${TEST_KEY}_create_default`;
                const response = await app.inject({
                    method: 'GET',
                    url: `/create/${TEST_NAMESPACE}/${testKey}`,
                });

                expect(response.statusCode).toBe(201);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('key', testKey);
                expect(body).toHaveProperty('namespace', TEST_NAMESPACE);
                expect(body).toHaveProperty('admin_key');
                expect(body).toHaveProperty('value', 0);
                expect(body.admin_key).toBeTruthy();
            });

            it('should create a counter with initial value', async () => {
                const testKey = `${TEST_KEY}_create_initial`;
                const response = await app.inject({
                    method: 'GET',
                    url: `/create/${TEST_NAMESPACE}/${testKey}?initializer=100`,
                });

                expect(response.statusCode).toBe(201);
                const body = JSON.parse(response.body);
                expect(body.value).toBe(100);
            });

            it('should return 409 if key already exists', async () => {
                const testKey = `${TEST_KEY}_create_duplicate`;

                // Create first time
                await app.inject({
                    method: 'GET',
                    url: `/create/${TEST_NAMESPACE}/${testKey}`,
                });

                // Try to create again
                const response = await app.inject({
                    method: 'GET',
                    url: `/create/${TEST_NAMESPACE}/${testKey}`,
                });

                expect(response.statusCode).toBe(409);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('error');
                expect(body.error).toContain('already exists');
            });

            it('should reject invalid key format', async () => {
                const response = await app.inject({
                    method: 'GET',
                    url: `/create/${TEST_NAMESPACE}/ab`, // too short
                });

                expect(response.statusCode).toBe(400);
            });
        });

        describe('GET /create', () => {
            let generatedKeys: string[] = [];

            afterEach(async () => {
                if (generatedKeys.length > 0) {
                    await redis.del(...generatedKeys);
                    generatedKeys = [];
                }
            });

            it('should create counter with random namespace and key', async () => {
                const response = await app.inject({
                    method: 'GET',
                    url: '/create',
                });

                expect(response.statusCode).toBe(201);
                const body = JSON.parse(response.body);

                // Track keys for cleanup
                generatedKeys.push(`${KEY_PREFIX}${body.namespace}:${body.key}`);
                generatedKeys.push(`${ADMIN_PREFIX}${body.namespace}:${body.key}`);

                expect(body).toHaveProperty('key');
                expect(body).toHaveProperty('namespace');
                expect(body).toHaveProperty('admin_key');
                expect(body).toHaveProperty('value', 0);
                expect(body.key.length).toBeGreaterThanOrEqual(3);
                expect(body.namespace.length).toBeGreaterThanOrEqual(3);
            });
        });
    });

    describe('Counter Read Endpoints', () => {
        describe('GET /get/:namespace/:key', () => {
            beforeEach(async () => {
                // Create a test counter for read operations
                await app.inject({
                    method: 'GET',
                    url: `/create/${TEST_NAMESPACE}/${TEST_KEY}_read?initializer=42`,
                });
            });
            it('should get existing counter value', async () => {
                const response = await app.inject({
                    method: 'GET',
                    url: `/get/${TEST_NAMESPACE}/${TEST_KEY}_read`,
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value', 42);
            });

            it('should return 404 for non-existent counter', async () => {
                const response = await app.inject({
                    method: 'GET',
                    url: `/get/${TEST_NAMESPACE}/TEST_nonexistent`,
                });

                expect(response.statusCode).toBe(404);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('error');
            });

            it('should support JSONP callback', async () => {
                const response = await app.inject({
                    method: 'GET',
                    url: `/get/${TEST_NAMESPACE}/${TEST_KEY}_read?callback=myCallback`,
                });

                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toContain('application/javascript');
                expect(response.body).toMatch(/^myCallback\(/);
                expect(response.body).toContain('"value":42');
            });
        });

        describe('GET /get/:key', () => {
            it('should get counter from default namespace', async () => {
                // Create in default namespace first
                await app.inject({
                    method: 'GET',
                    url: `/create/default/${TEST_KEY}_default`,
                });

                const response = await app.inject({
                    method: 'GET',
                    url: `/get/${TEST_KEY}_default`,
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value');
            });
        });

        describe('GET /info/:namespace/:key', () => {
            beforeEach(async () => {
                await app.inject({
                    method: 'GET',
                    url: `/create/${TEST_NAMESPACE}/${TEST_KEY}_read?initializer=42`,
                });
            });

            it('should return detailed counter information', async () => {
                const response = await app.inject({
                    method: 'GET',
                    url: `/info/${TEST_NAMESPACE}/${TEST_KEY}_read`,
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value');
                expect(body).toHaveProperty('full_key');
                expect(body).toHaveProperty('is_genuine');
                expect(body).toHaveProperty('expires_in');
                expect(body).toHaveProperty('expires_str');
                expect(body).toHaveProperty('exists', true);
            });

            it('should return info for non-existent key', async () => {
                const response = await app.inject({
                    method: 'GET',
                    url: `/info/${TEST_NAMESPACE}/TEST_nonexistent_info`,
                });

                expect(response.statusCode).toBe(404);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('exists', false);
            });
        });

        describe('GET /info/:key', () => {
            beforeEach(async () => {
                await app.inject({
                    method: 'GET',
                    url: `/create/default/${TEST_KEY}_default`,
                });
            });

            it('should get info from default namespace', async () => {
                const response = await app.inject({
                    method: 'GET',
                    url: `/info/${TEST_KEY}_default`,
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value');
            });
        });
    });

    describe('Counter Increment Endpoints', () => {
        describe('GET /hit/:namespace/:key', () => {
            it('should increment existing counter', async () => {
                const testKey = `${TEST_KEY}_hit`;

                // Create counter
                await app.inject({
                    method: 'GET',
                    url: `/create/${TEST_NAMESPACE}/${testKey}?initializer=10`,
                });

                // Hit it
                const response = await app.inject({
                    method: 'GET',
                    url: `/hit/${TEST_NAMESPACE}/${testKey}`,
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value', 11);
            });

            it('should create counter if it does not exist', async () => {
                const testKey = `${TEST_KEY}_hit_new`;

                const response = await app.inject({
                    method: 'GET',
                    url: `/hit/${TEST_NAMESPACE}/${testKey}`,
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value', 1);
            });

            it('should support JSONP callback', async () => {
                const testKey = `${TEST_KEY}_hit_jsonp`;

                const response = await app.inject({
                    method: 'GET',
                    url: `/hit/${TEST_NAMESPACE}/${testKey}?callback=hitCallback`,
                });

                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toContain('application/javascript');
                expect(response.body).toMatch(/^hitCallback\(/);
            });
        });

        describe('GET /hit/:key', () => {
            it('should increment counter in default namespace', async () => {
                const testKey = `${TEST_KEY}_hit_default`;

                const response = await app.inject({
                    method: 'GET',
                    url: `/hit/${testKey}`,
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value');
            });
        });
    });

    describe('Admin Endpoints', () => {
        let testAdminKey: string;
        const ADMIN_TEST_KEY = `${TEST_KEY}_admin`;

        beforeEach(async () => {
            // Create a counter for admin operations
            const response = await app.inject({
                method: 'GET',
                url: `/create/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}?initializer=50`,
            });
            testAdminKey = JSON.parse(response.body).admin_key;
        });

        describe('POST /delete/:namespace/:key', () => {
            it('should delete counter with valid admin key', async () => {
                const testKey = `${TEST_KEY}_delete`;

                // Create counter
                const createResponse = await app.inject({
                    method: 'GET',
                    url: `/create/${TEST_NAMESPACE}/${testKey}`,
                });
                const { admin_key } = JSON.parse(createResponse.body);

                // Delete it
                const response = await app.inject({
                    method: 'POST',
                    url: `/delete/${TEST_NAMESPACE}/${testKey}`,
                    headers: {
                        authorization: `Bearer ${admin_key}`,
                    },
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('status', 'ok');
                expect(body.message).toContain('Deleted');
            });

            it('should return 403 with invalid admin key', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/delete/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}`,
                    headers: {
                        authorization: 'Bearer invalid_key',
                    },
                });

                expect(response.statusCode).toBe(403);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('error');
            });

            it('should return 401 without authorization header', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/delete/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}`,
                });

                expect(response.statusCode).toBe(401);
            });
        });

        describe('POST /set/:namespace/:key', () => {
            it('should set counter value with valid admin key', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/set/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}?value=100`,
                    headers: {
                        authorization: `Bearer ${testAdminKey}`,
                    },
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value', 100);
            });

            it('should return 400 without value parameter', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/set/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}`,
                    headers: {
                        authorization: `Bearer ${testAdminKey}`,
                    },
                });

                expect(response.statusCode).toBe(400);
            });

            it('should return 403 with invalid admin key', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/set/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}?value=200`,
                    headers: {
                        authorization: 'Bearer invalid_key',
                    },
                });

                expect(response.statusCode).toBe(403);
            });
        });

        describe('POST /reset/:namespace/:key', () => {
            it('should reset counter to 0 with valid admin key', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/reset/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}`,
                    headers: {
                        authorization: `Bearer ${testAdminKey}`,
                    },
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value', 0);
            });

            it('should return 403 with invalid admin key', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/reset/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}`,
                    headers: {
                        authorization: 'Bearer invalid_key',
                    },
                });

                expect(response.statusCode).toBe(403);
            });
        });

        describe('POST /update/:namespace/:key', () => {
            beforeEach(async () => {
                // Reset to known value before each test
                await app.inject({
                    method: 'POST',
                    url: `/set/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}?value=50`,
                    headers: {
                        authorization: `Bearer ${testAdminKey}`,
                    },
                });
            });

            it('should increment counter by positive amount', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/update/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}?value=10`,
                    headers: {
                        authorization: `Bearer ${testAdminKey}`,
                    },
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value', 60);
            });

            it('should decrement counter by negative amount', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/update/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}?value=-5`,
                    headers: {
                        authorization: `Bearer ${testAdminKey}`,
                    },
                });

                expect(response.statusCode).toBe(200);
                const body = JSON.parse(response.body);
                expect(body).toHaveProperty('value', 45);
            });

            it('should return 400 without value parameter', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/update/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}`,
                    headers: {
                        authorization: `Bearer ${testAdminKey}`,
                    },
                });

                expect(response.statusCode).toBe(400);
            });

            it('should return 403 with invalid admin key', async () => {
                const response = await app.inject({
                    method: 'POST',
                    url: `/update/${TEST_NAMESPACE}/${ADMIN_TEST_KEY}?value=10`,
                    headers: {
                        authorization: 'Bearer invalid_key',
                    },
                });

                expect(response.statusCode).toBe(403);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid namespace format', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/create/ab/validkey', // namespace too short
            });

            expect(response.statusCode).toBe(400);
        });

        it('should handle invalid key format', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/create/${TEST_NAMESPACE}/a`, // key too short
            });

            expect(response.statusCode).toBe(400);
        });

        it('should handle invalid initializer value', async () => {
            const response = await app.inject({
                method: 'GET',
                url: `/create/${TEST_NAMESPACE}/${TEST_KEY}_invalid?initializer=notanumber`,
            });

            expect(response.statusCode).toBe(400);
        });
    });
});
