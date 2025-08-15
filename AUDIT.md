## FarmGame React/Web3 Audit (v0)

### Scope
- Codebase: `React + TypeScript + Vite` app, on-chain logic in `contracts/FarmGame.sol`.
- Web3 stack: `wagmi v2 + viem v2 + RainbowKit v2` and some `ethers v6` usage.
- Tooling: `Hardhat`, `ESLint 9`, `Jest 30`, `ts-jest`, `rollup-plugin-visualizer`.

### 0) Inventory and versions
- react: 18.3.1
- typescript: ~5.8.3
- vite: 6.3.5
- wagmi: ^2.12.7 (installed 2.16.3)
- viem: ^2.22.7
- @rainbow-me/rainbowkit: ^2.2.8
- @tanstack/react-query: 5.85.0 (transitive from wagmi/rainbowkit)
- ethers: ^6.14.3

Notes
- Stack aligned to current majors: wagmi v2, viem v2, RainbowKit v2, TanStack Query v5.
- Mixing ethers v6 with wagmi/viem is acceptable short-term; prefer migrating to a single stack (wagmi/viem) for bundle size and consistency.
- Jest 30 requires ESM care; config updated to transform ESM deps.

### 1) Build health (Windows, Node 20)
- Install: OK
- Type-check: OK
- Lint: OK (warnings remain; see below)
- Build: OK
- Tests (Jest): OK (2 suites, 6 tests passed)

Key lint warnings to triage
- react-hooks/exhaustive-deps in `useGameEngine.ts`, `WalletProvider.tsx`.
- Fast Refresh advisories for files exporting both components and values (`wagmi.tsx`, `WalletProvider.tsx`).
- A few unused eslint-disables.

Jest hardening
- Added ESM transforms for wagmi/viem/RainbowKit and polyfilled `TextEncoder/TextDecoder`.

### 2) Env and secrets
- Frontend config at `src/config.ts` reads `VITE_*` keys. Defaults exist for Monad testnet.
- CI env validation requires `VITE_CONTRACT_ADDRESS` only. Recommendation: also validate `VITE_MONAD_CHAIN_ID` and `VITE_MONAD_RPC_URL` (or rely on safe defaults) and add `VITE_WALLETCONNECT_PROJECT_ID` when enabling WalletConnect.
- No secrets stored in repo. CSP headers present in `public/_headers` and mirrored inside `vite.config.ts` preview headers.

### 3) Bundle analysis
Built with `npm run analyze` (visualizer):
- wagmi: ~611 kB (gzip ~192 kB)
- ethers: ~392 kB (gzip ~145 kB)
- react: ~314 kB (gzip ~97 kB)

Heaviest contributors
- wagmi + RainbowKit UI assets and locale bundles.
- ethers v6 (duplicated functionality with viem for on-chain IO/signing).

Optimizations
- Prefer viem for reads/writes and wagmi hooks; phase out `ethers` from runtime to save ~300–400 kB.
- Code-split RainbowKit locales and non-essential UI (already partially chunked via manualChunks). Consider lazy-mounting wallet UI.
- Ensure tree-shaking by avoiding barrel imports and unused locales.

### 4) Web3 architecture
- wagmi config in `src/web3/wagmi.tsx` using a custom `defineChain` for Monad and `injected` connector. `QueryClientProvider` is set, SSR disabled.
- EIP-1193: `WalletProvider.tsx` passively attaches, listens to `accountsChanged`/`chainChanged`/`disconnect`, and blocks non-Monad networks. Good.
- EIP-6963: `services/blockchain.ts` implements discovery and preference storage; UI event hooks are present for provider selection.
- @wagmi/core usage: `src/services/contract.ts` reads/writes with `readContract/writeContract/waitForTransactionReceipt`. Good.
- ethers usage: connection flow and SIWE message signing in `WalletProvider` and `useGameEngine`. This can be migrated to `wagmi` actions (`signMessage`) to remove ethers.
- Data schemas: no zod validation for on-chain payloads; consider adding minimal guards (e.g., numeric bounds) before writes.

### 5) Transactions/UX flow
Current pattern (services/contract.ts): `writeContract → waitForTransactionReceipt` per method — OK.
Gaps
- No simulate step before write.
- No unified status-machine or error normalization at the hook level.
- No handling for tx replacement/acceleration.

Recommendation
- Introduce `useTxFlow` hook (see `PATCHES/useTxFlow.ts`) with states: `idle/pending/mining/confirmed/replaced/reverted` and callbacks `onStart/onMined/onError`. Internally: `simulate* → write* → waitForTransactionReceipt` using wagmi actions.
- Centralize error mapping (user rejected, chain mismatch, insufficient funds) via a shared util.

### 6) RainbowKit + wagmi checks
- Versions: RainbowKit v2 + wagmi v2 + viem v2 + TanStack Query v5 — compatible.
- Connectors: Only `injected` is enabled. To support WalletConnect v2, add projectId from Reown/WalletConnect Cloud and configure connector (see `PATCHES/wagmi.config.example.ts`).
- SSR: disabled in wagmi config; app is CSR only.
- EIP-6963: custom discovery in legacy flow; RainbowKit itself supports multi-injected discovery. Avoid double prompts by keeping one flow (RainbowKit).
- Chains/RPC: custom `defineChain` for Monad; `wallet_switchEthereumChain` and `wallet_addEthereumChain` provided in helpers.
- UI/UX: `WalletConnectButton` renders RainbowKit `ConnectButton`; `WalletPanel` mirrors state via a legacy bridge.

Testing checklist (ran partially)
- Connect/disconnect and chain switching: manual test recommended.
- Signing and tx cancellation: to be validated once `useTxFlow` is in place.

### 7) SIWE
- Client-only SIWE prompt via `buildSiweMessage` + `signMessage` using ethers signer. Includes `domain, uri, chainId, nonce, issuedAt, expirationTime (60s)`.
- No backend verification included; README outlines server-side flow.

Recommendations
- Add minimal backend (Express or serverless) to issue nonce and verify per EIP-4361. Set HttpOnly SameSite cookies.
- On client, avoid signing on page load; only after explicit user interaction (already the case).

### 8) Security review
- CSP headers shipped; no inline/eval; connect-src allows https/wss — OK.
- XSS: UI relies on React; avoid injecting user strings into `dangerouslySetInnerHTML` (not present).
- CSRF: not applicable yet (no mutating HTTP endpoints). Add CSRF tokens once SIWE server exists.
- EIP-1193: blocks wrong networks; handles account/chain changes; normalizes common errors.
- Logging/PII: Sentry optional with PII scrubbing.
- Env validation: add `VITE_WALLETCONNECT_PROJECT_ID` when enabling WalletConnect.

### 9) Performance & DX
- TanStack Query: default cache; consider tuning `staleTime`, `gcTime`, and optional persistence (LS/IDB) for read-heavy views.
- Code-split large libs; remove ethers to reduce ~145 kB gzip.
- Avoid repeated locale bundles from RainbowKit; load only needed locales.

### 10) Action plan (minimal, reversible)
P0
- Add WalletConnect v2 connector + `VITE_WALLETCONNECT_PROJECT_ID` (feature-flag in config).
- Introduce `useTxFlow` hook and migrate write sites behind it incrementally.

P1
- Migrate SIWE signing to wagmi `signMessage` and deprecate ethers from runtime.
- Strengthen env validation and add `.env.example`.

P2
- Add backend SIWE verification endpoint.
- Add zod validation for tx payloads.

KPIs to track
- Bundle size (main chunks), TTI, tx error rate, wallet connection success rate, support tickets for wallet issues.



