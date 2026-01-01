// Server configuration constants
export const DEV_PORT = 3000;
export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = '0.0.0.0';

// Rate limiting configuration
export const RATE_LIMIT_MAX_REQUESTS = 30;
export const RATE_LIMIT_WINDOW = '10 seconds';

// Redis key expiration
export const DEFAULT_EXPIRATION_DAYS = 180;
export const DEFAULT_EXPIRATION = 60 * 60 * 24 * DEFAULT_EXPIRATION_DAYS; // 180 days in seconds

// Validation patterns
export const KEY_REGEX = /^[A-Za-z0-9_.-]{3,64}$/;
export const CALLBACK_REGEX = /^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*$/;

// Reserved words
export const RESERVED_WORDS = [':HOST:', ':PATH:'];

// Default namespace
export const DEFAULT_NAMESPACE = 'default';

// Logging levels
export const LOG_LEVEL_DEV = 'info';
export const LOG_LEVEL_PROD = 'warn';

// Request limits
export const BODY_SIZE_LIMIT = 1048576; // 1MB

// Random ID lengths
export const RANDOM_NAMESPACE_LENGTH = 10;
export const RANDOM_KEY_LENGTH = 10;
export const ADMIN_KEY_LENGTH = 32;

// API Response constants
export const NON_EXISTENT_TTL = -2e-9;

