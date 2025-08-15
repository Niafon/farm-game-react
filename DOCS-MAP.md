## Docs Integration Map

| Feature | Doc(s) | Integration Point | Notes |
|---|---|---|---|
| RainbowKit v2 + WalletConnect v2 | rainbowkit.com, docs.reown.com | `src/web3/wagmi.tsx` connectors | Add `walletConnect({ projectId })`, env `VITE_WALLETCONNECT_PROJECT_ID` |
| wagmi v2 tx flow | wagmi.sh | `src/hooks/useTxFlow.ts`, used from components/services | Simulate → write → wait receipt, replacement handling + normalized errors |
| EIP-1193 events | EIPs | `src/web3/WalletProvider.tsx` | Already handling `accountsChanged`/`chainChanged`/`disconnect` |
| EIP-6963 | EIPs, metamask.io | `src/services/blockchain.ts` | Discovery and preferred provider selection present |
| Vite env | vitejs | `src/config.ts` | All runtime env must be `VITE_*` |
| SIWE (EIP-4361) | EIPs, docs.login.xyz | `src/web3/siwe.ts` + README | Add backend verification before prod |
| Persist Query | tanstack.com | Optional in `WagmiProviders` | Add `persistQueryClient` if needed |



