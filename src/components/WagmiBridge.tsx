import { useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useConnectModal, useAccountModal } from '@rainbow-me/rainbowkit'

export default function WagmiBridge() {
  const { address, status } = useAccount()
  const chainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { openAccountModal } = useAccountModal()

  useEffect(() => {
    ;(window as any).walletBridge = {
      ...(window as any).walletBridge,
      getState: () => ({ address, chainId }),
    }
    try {
      const evt = new CustomEvent('wallet:update')
      window.dispatchEvent(evt)
    } catch {}
  }, [address, chainId, status])

  useEffect(() => {
    const handler = () => {
      if (address) openAccountModal?.()
      else openConnectModal?.()
    }
    const handlerConnectOnly = () => openConnectModal?.()
    const handlerAccountOnly = () => openAccountModal?.()
    window.addEventListener('rk:openConnect', handler)
    window.addEventListener('rk:openConnectOnly', handlerConnectOnly)
    window.addEventListener('rk:openAccount', handlerAccountOnly)
    return () => {
      window.removeEventListener('rk:openConnect', handler)
      window.removeEventListener('rk:openConnectOnly', handlerConnectOnly)
      window.removeEventListener('rk:openAccount', handlerAccountOnly)
    }
  }, [address, openConnectModal, openAccountModal])

  return null
}


