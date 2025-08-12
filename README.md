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

Install and run:
```bash
npm i
npm run dev
```

Build and test:
```bash
npm run lint
npm run test
npm run build
```

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
  // verify per EIP-4361 using ethers.verifyMessage
  // check nonce exists, not used, not expired; then mark used
  res.cookie('sid', makeSession(), { httpOnly: true, secure: true, sameSite: 'lax' }).sendStatus(204)
})
```

## CI
Add GitHub Actions workflow to run lint → test → build; preview deploy step optional.

## Contracts
- Introduced simple `Pausable` and `ReentrancyGuard`-like modifiers.
- All mutating functions gated by `whenNotPaused` and `nonReentrant`.


