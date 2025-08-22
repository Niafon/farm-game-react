# Security & SIWE Notes

This app uses a frontend-only SIWE prompt to bind the session to a wallet address. For production you must validate SIWE server-side:

1. Generate a high-entropy nonce (>=128 bits), store with TTL<=60s in a cache keyed by session id.
2. Build the SIWE message including domain, uri, chainId, statement, issuedAt, expirationTime and the nonce.
3. User signs the message in the browser; send {address, message, signature} to backend.
4. Backend verifies:
   - recover address from signature == provided address
   - domain/uri match expected
   - not expired and nonce matches unused value, then mark nonce as used (one-time)
5. Issue an HttpOnly secure SameSite=strict cookie session with short TTL (e.g. 15m) and rotate on use.

Example express pseudo-code:

```ts
app.post('/siwe/nonce', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  cache.set(`siwe:${sessionId}`, nonce, 60_000);
  res.json({ nonce });
});

app.post('/siwe/verify', async (req, res) => {
  const { address, message, signature } = req.body;
  const stored = cache.get(`siwe:${sessionId}`);
  if (!stored) return res.status(400).json({ ok: false });
  // verify signature and claims (domain, uri, chainId, expiration)
  const valid = await verifySiwe({ address, message, signature, expectedNonce: stored });
  if (!valid) return res.status(401).json({ ok: false });
  cache.del(`siwe:${sessionId}`); // one-time nonce
  // set HttpOnly cookie session
  res.cookie('sid', newSessionId(), { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 15 * 60_000 });
  res.json({ ok: true });
});
```

Content Security Policy shipped in `public/_headers` forbids inline/eval. Avoid storing secrets in localStorage; the app stores only minimal UX flags when disconnected.
# FarmGame React + Solidity

## Setup
- Node 20+
- Copy `.env.example` to `.env` and set values.

Required env (frontend):
- `VITE_CONTRACT_ADDRESS`
- `VITE_MONAD_RPC_URL`
- `VITE_MONAD_CHAIN_ID`
- `VITE_MONAD_CHAIN_NAME`
- Optional: `VITE_SENTRY_DSN`
- Optional: `VITE_WALLETCONNECT_PROJECT_ID` (for WalletConnect v2)
- Optional: `VITE_MONAD_RPC_URLS` (comma-separated list for RPC fallback)

Minimal local `.env` to keep build green:
```
VITE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
VITE_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
VITE_MONAD_CHAIN_ID=10143
VITE_MONAD_CHAIN_NAME=Monad Testnet
# Optional
VITE_MONAD_RPC_URLS=https://testnet-rpc.monad.xyz,https://secondary-rpc.example
```

Install and run:
```bash
npm i
npm run dev
```

Run SIWE dev server (optional, for auth verification):
```bash
npm run dev:server
# Vite will proxy /siwe to http://localhost:8787
```

Server environment variables (local example):

```
MONAD_CHAIN_ID=10143
MONAD_RPC_URLS=https://testnet-rpc.monad.xyz,https://secondary-rpc.example
# Optional
REDIS_URL=redis://localhost:6379
COOKIE_DOMAIN=localhost
CORS_ORIGINS=
```

Create `.env.example`:
```env
VITE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
VITE_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
VITE_MONAD_CHAIN_ID=10143
VITE_MONAD_CHAIN_NAME=Monad Testnet
# Optional
VITE_WALLETCONNECT_PROJECT_ID=
VITE_SENTRY_DSN=
VITE_MONAD_RPC_URLS=
```

Build and test:
```bash
npm run lint
npm run test
npm run build
```

### Hardhat: deploy & verify

Required env (backend, used by Hardhat):
- `PRIVATE_KEY` — деплойер
- `VITE_MONAD_RPC_URL`, `VITE_MONAD_CHAIN_ID` — RPC/chainId
- (опц.) Blockscout/Explorer verify:
  - `BLOCK_EXPLORER_API_URL` (например, `https://explorer.monad.xyz/api`)
  - `BLOCK_EXPLORER_BROWSER_URL` (например, `https://explorer.monad.xyz`)
  - `BLOCK_EXPLORER_API_KEY` (если требуется; для Blockscout можно фиктивный)

Команды:
```bash
npm run hh:compile
npm run hh:deploy
# verify по адресу
npm run hh:verify:addr 0xDeployedAddressHere
```

Production checklist:
- env проверены (`npm run build:ci`), заданы RPC/chainId/contract
- включён WalletConnect (опц.) с `VITE_WALLETCONNECT_PROJECT_ID`
- настроен SIWE backend (`/siwe/nonce`, `/siwe/verify`) и httpOnly cookie
- включена CSP (`public/_headers`) и (опц.) Sentry DSN

## Wallet UX
- Single connect flow with concurrency guard, normalized EIP-1193 errors, auto-attach if account authorized.
- No double prompts; pending request message shown for `-32002`.

## Sync Strategy
- Listen `StateDelta` and fallback poll every 15s.
- RPC reads are coalesced and retried with backoff.

## Security
- CSP headers in `public/_headers`.
- Optional Sentry monitoring via `VITE_SENTRY_DSN` with PII filtering.
- SIWE client utilities only; do not trust on the server without validation.

### SIWE minimal backend sketch
This app signs a SIWE message on connect. To secure sessions, implement a small server:

Endpoints:
- `GET /siwe/nonce` → `{ nonce, expiresAt }` short TTL (60s), random 128-bit.
- `POST /siwe/verify` body `{ message, signature }` → verify, ensure nonce fresh and one-time, bind to IP/UA fingerprint loosely, create httpOnly secure cookie session.
- `POST /siwe/logout` → invalidate session.

Nonce table schema:
```sql
CREATE TABLE siwe_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
```

Express pseudo-code:
```ts
app.get('/siwe/nonce', async (_req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex')
  await db.insert({ nonce, expires_at: new Date(Date.now()+60_000) })
  res.json({ nonce })
})
app.post('/siwe/verify', async (req, res) => {
  const { message, signature } = req.body
  // verify per EIP-4361 (can use viem/ethers server-side)
  // check nonce exists, not used, not expired; then mark used
  res.cookie('sid', makeSession(), { httpOnly: true, secure: true, sameSite: 'lax' }).sendStatus(204)
})
```

## Testing
- Jest is configured to transform ESM deps (wagmi/viem/RainbowKit). If you add new ESM deps used in tests, keep transforms permissive.

## Bundle analysis
- Run `npm run analyze` and open `bundle-stats.html`.

## CI
Add GitHub Actions workflow to run lint → test → build; preview deploy step optional.

## Contracts
- `FarmGame` is deployed behind a UUPS proxy (ERC1967).
- OpenZeppelin `Pausable` and `ReentrancyGuard` protect state mutations.
- All mutating functions are gated by `whenNotPaused` and `nonReentrant`.

## Governance
- Upgrade admin / owner: `0x0000000000000000000000000000000000000000` (replace with actual owner)
- Pause admin: `0x0000000000000000000000000000000000000000` (same as owner)

**Upgrade procedure**
1. Deploy new implementation contract (e.g. `FarmGameV2`).
2. Run `node scripts/upgrade.cjs` with `PROXY_ADDRESS` pointing to the proxy.

**Pause / unpause**
- The owner may call `pause()` to halt gameplay and `unpause()` to resume.


