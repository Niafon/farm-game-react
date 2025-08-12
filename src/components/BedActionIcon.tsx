import { useEffect, useMemo, useState } from 'react'
import type { GardenBed, BedAction } from '../types/game'
import { BedAction as BedActionConst } from '../types/game'
import { deriveNextAction } from '../utils/bed'

type ActionOrNull = BedAction | null

declare global {
  interface Window {
    gameBridge?: {
      getBed?: (index: number) => GardenBed | undefined
      performAction?: (index: number) => void
    }
  }
}

function actionEmoji(action: BedAction | null): string {
  switch (action) {
    case BedActionConst.Plant: return '🌰'
    case BedActionConst.Water: return '💧'
    case BedActionConst.Harvest: return '🔪'
    default: return ''
  }
}

export default function BedActionIcon({ index }: { index: number }) {
  const [bed, setBed] = useState<GardenBed | undefined>(() => window.gameBridge?.getBed?.(index))

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ index: number; bed: GardenBed }>
      if (ce.detail?.index === index) {
        setBed(ce.detail.bed)
      }
    }
    window.addEventListener('bed:update', handler as EventListener)
    return () => window.removeEventListener('bed:update', handler as EventListener)
  }, [index])

  const next = useMemo<ActionOrNull>(() => deriveNextAction(bed), [bed])
  if (!next) return null

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const addr = (window as any).walletBridge?.getState?.()?.address as string | undefined
    if (!addr) return
    window.gameBridge?.performAction?.(index)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      const addr = (window as any).walletBridge?.getState?.()?.address as string | undefined
      if (!addr) return
      window.gameBridge?.performAction?.(index)
    }
  }

  return (
    <div
      className="action-icon"
      role="button"
      tabIndex={0}
      aria-label={next === BedActionConst.Plant ? 'Plant seed' : next === BedActionConst.Water ? 'Water plant' : 'Harvest crop'}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {actionEmoji(next)}
    </div>
  )
}


