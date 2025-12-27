import { nanoid } from 'nanoid';
import { redis, buildKey, buildAdminKey, DEFAULT_EXPIRATION } from '../redis.js';
import { validateKey, validateNamespace } from '../utils.js';

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

        // Check if key already exists
        const exists = await redis.exists(fullKey);
        if (exists) {
            throw new Error('Key already exists, please use a different key.');
        }

        // Generate admin key
        const adminKey = nanoid(32);
        const adminKeyRef = buildAdminKey(namespace, key);

        // Set counter value
        await redis.set(fullKey, initialValue);
        await redis.expire(fullKey, DEFAULT_EXPIRATION);

        // Store admin key reference
        await redis.set(adminKeyRef, adminKey);
        await redis.expire(adminKeyRef, DEFAULT_EXPIRATION);

        // Track stats
        await this.incrementStat('create');

        return {
            key,
            namespace,
            admin_key: adminKey,
            value: initialValue,
        };
    }

    // Create counter with random namespace and key
    async createRandom(initialValue: number = 0): Promise<CreateCounterResult> {
        const namespace = nanoid(10);
        const key = nanoid(10);
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
        ]);
    }

    // Set counter value (requires admin key)
    async set(namespace: string, key: string, value: number, providedAdminKey: string): Promise<number> {
        await this.verifyAdminKey(namespace, key, providedAdminKey);

        const fullKey = buildKey(namespace, key);
        const exists = await redis.exists(fullKey);

        if (!exists) {
            throw new Error('Key does not exist, please use a different key.');
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

    // Increment stats counter
    private async incrementStat(statName: string): Promise<void> {
        const statKey = `S:commands:${statName}`;
        await redis.incr(statKey);
        await redis.incr('S:commands:total');
    }

    // Format expiration time
    private formatExpiration(seconds: number): string {
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
}

export const counterService = new CounterService();
