import { useEffect, useState } from 'react'

export default function WalletPanel() {
  const [, setState] = useState<any>(() => (window as any).walletBridge?.getState?.())

  useEffect(() => {
    const onUpdate = () => setState((window as any).walletBridge?.getState?.())
    window.addEventListener('wallet:update', onUpdate)
    return () => window.removeEventListener('wallet:update', onUpdate)
  }, [])

  // Keep state sync for external consumers but render nothing per requirements
  // Network switch disabled by design

  // No separate menu; component still renders hidden panel hooks for addresses/balance if needed
  return null
}


