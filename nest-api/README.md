# NestJS API (skeleton plan)

Modules:
- AuthModule: SIWE session, guards, roles/ACL
- CacheModule: Redis, decorators for caching RPC/subgraph reads
- QueueModule: BullMQ for tx queues (optional)
- FarmModule: endpoints for player/feed, proxy to subgraph with cache

Guards:
- `SiweGuard` binds request to `address` from cookie session
- `RolesGuard` for admin endpoints

Env:
```
PORT=8080
REDIS_URL=redis://localhost:6379
SESSION_SECRET=...
```

