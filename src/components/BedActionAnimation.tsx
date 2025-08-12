import { useEffect, useState } from 'react'

type ActionKind = 'plant' | 'water' | 'harvest' | null

export default function BedActionAnimation({ index }: { index: number }) {
  const [kind, setKind] = useState<ActionKind>(null)

  useEffect(() => {
    const onAnimate = (e: Event) => {
      const ce = e as CustomEvent<{ index: number; action: ActionKind }>
      if (ce.detail?.index !== index) return
      setKind(ce.detail.action)
      const t = setTimeout(() => setKind(null), 1000)
      return () => clearTimeout(t)
    }
    window.addEventListener('action:animate', onAnimate as EventListener)
    return () => window.removeEventListener('action:animate', onAnimate as EventListener)
  }, [index])

  if (!kind) return null
  const className = kind === 'plant' ? 'action-animation seed-animation'
    : kind === 'water' ? 'action-animation water-animation'
    : 'action-animation harvest-animation'
  const emoji = kind === 'plant' ? '🌰' : kind === 'water' ? '💧' : '🔪'
  return <div className={className}>{emoji}</div>
}


