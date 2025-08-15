import { useEffect, useMemo, useState } from 'react'
type PublicEnv = {
  CONTRACT_ADDRESS?: string
  MONAD_CHAIN_NAME?: string
  MONAD_CHAIN_ID?: string
  MONAD_RPC_URL?: string
}

export default function WalletPanel() {
  const [state, setState] = useState<any>(() => (window as any).walletBridge?.getState?.())

  useEffect(() => {
    const onUpdate = () => setState((window as any).walletBridge?.getState?.())
    window.addEventListener('wallet:update', onUpdate)
    return () => {
      window.removeEventListener('wallet:update', onUpdate)
    }
  }, [])

  const short = useMemo(() => {
    const addr = state?.address as string | undefined
    if (!addr) return '—'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }, [state?.address])

  const displayBalance = useMemo(() => {
    const bal = state?.balanceWei as unknown
    if (typeof bal === 'bigint') {
      const denom = 10n ** 18n
      const whole = bal / denom
      const frac = bal % denom
      const value = Number(whole) + Number(frac) / Number(denom)
      return value.toFixed(4)
    }
    return '—'
  }, [state?.balanceWei])

  const shortContract = useMemo(() => {
    const env = (window as unknown as { __ENV__?: PublicEnv }).__ENV__ || {}
    const addr = env.CONTRACT_ADDRESS || ''
    if (!addr || /^0x0{40}$/i.test(addr)) return '—'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }, [])

  const chainLabel = useMemo(() => {
    const env = (window as unknown as { __ENV__?: PublicEnv }).__ENV__ || {}
    const idRaw = (env.MONAD_CHAIN_ID || '').toString()
    const id = idRaw.startsWith('0x') ? parseInt(idRaw, 16) : parseInt(idRaw || '0', 10)
    const name = env.MONAD_CHAIN_NAME || 'Monad'
    return id ? `${name} (${id})` : name
  }, [])

  const rpcHost = useMemo(() => {
    const env = (window as unknown as { __ENV__?: PublicEnv }).__ENV__ || {}
    try {
      const url = new URL(env.MONAD_RPC_URL || '')
      return url.host
    } catch {
      return env.MONAD_RPC_URL || '—'
    }
  }, [])

  return (
    <div className="wallet-panel" id="wallet-panel" aria-hidden={!state?.address ? 'true' : 'false'}>
      <div className="wallet-row">
        <span>Address:</span>
        <span id="wallet-address" aria-label="Wallet address">{short}</span>
      </div>
      <div className="wallet-row">
        <span>Balance:</span>
        <span id="wallet-balance" aria-label="Wallet balance">{displayBalance}</span>
      </div>
      <div className="wallet-row">
        <span>Chain:</span>
        <span aria-label="Chain info">{chainLabel}</span>
      </div>
      <div className="wallet-row">
        <span>RPC:</span>
        <span aria-label="RPC host">{rpcHost}</span>
      </div>
      <div className="wallet-row">
        <span>Contract:</span>
        <span aria-label="Contract address">{shortContract}</span>
      </div>
      <div className="wallet-actions">
        <button
          id="wallet-disconnect"
          aria-label="Disconnect or switch wallet"
          onClick={(e) => {
            e.preventDefault()
            try { window.dispatchEvent(new CustomEvent('rk:openConnect')) } catch {}
          }}
        >Wallet</button>
        <button
          id="wallet-logout"
          aria-label="Logout session"
          onClick={async (e) => {
            e.preventDefault()
            try {
              await fetch('/siwe/logout', { method: 'POST', credentials: 'include' })
              const evt = new CustomEvent('wallet:message', { detail: { level: 'info', message: 'Logged out' } })
              window.dispatchEvent(evt)
            } catch {}
          }}
        >Logout</button>
      </div>
    </div>
  )
}


