import { useEffect, useMemo, useState } from 'react'
import type { GardenBed } from '../types/game'
import { calculateTimeLeft, formatTime } from '../utils/time'

export default function BedTimer({ index }: { index: number }) {
  const [endTime, setEndTime] = useState<number | undefined>(undefined)
  const [ended, setEnded] = useState<boolean>(false)

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ index: number; bed: GardenBed }>
      if (ce.detail?.index !== index) return
      const bed = ce.detail.bed
      if (bed?.timerActive && typeof bed.timerEnd === 'number') {
        setEndTime(bed.timerEnd)
      } else {
        setEndTime(undefined)
      }
    }
    window.addEventListener('bed:update', handler as EventListener)
    // initialize from bridge if available
    const current = (window as any).gameBridge?.getBed?.(index) as GardenBed | undefined
    if (current?.timerActive && typeof current.timerEnd === 'number') {
      setEndTime(current.timerEnd)
    }
    return () => window.removeEventListener('bed:update', handler as EventListener)
  }, [index])

  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (!endTime) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [endTime])

  const label = useMemo(() => {
    if (!endTime) return ''
    return formatTime(calculateTimeLeft(endTime))
  }, [endTime, now])

  useEffect(() => {
    if (!endTime) return
    if (now >= endTime && !ended) {
      setEnded(true)
      const evt = new CustomEvent('timer:end', { detail: { index } })
      window.dispatchEvent(evt)
    }
  }, [now, endTime, ended, index])

  if (!endTime) return null
  return (
    <div className="timer" aria-live="polite">
      {label}
    </div>
  )
}


