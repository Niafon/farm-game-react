# SIWE Authentication Server

Production-ready SIWE (Sign-In with Ethereum) backend for FarmGame.

## Features

- ✅ EIP-4361 compliant SIWE verification
- ✅ Redis-based session storage (fallback to memory)
- ✅ Rate limiting protection
- ✅ CSRF protection (domain/origin validation)
- ✅ HttpOnly secure cookies
- ✅ Graceful shutdown handling
- ✅ Health check endpoint

## Environment Variables

```env
# Required
PORT=8787
VITE_MONAD_CHAIN_ID=10143

# Production settings
NODE_ENV=production
COOKIE_DOMAIN=yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Optional: Redis for production
REDIS_URL=redis://localhost:6379

# Optional: Advanced CORS
CORS_ORIGINS=https://app1.com,https://app2.com
```

## Endpoints

### `GET /siwe/nonce`
Generate a fresh nonce for SIWE message signing.
- Rate limited: 60 requests per minute per IP
- TTL: 60 seconds

### `POST /siwe/verify`
Verify SIWE signature and establish session.
```json
{
  "address": "0x...",
  "message": "domain.com wants you to sign...",
  "signature": "0x..."
}
```

### `GET /siwe/me`
Check current authentication status.
Returns session info if authenticated.

### `POST /siwe/logout`
Clear authentication session.

### `GET /health`
Server health check endpoint.

## Development

```bash
# Install dependencies
npm install

# Start with basic config
PORT=8787 NODE_ENV=development node server/index.js

# Start with Redis
REDIS_URL=redis://localhost:6379 node server/index.js
```

## Production Deployment

```bash
# With Redis and security
NODE_ENV=production \
COOKIE_DOMAIN=yourdomain.com \
CORS_ORIGINS=https://yourdomain.com \
REDIS_URL=redis://your-redis-url \
node server/index.js
```

## Security Features

1. **Rate Limiting**: 60 requests per minute per IP
2. **CSRF Protection**: Validates domain, URI, origin, and referer
3. **Secure Cookies**: HttpOnly, Secure, SameSite=strict
4. **One-time Nonces**: Prevents replay attacks
5. **Chain Validation**: Ensures correct network
6. **Helmet Security**: Standard security headers