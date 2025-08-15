# Relayer Service (skeleton)

Responsibilities:
- Maintain a queue of tx jobs (Redis or Postgres)
- Nonce management per relayer address
- Sign with KMS/Vault/HSM (never store private keys in env)
- Backoff/retry with idempotency keys

API:
- POST /jobs { to, data, value, gasLimit?, chainId } -> jobId
- GET /jobs/:id -> status, txHash, receipt

Security:
- SIWE admin session for dashboard
- Allowlist destinations / ABI checks


