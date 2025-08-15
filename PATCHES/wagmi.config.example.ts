import { createConfig, http } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { defineChain } from 'viem'

const monad = defineChain({
  id: Number(import.meta.env.VITE_MONAD_CHAIN_ID) || 10143,
  name: import.meta.env.VITE_MONAD_CHAIN_NAME || 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [import.meta.env.VITE_MONAD_RPC_URL] } },
  testnet: true,
})

export const config = createConfig({
  chains: [monad],
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({ projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID, showQrModal: true }),
  ],
  transports: { [monad.id]: http(import.meta.env.VITE_MONAD_RPC_URL) },
  multiInjectedProviderDiscovery: true,
  ssr: false,
})



