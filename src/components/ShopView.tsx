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
      <button id="buy-well" className="btn" title={connected ? '' : 'Connect wallet to use this feature'}>
        Buy Well (50 coins) — faster watering
      </button>
      <button id="buy-fertilizer" className="btn" title={connected ? '' : 'Connect wallet to use this feature'}>
        Buy Fertilizer (200 coins) — x2 harvest
      </button>
      <hr />
      <button id="buy-seed-tomato" className="btn" title={connected ? '' : 'Connect wallet to use this feature'}>
        Buy Tomato Seeds (10 coins)
      </button>
      <button id="buy-seed-cucumber" className="btn" title={connected ? '' : 'Connect wallet to use this feature'}>
        Buy Cucumber Seeds (12 coins)
      </button>
      <button id="buy-seed-hops" className="btn" title={connected ? '' : 'Connect wallet to use this feature'}>
        Buy Hops Seeds (25 coins)
      </button>
      <button id="buy-brewing-machine" className="btn" title={connected ? '' : 'Connect wallet to use this feature'}>
        Buy Brewing Machine (150 coins)
      </button>
      <hr />
      <button id="sell-tomato" className="btn" title={connected ? '' : 'Connect wallet to use this feature'}>
        Sell Tomatoes (x1 → 3 coins)
      </button>
      <button id="sell-cucumber" className="btn" title={connected ? '' : 'Connect wallet to use this feature'}>
        Sell Cucumbers (x1 → 2 coins)
      </button>
    </div>
  )
}



