# Incr - Integer as a Service

A simple, fast, and scalable counter API built with Fastify, TypeScript, and Upstash Redis. Deploy to Koyeb with zero configuration.

## Features

- ✨ Simple numeric counters with namespaces
- 🔒 Admin-protected operations with bearer token auth
- 🚀 Built on Fastify for maximum performance
- 📊 Real-time statistics tracking
- ⚡ Upstash Redis for serverless-friendly persistence
- 🌐 CORS enabled for cross-origin requests
- 🛡️ Rate limiting (30 requests per 10 seconds per IP)
- 🔄 Auto-expiring keys (6 months TTL, refreshed on access)

## Quick Start

### Prerequisites

- Node.js 18+ or pnpm
- Upstash Redis account ([Get one free](https://upstash.com))

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd incr

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
```

### Configuration

Edit `.env` with your Upstash Redis credentials:

```env
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token-here
PORT=3000
API_VERSION=1.0.0
SHARD_NAME=my-shard
```

### Development

```bash
# Run in development mode with hot reload
pnpm dev
```

### Production

```bash
# Build TypeScript
pnpm build

# Start production server
pnpm start
```

## API Endpoints

### Public Endpoints

#### `GET /healthcheck`
Check API health and uptime.

**Response:**
```json
{
  "status": "ok",
  "uptime": "1h23m45s"
}
```

#### `GET /get/:namespace/:key`
Get counter value without incrementing.

**Response:**
```json
{ "value": 42 }
```

#### `GET /hit/:namespace/:key`
Increment counter by 1 and return new value. Creates counter if it doesn't exist.

**Response:**
```json
{ "value": 43 }
```

#### `GET /info/:namespace/:key`
Get detailed counter information.

**Response:**
```json
{
  "value": 42,
  "full_key": "K:myapp:visits",
  "is_genuine": true,
  "expires_in": 172800,
  "expires_str": "2d",
  "exists": true
}
```

#### `GET /create/:namespace/:key?initializer=0`
Create a new counter with optional initial value.

**Response:**
```json
{
  "key": "visits",
  "namespace": "myapp",
  "admin_key": "abc123...",
  "value": 0
}
```

**Note:** Save the `admin_key` - you'll need it for admin operations!

#### `GET /create?initializer=0`
Create counter with random namespace and key.

#### `GET /stats`
Get API statistics.

**Response:**
```json
{
  "commands": {
    "create": 1234,
    "get": 5678,
    "hit": 9012,
    "total": 15924
  },
  "total_keys": 1000,
  "version": "1.0.0",
  "shard": "my-shard",
  "uptime": "5h30m15s"
}
```

### Admin Endpoints (Require Authorization)

All admin endpoints require the `Authorization: Bearer YOUR_ADMIN_KEY` header.

#### `POST /delete/:namespace/:key`
Delete a counter.

#### `POST /set/:namespace/:key?value=100`
Set counter to specific value.

#### `POST /reset/:namespace/:key`
Reset counter to 0.

#### `POST /update/:namespace/:key?value=5`
Increment/decrement by amount (use negative for decrement).

## Deploy to Koyeb

### One-Click Deploy

[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy)

### Manual Deployment

1. Create a new app on [Koyeb](https://app.koyeb.com)
2. Connect your GitHub repository
3. Set environment variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `PORT=8000` (Koyeb default)
   - `API_VERSION=1.0.0`
   - `SHARD_NAME=production`
4. Deploy!

Koyeb will automatically:
- Detect the build command (`pnpm build`)
- Run the start command (`pnpm start`)
- Expose your API on HTTPS

## Usage Examples

### JavaScript (Fetch)

```javascript
// Increment page views
fetch('https://your-api.koyeb.app/hit/mysite.com/visits')
  .then(res => res.json())
  .then(data => console.log(`Visits: ${data.value}`));
```

### cURL

```bash
# Create a counter
curl https://your-api.koyeb.app/create/myapp/clicks

# Increment counter
curl https://your-api.koyeb.app/hit/myapp/clicks

# Get counter value
curl https://your-api.koyeb.app/get/myapp/clicks

# Admin: Reset counter
curl -X POST \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  https://your-api.koyeb.app/reset/myapp/clicks
```

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Fastify (high-performance web framework)
- **Database:** Upstash Redis (serverless Redis)
- **Deployment:** Koyeb (serverless platform)
- **Package Manager:** pnpm

## Project Structure

```
src/
├── config.ts              # Environment configuration
├── redis.ts               # Redis client setup
├── utils.ts               # Utility functions
├── index.ts               # Main application
├── middleware/
│   └── auth.ts           # Authentication middleware
├── services/
│   └── counter.service.ts # Counter business logic
└── routes/
    ├── stats.routes.ts   # Health & stats endpoints
    ├── counter.routes.ts # Counter CRUD endpoints
    └── admin.routes.ts   # Admin endpoints
```

## License

MIT
