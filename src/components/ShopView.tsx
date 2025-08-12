import { useEffect, useState } from 'react'

declare global {
  interface Window {
    walletBridge?: { getState?: () => { address?: string } }
  }
}

export default function ShopView() {
  const [connected, setConnected] = useState<boolean>(false)

  useEffect(() => {
    const sync = () => setConnected(Boolean(window.walletBridge?.getState?.()?.address))
    sync()
    const onUpdate = () => sync()
    window.addEventListener('wallet:update', onUpdate)
    return () => window.removeEventListener('wallet:update', onUpdate)
  }, [])

  return (
    <div className="shop-items" aria-disabled={!connected}>
      <button id="exchange-wheat" className="btn" title={connected ? '' : 'Connect wallet to use this feature'}>
        Trade 10 wheat for 1 coin
      </button>
      <button id="buy-expansion" className="btn" title={connected ? '' : 'Connect wallet to use this feature'}>
        Buy expansion (100 coins)
      </button>
    </div>
  )
}



