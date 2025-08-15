import BedActionIcon from './BedActionIcon'
import BedTimer from './BedTimer'
import BedTxStatus from './BedTxStatus'
import BedActionAnimation from './BedActionAnimation'
import React, { useEffect, useState } from 'react'
import type { GardenBed } from '../types/game'

function CropPicker({ index }: { index: number }) {
  const [bed, setBed] = useState<GardenBed | undefined>(() => (window as any).gameBridge?.getBed?.(index))
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [inventory, setInventory] = useState<Record<string, number>>({})
  const connected = Boolean((window as any).walletBridge?.getState?.()?.address)
  
  useEffect(() => {
    const onBedUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ index: number; bed: GardenBed }>
      if (ce.detail?.index !== index) return
      setBed(ce.detail.bed)
    }
    const onInventoryUpdate = (e: Event) => {
      const ce = e as CustomEvent<Record<string, number>>
      setInventory({ ...(ce.detail || {}) })
    }
    window.addEventListener('bed:update', onBedUpdate as EventListener)
    window.addEventListener('inventory:update', onInventoryUpdate as EventListener)
    // Initial inventory load
    const initial = (window as any).gameBridge?.getInventory?.() || {}
    setInventory({ ...initial })
    return () => {
      window.removeEventListener('bed:update', onBedUpdate as EventListener)
      window.removeEventListener('inventory:update', onInventoryUpdate as EventListener)
    }
  }, [index])

  const disabled = !connected || (bed?.stage !== 'empty')
  
  // Available crops based on purchased seeds (seeds are infinite after purchase)
  const availableCrops = [
    { key: 'wheat', emoji: '🌾', name: 'Wheat' }, // Always available
    ...(inventory.seed_tomato > 0 ? [{ key: 'tomato', emoji: '🍅', name: 'Tomato' }] : []),
    ...(inventory.seed_cucumber > 0 ? [{ key: 'cucumber', emoji: '🥒', name: 'Cucumber' }] : []),
    ...(inventory.seed_hops > 0 ? [{ key: 'hops', emoji: '🌿', name: 'Hops' }] : [])
  ] as const

  const onPick = (crop: 'wheat' | 'tomato' | 'cucumber' | 'hops') => {
    setIsMenuOpen(false)
    try {
      const evt = new CustomEvent('bed:setCrop', { detail: { index, crop } })
      window.dispatchEvent(evt)
    } catch {}
  }

  const toggleMenu = () => {
    if (!disabled) setIsMenuOpen(!isMenuOpen)
  }

  const currentCrop = bed?.crop || 'wheat'
  const currentEmoji = availableCrops.find(c => c.key === currentCrop)?.emoji || '🌾'

  if (disabled) return null

  return (
    <div className="crop-selector">
      <button 
        className="crop-selector-btn" 
        onClick={toggleMenu}
        aria-label="Select crop type"
      >
        <span className="current-crop">{currentEmoji}</span>
        <span className="arrow">⌄</span>
      </button>
      
      {isMenuOpen && (
        <>
          <div className="crop-menu-backdrop" onClick={() => setIsMenuOpen(false)} />
          <div className="crop-menu">
            {availableCrops.map((crop) => (
              <button
                key={crop.key}
                className={`crop-option ${crop.key === currentCrop ? 'selected' : ''}`}
                onClick={() => onPick(crop.key as any)}
              >
                <span className="crop-emoji">{crop.emoji}</span>
                {crop.key === currentCrop && <span className="check">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function BedOverlayBase({ index }: { index: number }) {
  return (
    <div className="bed-overlay">
      <div className="bed-left">
        <BedTxStatus index={index} />
      </div>
      <div className="bed-center">
        <BedActionIcon index={index} />
        <BedTimer index={index} />
      </div>
      <div className="bed-right">
        <CropPicker index={index} />
      </div>
      <BedActionAnimation index={index} />
    </div>
  )
}

const BedOverlay = React.memo(BedOverlayBase)
export default BedOverlay



