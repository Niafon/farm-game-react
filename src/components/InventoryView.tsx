import React, { useEffect, useMemo, useState } from 'react'

type Inventory = Record<string, number>

// window types are declared globally in src/types/global.d.ts

function InventoryViewBase() {
  const [inventory, setInventory] = useState<Inventory>({})
  const [connected, setConnected] = useState<boolean>(false)

  useEffect(() => {
    const updateConnection = () => {
      const addr = window.walletBridge?.getState?.()?.address
      setConnected(Boolean(addr))
    }
    updateConnection()
    const onWallet = () => updateConnection()
    window.addEventListener('wallet:update', onWallet)
    return () => window.removeEventListener('wallet:update', onWallet)
  }, [])

  useEffect(() => {
    // Initial inventory from bridge if available
    const initial = (window as any).gameBridge?.getInventory?.() || {}
    setInventory({ ...initial })
    const onInventory = (e: Event) => {
      const ce = e as CustomEvent<Inventory>
      setInventory({ ...(ce.detail || {}) })
    }
    window.addEventListener('inventory:update', onInventory as EventListener)
    return () => window.removeEventListener('inventory:update', onInventory as EventListener)
  }, [])

  const items = useMemo(() => Object.entries(inventory).filter(([, n]) => (n || 0) > 0), [inventory])

  if (!connected) {
    return <p>Connect wallet to view inventory</p>
  }

  if (items.length === 0) {
    return <p>Inventory is empty</p>
  }

  return (
    <>
      {items.map(([name, count]) => (
        <div key={name} className="inventory-item">
          <span>{formatItemName(name)}</span>
          <span>{`x${count}`}</span>
        </div>
      ))}
    </>
  )
}

const InventoryView = React.memo(InventoryViewBase)
export default InventoryView

function formatItemName(item: string): string {
  switch (item) {
    case 'wheat':
      return '🌾 Wheat'
    case 'coins':
      return '💰 Coins'
    case 'seed_tomato':
      return '🍅 Tomato Seeds'
    case 'seed_cucumber':
      return '🥒 Cucumber Seeds'
    case 'seed_hops':
      return '🌿 Hops Seeds'
    case 'tomato':
      return '🍅 Tomato'
    case 'cucumber':
      return '🥒 Cucumber'
    case 'hops':
      return '🌿 Hops'
    case 'beer':
      return '🍺 Beer'
    default:
      return item
  }
}


