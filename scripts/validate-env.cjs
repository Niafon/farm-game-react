/* Simple env validator for CI */
const required = ['VITE_CONTRACT_ADDRESS']
const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === '')
if (missing.length) {
  console.error('Missing required env:', missing.join(', '))
  process.exit(1)
}
console.log('Env validated')

