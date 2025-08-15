import { useCallback, useMemo, useState } from 'react'
import { simulateContract, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import type { SimulateContractParameters, WriteContractParameters } from '@wagmi/core'
import type { Hex, TransactionReceipt } from 'viem'
import { wagmiConfig } from '../web3/wagmi'
import { normalizeEip1193Error, friendlyMessageForError } from '../web3/errors'
import { startPerformanceMark, endPerformanceMark, trackWeb3Error } from '../services/sentry'

export type TxStatus = 'idle' | 'simulating' | 'pending' | 'mining' | 'confirmed' | 'replaced' | 'reverted'

export interface TxFlowOptions {
  onStart?: () => void
  onSimulated?: () => void
  onSent?: (hash: Hex) => void
  onMined?: (receipt: TransactionReceipt) => void
  onReplaced?: (replacement: { reason: 'cancelled' | 'repriced' | 'replaced'; transactionReceipt: TransactionReceipt }) => void
  onError?: (error: unknown) => void
}

export function useTxFlow() {
  const [status, setStatus] = useState<TxStatus>('idle')
  const [hash, setHash] = useState<Hex | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [minedAt, setMinedAt] = useState<number | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setHash(null)
    setError(null)
    setGasEstimate(null)
    setStartTime(null)
    setMinedAt(null)
  }, [])

  const run = useCallback(
    async (
      params: WriteContractParameters<any, any> & { simulate?: SimulateContractParameters<any, any> },
      opts?: TxFlowOptions,
    ) => {
      const operationId = `tx-${params.functionName}-${Date.now()}`
      startPerformanceMark(operationId)
      
      setError(null)
      setStatus('simulating')
      opts?.onStart?.()
      try {
        if (params.simulate) {
          const simulation = await simulateContract(wagmiConfig, params.simulate)
          setGasEstimate(simulation.request.gas || null)
          opts?.onSimulated?.()
        }

        setStatus('pending')
        setStartTime(Date.now())
        const txHash = await writeContract(wagmiConfig, params as unknown as WriteContractParameters)
        setHash(txHash)
        setStatus('mining')
        opts?.onSent?.(txHash)

        const receipt = await waitForTransactionReceipt(wagmiConfig, {
          hash: txHash,
          onReplaced: (replacement) => {
            setStatus('replaced')
            opts?.onReplaced?.(replacement)
          },
        })

        if (receipt.status === 'success') {
          setStatus('confirmed')
          setMinedAt(Date.now())
          endPerformanceMark(operationId)
          opts?.onMined?.(receipt)
        } else {
          setStatus('reverted')
          throw new Error('Transaction reverted')
        }

        return receipt
      } catch (e: unknown) {
        setStatus('idle')
        endPerformanceMark(operationId)
        
        // Track Web3 error with context
        trackWeb3Error(e, {
          operation: params.functionName || 'unknown',
          address: params.address,
          txHash: hash || undefined
        })
        
        // Normalize and surface a user-friendly error
        const norm = normalizeEip1193Error(e as any)
        setError(friendlyMessageForError(norm))
        opts?.onError?.(e)
        throw e
      }
    },
    [hash],
  )

  return useMemo(
    () => ({ status, hash, error, gasEstimate, startTime, minedAt, run, reset, isLoading: ['simulating', 'pending', 'mining'].includes(status) }),
    [status, hash, error, gasEstimate, startTime, minedAt, run, reset],
  )
}


