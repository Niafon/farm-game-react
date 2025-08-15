import { useEffect, useState } from 'react'

type Toast = { id: number; level: 'info' | 'warning' | 'error'; message: string }

export default function ToastBus() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => {
    let id = 1
    const add = (t: Omit<Toast, 'id'>) => setToasts((s) => [...s, { ...t, id: id++ }])
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ level?: string; message?: string }>
      const level = (ce.detail?.level as Toast['level']) || 'info'
      const message = ce.detail?.message || ''
      if (!message) return
      add({ level, message })
      setTimeout(() => setToasts((s) => s.slice(1)), 3500)
    }
    window.addEventListener('wallet:message', handler as EventListener)
    return () => window.removeEventListener('wallet:message', handler as EventListener)
  }, [])

  if (toasts.length === 0) return null
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.level}`}>{t.message}</div>
      ))}
    </div>
  )
}


