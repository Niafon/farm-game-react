/**
 * Entry point for the React application. It mounts the App component
 * into the DOM element with id="root".
 */
import { createRoot } from 'react-dom/client'
import React from 'react'

import App from './App'
import { WalletProvider } from './web3/WalletProvider'
import { WagmiProviders } from './web3/wagmi'
import WagmiBridge from './components/WagmiBridge'
import ProviderPicker from './components/ProviderPicker'
import ToastBus from './components/ToastBus'
import { initSentry } from './services/sentry'

// Expose selected env to runtime UI (non-secret only)
try {
  (window as unknown as { __ENV__?: unknown }).__ENV__ = {
    CONTRACT_ADDRESS: import.meta.env.VITE_CONTRACT_ADDRESS,
    MONAD_RPC_URL: import.meta.env.VITE_MONAD_RPC_URL,
    MONAD_CHAIN_ID: import.meta.env.VITE_MONAD_CHAIN_ID,
    MONAD_CHAIN_NAME: import.meta.env.VITE_MONAD_CHAIN_NAME,
  }
} catch {}

// Initialize enhanced error tracking and monitoring
initSentry()

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <WagmiProviders>
        <WalletProvider>
          <WagmiBridge />
          <ProviderPicker />
          <ToastBus />
          <App />
        </WalletProvider>
      </WagmiProviders>
    </React.StrictMode>
  )
} else {
  console.error('Root element not found')
}

// Production runtime env validation
if (import.meta.env.PROD) {
  const required = ['VITE_CONTRACT_ADDRESS'] as const
  const missing = required.filter((k) => !import.meta.env[k] || String(import.meta.env[k]).trim() === '')
  if (missing.length) {
    console.warn(`Missing required env vars: ${missing.join(', ')}`)
  }
}
