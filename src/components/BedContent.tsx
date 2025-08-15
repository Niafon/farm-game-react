import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { GardenBed } from '../types/game'
import { BedStage } from '../types/game'
import { deriveNextAction, plantEmoji, getPlantAriaLabel } from '../utils/bed'

function BedContentBase({ index }: { index: number }) {
  const [bed, setBed] = useState<GardenBed | undefined>(() => (window as any).gameBridge?.getBed?.(index))

  useEffect(() => {
    const onBedUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ index: number; bed: GardenBed }>
      if (ce.detail?.index !== index) return
      setBed(ce.detail.bed)
    }
    window.addEventListener('bed:update', onBedUpdate as EventListener)
    return () => window.removeEventListener('bed:update', onBedUpdate as EventListener)
  }, [index])

  const next = useMemo(() => deriveNextAction(bed), [bed])

  const isActionAllowed = useMemo((): boolean => {
    if (!bed) return false
    if (!next) return false
    if (bed.isActionInProgress) return false
    if (bed.stage === BedStage.Ready) return true
    return !bed.timerActive
  }, [bed, next])

  const onActivate = useCallback(() => {
    // If wallet is not connected, show the same toast as shop
    const addr = (window as any).walletBridge?.getState?.()?.address as string | undefined
    if (!addr) {
      try { (window as any).gameBridge?.showToast?.('Connect wallet to use this feature') } catch {}
      return
    }
    if (!isActionAllowed) return
    ;(window as any).gameBridge?.performAction?.(index)
  }, [index, isActionAllowed])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && isActionAllowed) {
      e.preventDefault()
      onActivate()
    }
  }

  return (
    <>
      <div className="bed-ascii">{`+----------------------------+\n|                            |\n|   ~~~~~~~~~~~~~~~~~~~~~~   |\n|   ~~~~~~~~~~~~~~~~~~~~~~   |\n|   ~~~~~~~~~~~~~~~~~~~~~~   |\n|   ~~~~~~~~~~~~~~~~~~~~~~   |\n|   ~~~~~~~~~~~~~~~~~~~~~~   |\n|                            |\n+----------------------------+`}</div>
      <div
        className="plant"
        role="button"
        tabIndex={0}
        aria-label={getPlantAriaLabel((bed?.stage ?? BedStage.Empty) as BedStage, next)}
        onClick={onActivate}
        onKeyDown={onKeyDown}
      >
        {plantEmoji((bed?.stage ?? BedStage.Empty) as BedStage)}
      </div>
    </>
  )
}

const BedContent = React.memo(BedContentBase)
export default BedContent


