import 'dotenv/config';

interface Config {
    upstash: {
        url: string;
        token: string;
    };
    server: {
        port: number;
        host: string;
    };
    api: {
        version: string;
        shardName: string;
    };
}

function getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key] || defaultValue;
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export const config: Config = {
    upstash: {
        url: getEnvVar('UPSTASH_REDIS_REST_URL'),
        token: getEnvVar('UPSTASH_REDIS_REST_TOKEN'),
    },
    server: {
        port: parseInt(getEnvVar('PORT', '3000'), 10),
        host: getEnvVar('HOST', '0.0.0.0'),
    },
    api: {
        version: getEnvVar('API_VERSION', '1.0.0'),
        shardName: getEnvVar('SHARD_NAME', 'default-shard'),
    },
};
