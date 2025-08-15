import React from 'react'
import { createConfig, WagmiProvider } from 'wagmi'
// Ensure selector shim is available in environments where React 18 polyfills are needed
// import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector'
import { injected, walletConnect } from 'wagmi/connectors'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import 'eventemitter3'
import '@rainbow-me/rainbowkit/styles.css'
import { defineChain, http as viemHttp, fallback } from 'viem'
import { MONAD_CHAIN_ID, MONAD_CHAIN_NAME, MONAD_RPC_URLS } from '../config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// import { persistQueryClient } from '@tanstack/react-query-persist-client'
// import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { Suspense } from 'react'

function normalizeChainId(): number {
  const raw = (MONAD_CHAIN_ID || '').toString()
  if (!raw) return 0
  return raw.startsWith('0x') ? parseInt(raw, 16) : parseInt(raw, 10)
}

// eslint-disable-next-line react-refresh/only-export-components
export const monadChain = defineChain({
  id: normalizeChainId(),
  name: MONAD_CHAIN_NAME || 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: MONAD_RPC_URLS },
    public: { http: MONAD_RPC_URLS },
  },
  // Optional: add explorer when available
  testnet: true,
})

const transport = MONAD_RPC_URLS.length > 1
  ? fallback(
      MONAD_RPC_URLS.map((u) => viemHttp(u, { batch: true, timeout: 10_000 })),
      {
        // consider providers in parallel, do not rank by latency permanently
        rank: false,
        // minimal retries at fallback layer (wagmi also retries queries)
        retryCount: 2,
      },
    )
  : viemHttp(MONAD_RPC_URLS[0], { batch: true, timeout: 10_000 });

// eslint-disable-next-line react-refresh/only-export-components
export const wagmiConfig = createConfig({
  chains: [monadChain],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
      ? [walletConnect({
          projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string,
          showQrModal: true,
          metadata: {
            name: 'FarmGame',
            description: 'Web3 Farm Game on Monad',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
            icons: typeof window !== 'undefined' ? [`${window.location.origin}/vite.svg`] : [],
          },
        })]
      : []),
  ],
  transports: {
    [monadChain.id]: transport,
  },
  multiInjectedProviderDiscovery: true,
  ssr: false,
})

export function WagmiProviders({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount) => {
          // Conservative retry for transient RPC errors
          return failureCount < 2;
        },
      },
    },
  }))
  React.useEffect(() => {
    // Disable persistence temporarily to avoid version conflicts
    // TODO: Re-enable when TanStack Query versions are aligned
    // try {
    //   const persister = createSyncStoragePersister({ storage: window.localStorage })
    //   persistQueryClient({ queryClient: client, persister })
    // } catch {}
  }, [client])
  return (
    <QueryClientProvider client={client}>
      <WagmiProvider config={wagmiConfig}>
        <Suspense fallback={null}>
          <RainbowKitProvider
            theme={darkTheme({ borderRadius: 'medium' })}
            modalSize="compact"
            initialChain={monadChain}
          >
            {children}
          </RainbowKitProvider>
        </Suspense>
      </WagmiProvider>
    </QueryClientProvider>
  )
}


