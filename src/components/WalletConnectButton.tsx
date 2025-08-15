import { useEffect } from 'react'
import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId } from 'wagmi'

export default function WalletConnectButton() {
  const { address, status } = useAccount()
  const chainId = useChainId()
  const { openConnectModal } = useConnectModal()

  useEffect(() => {
    // Push wagmi state into legacy bridge for game engine
    const evt = new CustomEvent('wallet:update')
    window.dispatchEvent(evt)
    // Optionally: more detailed syncing could be implemented here
    // but most logic is handled inside WalletProvider already
  }, [address, status, chainId])

  useEffect(() => {
    const handler = () => openConnectModal?.()
    window.addEventListener('rk:openConnect', handler)
    return () => window.removeEventListener('rk:openConnect', handler)
  }, [openConnectModal])

  return <ConnectButton />
}


