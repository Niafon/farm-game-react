import { readContract, writeContract, waitForTransactionReceipt, simulateContract } from '@wagmi/core'
import { wagmiConfig } from '../web3/wagmi'
import { ensureContractAddressConfigured } from '../config'
import { FARM_ABI } from './abi'
import { validateAddress, validateBedIndex, validateWheatAmount } from '../schemas/validation'
// (reserved for future direct viem client usage if needed)

// FARM_ABI is centralized in ./abi to avoid drift across modules

function ensureAddress(): `0x${string}` {
  return ensureContractAddressConfigured()
}

// Simple in-memory cache and in-flight coalescing for hot reads
const hotCache = new Map<string, { value: string; expiresAt: number }>()
const inFlight = new Map<string, Promise<string>>()

export async function readFullState(player: `0x${string}`): Promise<string> {
  // Validate player address
  const playerValidation = validateAddress(player)
  if (!playerValidation.success) {
    throw new Error(`Invalid player address: ${playerValidation.error.message}`)
  }

  const address = ensureAddress()
  const key = `readFullState:${address}:${player.toLowerCase()}`
  const now = Date.now()
  const cached = hotCache.get(key)
  if (cached && cached.expiresAt > now) return cached.value
  const pending = inFlight.get(key)
  if (pending) return pending
  const job = (async () => {
    try {
      const res = await readContract(wagmiConfig, { address, abi: FARM_ABI, functionName: 'getFullState', args: [player] }) as string
      hotCache.set(key, { value: res, expiresAt: now + 1500 })
      return res
    } catch {
      const res = await readContract(wagmiConfig, { address, abi: FARM_ABI, functionName: 'getGameState', args: [player] }) as string
      hotCache.set(key, { value: res, expiresAt: now + 1500 })
      return res
    } finally {
      inFlight.delete(key)
    }
  })()
  inFlight.set(key, job)
  return job
}

// DRY helper for simulate+write+wait
async function writeWithSimulation<TArgs extends readonly unknown[]>(fn: string, args: TArgs) {
  const address = ensureAddress()
  await simulateContract(wagmiConfig, { address, abi: FARM_ABI as any, functionName: fn as any, args } as any)
  const hash = await writeContract(wagmiConfig, { address, abi: FARM_ABI as any, functionName: fn as any, args } as any)
  return await waitForTransactionReceipt(wagmiConfig, { hash })
}

export async function writeSetGameState(stateJson: string) {
  return writeWithSimulation('setGameState', [stateJson] as const)
}

export async function writePlant(bedIndex: number) {
  const validation = validateBedIndex(bedIndex)
  if (!validation.success) {
    throw new Error(`Invalid bed index: ${validation.error.message}`)
  }
  const args = [BigInt(bedIndex)] as const
  return writeWithSimulation('plant', args)
}

export async function writeWater(bedIndex: number) {
  const validation = validateBedIndex(bedIndex)
  if (!validation.success) {
    throw new Error(`Invalid bed index: ${validation.error.message}`)
  }
  const args = [BigInt(bedIndex)] as const
  return writeWithSimulation('water', args)
}

export async function writeHarvest(bedIndex: number) {
  const validation = validateBedIndex(bedIndex)
  if (!validation.success) {
    throw new Error(`Invalid bed index: ${validation.error.message}`)
  }
  const args = [BigInt(bedIndex)] as const
  return writeWithSimulation('harvest', args)
}

export async function writeBatchPlant(indices: number[]) {
  const arr = indices.map((i) => BigInt(i))
  return writeWithSimulation('batchPlant', [arr] as const)
}

export async function writeBatchWater(indices: number[]) {
  const arr = indices.map((i) => BigInt(i))
  return writeWithSimulation('batchWater', [arr] as const)
}

export async function writeBatchHarvest(indices: number[]) {
  const arr = indices.map((i) => BigInt(i))
  return writeWithSimulation('batchHarvest', [arr] as const)
}

export async function writeExchangeWheat(amountWheat: number) {
  const validation = validateWheatAmount(amountWheat)
  if (!validation.success) {
    throw new Error(`Invalid wheat amount: ${validation.error.message}`)
  }
  const args = [BigInt(amountWheat)] as const
  return writeWithSimulation('exchangeWheat', args)
}

export async function writeBuyExpansion() {
  return writeWithSimulation('buyExpansion', [] as const)
}

export async function writeBuyWell() {
  return writeWithSimulation('buyWell', [] as const)
}

export async function writeBuyFertilizer() {
  return writeWithSimulation('buyFertilizer', [] as const)
}


