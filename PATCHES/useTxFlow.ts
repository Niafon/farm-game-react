import { useCallback, useMemo, useState } from 'react'
import { SimulateContractParameters, WriteContractParameters, simulateContract, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import type { Hex } from 'viem'
import { wagmiConfig } from '../src/web3/wagmi'

export type TxStatus = 'idle' | 'pending' | 'mining' | 'confirmed' | 'replaced' | 'reverted'

export function useTxFlow() {
  const [status, setStatus] = useState<TxStatus>('idle')
  const [hash, setHash] = useState<Hex | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setHash(null)
    setError(null)
  }, [])

  const run = useCallback(
    async <TAbi extends readonly unknown[], TFunctionName extends string>(
      params: WriteContractParameters<TAbi, TFunctionName> & { simulate?: SimulateContractParameters<TAbi, TFunctionName> },
      opts?: { onStart?: () => void; onMined?: () => void; onError?: (err: unknown) => void },
    ) => {
      setError(null)
      setStatus('pending')
      opts?.onStart?.()
      try {
        if (params.simulate) {
          await simulateContract(wagmiConfig, params.simulate)
        }
        const txHash = await writeContract(wagmiConfig, params)
        setHash(txHash)
        setStatus('mining')
        const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash })
        if (receipt.status === 'success') setStatus('confirmed')
        else setStatus('reverted')
        opts?.onMined?.()
        return receipt
      } catch (e: unknown) {
        setStatus('idle')
        setError(normalizeErr(e))
        opts?.onError?.(e)
        throw e
      }
    },
    [],
  )

  return useMemo(() => ({ status, hash, error, run, reset }), [status, hash, error, run, reset])
}

function normalizeErr(e: unknown): string {
  const err = e as { code?: number; message?: string }
  if (err?.code === 4001) return 'User rejected'
  if (err?.code === -32002) return 'Request already pending in wallet'
  return err?.message || 'Transaction failed'
}



