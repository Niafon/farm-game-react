import { z } from 'zod'

// Ethereum address validation
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')

// Chain ID validation
export const chainIdSchema = z.union([
  z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid hex chain ID'),
  z.string().regex(/^\d+$/, 'Invalid decimal chain ID'),
  z.number().positive('Chain ID must be positive')
])

// Transaction hash validation
export const txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash')

// Bed index validation (0-5 for base + expansion)
export const bedIndexSchema = z.number().int().min(0).max(5, 'Bed index out of range')

// Wheat amount validation (must be multiple of 10)
export const wheatAmountSchema = z.number().int().positive().refine(
  (val) => val % 10 === 0,
  'Wheat amount must be multiple of 10'
)

// Game state validation
export const bedStageSchema = z.enum(['empty', 'seed', 'growing', 'ready'])

export const bedSchema = z.object({
  stage: bedStageSchema,
  nextAction: z.enum(['plant', 'water', 'harvest']).nullable(),
  timerActive: z.boolean(),
  timerEnd: z.number().optional()
})

export const inventorySchema = z.object({
  wheat: z.number().int().min(0),
  coins: z.number().int().min(0)
})

export const gameStateSchema = z.object({
  beds: z.array(bedSchema),
  inventory: inventorySchema,
  firstTime: z.boolean(),
  expansionPurchased: z.boolean(),
  wellPurchased: z.boolean(),
  fertilizerPurchased: z.boolean()
})

// Contract write parameters validation
export const contractWriteParamsSchema = z.object({
  address: addressSchema,
  functionName: z.string().min(1, 'Function name required'),
  args: z.array(z.any()).optional()
})

// SIWE message validation
export const siweMessageSchema = z.object({
  domain: z.string().min(1, 'Domain required'),
  address: addressSchema,
  uri: z.string().url('Invalid URI'),
  chainId: chainIdSchema,
  nonce: z.string().min(8, 'Nonce too short'),
  statement: z.string().optional(),
  version: z.literal('1'),
  issuedAt: z.string().datetime().optional(),
  expirationTime: z.string().datetime().optional()
})

// Environment variables validation
export const envSchema = z.object({
  VITE_CONTRACT_ADDRESS: addressSchema,
  VITE_MONAD_CHAIN_ID: chainIdSchema.default('10143'),
  VITE_MONAD_RPC_URL: z.string().url().default('https://testnet-rpc.monad.xyz'),
  VITE_MONAD_CHAIN_NAME: z.string().default('Monad Testnet'),
  VITE_WALLETCONNECT_PROJECT_ID: z.string().optional(),
  VITE_SENTRY_DSN: z.string().url().optional()
})

// Validation helpers
export function validateGameState(data: unknown) {
  return gameStateSchema.safeParse(data)
}

export function validateAddress(address: unknown) {
  return addressSchema.safeParse(address)
}

export function validateBedIndex(index: unknown) {
  return bedIndexSchema.safeParse(index)
}

export function validateWheatAmount(amount: unknown) {
  return wheatAmountSchema.safeParse(amount)
}

export function validateEnv(env: Record<string, unknown>) {
  return envSchema.safeParse(env)
}
