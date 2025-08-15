import { validateEnv } from './schemas/validation'

/**
 * Loads essential configuration for blockchain interaction.
 * Values are read from Vite environment variables at build time.
 */

// Validate environment variables
const envValidation = validateEnv({
  VITE_CONTRACT_ADDRESS: import.meta.env.VITE_CONTRACT_ADDRESS,
  VITE_MONAD_CHAIN_ID: import.meta.env.VITE_MONAD_CHAIN_ID,
  VITE_MONAD_RPC_URL: import.meta.env.VITE_MONAD_RPC_URL,
  VITE_MONAD_CHAIN_NAME: import.meta.env.VITE_MONAD_CHAIN_NAME,
  VITE_WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN
})

if (!envValidation.success) {
  console.error('Environment validation failed:', envValidation.error.format())
}

const env = envValidation.success ? envValidation.data : {
  VITE_CONTRACT_ADDRESS: (import.meta.env.VITE_CONTRACT_ADDRESS as string) || '',
  VITE_MONAD_CHAIN_ID: (import.meta.env.VITE_MONAD_CHAIN_ID as string) || '10143',
  VITE_MONAD_RPC_URL: (import.meta.env.VITE_MONAD_RPC_URL as string) || 'https://testnet-rpc.monad.xyz',
  VITE_MONAD_CHAIN_NAME: (import.meta.env.VITE_MONAD_CHAIN_NAME as string) || 'Monad Testnet',
  VITE_WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined,
  VITE_SENTRY_DSN: (import.meta.env.VITE_SENTRY_DSN as string | undefined) || undefined
}

export const CONTRACT_ADDRESS = env.VITE_CONTRACT_ADDRESS
export const MONAD_CHAIN_ID = env.VITE_MONAD_CHAIN_ID
export const MONAD_RPC_URL = env.VITE_MONAD_RPC_URL
export const MONAD_CHAIN_NAME = env.VITE_MONAD_CHAIN_NAME
export const SENTRY_DSN = env.VITE_SENTRY_DSN

export const MONAD_RPC_URLS = (
  ((import.meta.env.VITE_MONAD_RPC_URLS as string) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length > 0
    ? (import.meta.env.VITE_MONAD_RPC_URLS as string).split(',').map((s) => s.trim()).filter(Boolean)
    : [MONAD_RPC_URL]
) as string[]

export function ensureContractAddressConfigured(): `0x${string}` {
  const addr = (CONTRACT_ADDRESS || '').trim()
  if (!addr) throw new Error('Contract address is not configured. Set VITE_CONTRACT_ADDRESS in .env')
  return addr as `0x${string}`
}
