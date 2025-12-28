import { nanoid } from 'nanoid';
import { redis, buildKey, buildAdminKey, DEFAULT_EXPIRATION } from '../redis.js';
import { validateKey, validateNamespace, formatDuration } from '../utils.js';
import { RANDOM_NAMESPACE_LENGTH, RANDOM_KEY_LENGTH, ADMIN_KEY_LENGTH } from '../constants.js';

export interface CounterInfo {
    value: number;
    full_key: string;
    is_genuine: boolean;
    expires_in: number;
    expires_str: string;
    exists: boolean;
}

export interface CreateCounterResult {
    key: string;
    namespace: string;
    admin_key: string;
    value: number;
}

export class CounterService {
    // Get counter value
    async get(namespace: string, key: string): Promise<number | null> {
        const fullKey = buildKey(namespace, key);
        const value = await redis.get<number>(fullKey);

        if (value !== null) {
            // Refresh expiration on access
            await redis.expire(fullKey, DEFAULT_EXPIRATION);
        }

        return value;
    }

    // Increment counter by 1
    async hit(namespace: string, key: string): Promise<number> {
        const fullKey = buildKey(namespace, key);

        // Increment and get new value
        const newValue = await redis.incr(fullKey);

        // Set expiration (refreshes if already exists)
        await redis.expire(fullKey, DEFAULT_EXPIRATION);

        // Track stats
        await this.incrementStat('hit');

        return newValue;
    }

    // Create a new counter with optional initial value
    async create(
        namespace: string,
        key: string,
        initialValue: number = 0
    ): Promise<CreateCounterResult> {
        if (!validateNamespace(namespace)) {
            throw new Error('Invalid namespace format');
        }

        if (!validateKey(key)) {
            throw new Error('Invalid key format');
        }

        const fullKey = buildKey(namespace, key);
        const adminKeyRef = buildAdminKey(namespace, key);

        // Generate admin key
        const adminKey = nanoid(ADMIN_KEY_LENGTH);

        // Use SET NX to atomically create the key only if it doesn't exist
        // This prevents race conditions when multiple requests try to create the same key
        const result = await redis.set(fullKey, initialValue, { nx: true, ex: DEFAULT_EXPIRATION });

        if (!result) {
            throw new Error('Key already exists, please use a different key.');
        }

        // Store admin key reference
        await redis.set(adminKeyRef, adminKey, { ex: DEFAULT_EXPIRATION });

        // Track stats
        await this.incrementStat('create');
        await redis.incr('S:stats:total_keys');

        return {
            key,
            namespace,
            admin_key: adminKey,
            value: initialValue,
        };
    }

    // Create counter with random namespace and key
    async createRandom(initialValue: number = 0): Promise<CreateCounterResult> {
        const namespace = nanoid(RANDOM_NAMESPACE_LENGTH);
        const key = nanoid(RANDOM_KEY_LENGTH);
        return this.create(namespace, key, initialValue);
    }

    // Get detailed counter information
    async info(namespace: string, key: string): Promise<CounterInfo> {
        const fullKey = buildKey(namespace, key);
        const adminKeyRef = buildAdminKey(namespace, key);

        const [value, ttl, adminExists] = await Promise.all([
            redis.get<number>(fullKey),
            redis.ttl(fullKey),
            redis.exists(adminKeyRef),
        ]);

        const exists = value !== null;
        const expiresIn = exists ? ttl : -2e-9;

        return {
            value: value ?? -1,
            full_key: fullKey,
            is_genuine: adminExists === 0, // true if no admin key (created via /hit)
            expires_in: expiresIn,
            expires_str: this.formatExpiration(expiresIn),
            exists,
        };
    }

    // Delete a counter (requires admin key verification)
    async delete(namespace: string, key: string, providedAdminKey: string): Promise<void> {
        await this.verifyAdminKey(namespace, key, providedAdminKey);

        const fullKey = buildKey(namespace, key);
        const adminKeyRef = buildAdminKey(namespace, key);

        await Promise.all([
            redis.del(fullKey),
            redis.del(adminKeyRef),
            redis.decr('S:stats:total_keys'),
        ]);
    }

    // Set counter value (requires admin key)
    async set(namespace: string, key: string, value: number, providedAdminKey: string): Promise<number> {
        await this.verifyAdminKey(namespace, key, providedAdminKey);

        const fullKey = buildKey(namespace, key);
        const exists = await redis.exists(fullKey);

        if (!exists) {
            throw new Error('Key does not exist.');
        }

        await redis.set(fullKey, value);
        await redis.expire(fullKey, DEFAULT_EXPIRATION);

        return value;
    }

    // Reset counter to 0 (requires admin key)
    async reset(namespace: string, key: string, providedAdminKey: string): Promise<number> {
        return this.set(namespace, key, 0, providedAdminKey);
    }

    // Update counter by amount (requires admin key)
    async update(namespace: string, key: string, amount: number, providedAdminKey: string): Promise<number> {
        await this.verifyAdminKey(namespace, key, providedAdminKey);

        const fullKey = buildKey(namespace, key);
        const exists = await redis.exists(fullKey);

        if (!exists) {
            throw new Error('Key does not exist, please first create it using /create.');
        }

        const newValue = await redis.incrby(fullKey, amount);
        await redis.expire(fullKey, DEFAULT_EXPIRATION);

        return newValue;
    }

    // Verify admin key
    private async verifyAdminKey(namespace: string, key: string, providedAdminKey: string): Promise<void> {
        const adminKeyRef = buildAdminKey(namespace, key);
        const storedAdminKey = await redis.get<string>(adminKeyRef);

        if (!storedAdminKey) {
            throw new Error('No admin key found for this counter');
        }

        if (storedAdminKey !== providedAdminKey) {
            throw new Error('Invalid admin key');
        }
    }

    /**
     * Increment stats counter for tracking API usage.
     * @param statName - Name of the stat to increment (e.g., 'create', 'get', 'hit')
     */
    async incrementStat(statName: string): Promise<void> {
        const statKey = `S:commands:${statName}`;
        await redis.incr(statKey);
        await redis.incr('S:commands:total');
    }

    // Format expiration time using shared utility
    private formatExpiration(seconds: number): string {
        return formatDuration(seconds);
    }
}

export const counterService = new CounterService();
