/**
 * Loads essential configuration for blockchain interaction.
 * Values are read from Vite environment variables at build time.
 */
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string
export const MONAD_CHAIN_ID = import.meta.env.VITE_MONAD_CHAIN_ID as string
export const MONAD_RPC_URL = import.meta.env.VITE_MONAD_RPC_URL as string
export const MONAD_CHAIN_NAME = import.meta.env.VITE_MONAD_CHAIN_NAME as string
export const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || undefined
