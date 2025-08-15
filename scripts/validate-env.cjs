/* Simple env validator for CI */
const required = ['VITE_CONTRACT_ADDRESS']
const recommended = ['VITE_MONAD_RPC_URL', 'VITE_MONAD_CHAIN_ID']
const optional = ['VITE_WALLETCONNECT_PROJECT_ID', 'VITE_MONAD_CHAIN_NAME', 'VITE_MONAD_RPC_URLS']
// Server-side env hints
const serverRecommended = ['MONAD_CHAIN_ID', 'MONAD_RPC_URLS']
const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === '')
if (missing.length) {
  console.error('Missing required env:', missing.join(', '))
  process.exit(1)
}
const warn = [...recommended, ...optional, ...serverRecommended].filter((k) => !process.env[k] || String(process.env[k]).trim() === '')
if (warn.length) {
  console.warn('Warning: unset env vars (using defaults or features disabled):', warn.join(', '))
}
console.log('Env validated')

