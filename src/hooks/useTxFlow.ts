import { useCallback, useMemo, useState } from 'react'
import {
  simulateContract,
  writeContract,
  waitForTransactionReceipt,
  type SimulateContractParameters,
  type WriteContractParameters,
} from '@wagmi/core'
import type { ContractFunctionName, Hex } from 'viem'
import { wagmiConfig } from '../web3/wagmi'

export type TxStatus = 'idle' | 'pending' | 'mining' | 'confirmed' | 'reverted'

export interface TxFlowOpts {
  onStart?: () => void
  onMined?: () => void
  onError?: (message: string) => void
}

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
    async <
      TAbi extends readonly unknown[],
      TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
    >(
      params: { simulate?: SimulateContractParameters<TAbi, TFunctionName> } &
        WriteContractParameters<TAbi, TFunctionName>,
      opts?: TxFlowOpts,
    ) => {
      setError(null)
      setStatus('pending')
      opts?.onStart?.()
      try {
        const { simulate, ...request } =
          params as { simulate?: SimulateContractParameters<TAbi, TFunctionName> } &
            WriteContractParameters<TAbi, TFunctionName>
        if (simulate) {
          await simulateContract(wagmiConfig, simulate as any)
        }
        const txHash = await writeContract(
          wagmiConfig,
          request as WriteContractParameters<TAbi, TFunctionName>,
        )
        setHash(txHash)
        setStatus('mining')
        const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: txHash })
        if (receipt.status === 'success') setStatus('confirmed')
        else setStatus('reverted')
        opts?.onMined?.()
        return receipt
      } catch (e: unknown) {
        setStatus('idle')
        const msg = normalizeErr(e)
        setError(msg)
        opts?.onError?.(msg)
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

