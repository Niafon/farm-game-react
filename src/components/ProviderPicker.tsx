import { useEffect, useMemo, useState } from 'react'

type ProviderInfo = { uuid: string; name: string; icon: string; rdns?: string }

export default function ProviderPicker() {
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null)
  const visible = useMemo(() => Array.isArray(providers) && providers.length > 1, [providers])

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ providers: ProviderInfo[] }>
      if (!ce?.detail?.providers) return
      setProviders(ce.detail.providers)
    }
    window.addEventListener('wallet:providers', handler as EventListener)
    return () => window.removeEventListener('wallet:providers', handler as EventListener)
  }, [])

  if (!visible) return null
  return (
    <div className="provider-picker-overlay" role="dialog" aria-modal="true">
      <div className="provider-picker">
        <h3>Выберите кошелёк</h3>
        <ul>
          {providers!.map((p) => (
            <li key={p.uuid}>
              <button
                onClick={() => {
                  try {
                    const evt = new CustomEvent('wallet:pickProvider', { detail: { uuid: p.uuid } })
                    window.dispatchEvent(evt)
                  } catch {}
                  setProviders(null)
                }}
              >
                <img src={p.icon} alt="" width={20} height={20} />
                <span>{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="close" onClick={() => setProviders(null)}>Отмена</button>
      </div>
    </div>
  )
}


