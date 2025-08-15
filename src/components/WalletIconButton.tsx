import { useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useConnectModal, useAccountModal } from '@rainbow-me/rainbowkit'

export default function WalletIconButton() {
  const { isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { openAccountModal } = useAccountModal()

  const onClick = useCallback(() => {
    if (isConnected) openAccountModal?.()
    else openConnectModal?.()
  }, [isConnected, openConnectModal, openAccountModal])

  return (
    <button className="wallet-connect" id="wallet-connect" aria-label="Connect wallet" onClick={onClick}>
      👛
    </button>
  )
}


