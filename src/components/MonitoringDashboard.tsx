import { useState, useEffect } from 'react'
import { useRpcHealth } from '../services/monitoring'
import { isAdmin } from '../utils/permissions'

interface MonitoringDashboardProps {
  isVisible?: boolean
  onToggle?: (visible: boolean) => void
}

export function MonitoringDashboard({ isVisible = false, onToggle }: MonitoringDashboardProps) {
  const health = useRpcHealth()
  const [walletStats, setWalletStats] = useState({
    attempts: 0,
    successes: 0,
    failures: 0,
    lastFailure: null as string | null
  })

  // Listen for wallet events to update stats
  useEffect(() => {
    const stats = JSON.parse(localStorage.getItem('wallet_stats') || '{"attempts":0,"successes":0,"failures":0,"lastFailure":null}')
    setWalletStats(stats)

    const updateStats = (event: CustomEvent) => {
      const { type, error } = event.detail || {}
      const newStats = { ...stats }
      
      if (type === 'connect_attempt') {
        newStats.attempts++
      } else if (type === 'connect_success') {
        newStats.successes++
      } else if (type === 'connect_failed') {
        newStats.failures++
        newStats.lastFailure = error || 'Unknown error'
      }
      
      setWalletStats(newStats)
      localStorage.setItem('wallet_stats', JSON.stringify(newStats))
    }

    window.addEventListener('wallet:stats' as any, updateStats)
    return () => window.removeEventListener('wallet:stats' as any, updateStats)
  }, [])

  // Only show monitoring for admins
  if (!isAdmin()) {
    return null // Hide completely from regular users
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => onToggle?.(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: health.overallHealth ? '#22c55e' : '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          cursor: 'pointer',
          fontSize: '20px',
          zIndex: 1000,
          opacity: 0.7, // Make it less prominent
        }}
        title="Developer Monitoring Dashboard"
      >
        🔧
      </button>
    )
  }

  const successRate = walletStats.attempts > 0 
    ? Math.round((walletStats.successes / walletStats.attempts) * 100) 
    : 0

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '16px',
      borderRadius: '8px',
      minWidth: '300px',
      maxWidth: '400px',
      fontSize: '12px',
      zIndex: 1000,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>Developer Dashboard</h3>
        <button
          onClick={() => onToggle?.(false)}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      {/* Overall Status */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px',
          background: health.overallHealth ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          borderRadius: '4px'
        }}>
          <span style={{ marginRight: '8px', fontSize: '16px' }}>
            {health.overallHealth ? '✅' : '❌'}
          </span>
          <span>
            System {health.overallHealth ? 'Healthy' : 'Issues Detected'}
          </span>
        </div>
      </div>

      {/* Wallet Stats */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Wallet Connections</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div>Success Rate: <strong>{successRate}%</strong></div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>
              {walletStats.successes}/{walletStats.attempts} attempts
            </div>
          </div>
          <div>
            <div>Failures: <strong>{walletStats.failures}</strong></div>
            {walletStats.lastFailure && (
              <div style={{ fontSize: '10px', opacity: 0.8, color: '#ef4444' }}>
                Last: {walletStats.lastFailure.slice(0, 30)}...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RPC Endpoints */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>RPC Endpoints</h4>
        {health.endpoints.length === 0 ? (
          <div style={{ opacity: 0.6 }}>No RPC calls yet</div>
        ) : (
          health.endpoints.map((endpoint, index) => (
            <div key={index} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              borderBottom: index < health.endpoints.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
                  {endpoint.endpoint.replace('https://', '').split('/')[0]}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>
                  {endpoint.requestCount} calls • {endpoint.averageTime}ms avg
                  {endpoint.lastSeenMinutes && ` • ${endpoint.lastSeenMinutes}m ago`}
                </div>
              </div>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: endpoint.isHealthy ? '#22c55e' : '#ef4444'
              }} />
            </div>
          ))
        )}
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: '11px' }}>Debug Info</summary>
            <pre style={{ fontSize: '10px', margin: '4px 0 0 0', overflow: 'auto', maxHeight: '100px' }}>
              {JSON.stringify(health, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}

// Hook to manage dashboard visibility
// eslint-disable-next-line react-refresh/only-export-components
export function useMonitoringDashboard() {
  const [isVisible, setIsVisible] = useState(false)

  // Show dashboard on key combination (Ctrl+Shift+D for Developer)
  useEffect(() => {
    if (!isAdmin()) return

    const handleKeyPress = (e: KeyboardEvent) => {
      // Changed to Ctrl+Shift+D (Developer) - less obvious for users
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setIsVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  // Auto-show on critical issues (only for developers)
  const health = useRpcHealth()
  useEffect(() => {
    if (!isAdmin()) return
    
    if (!health.overallHealth && health.endpoints.some(e => !e.isHealthy)) {
      setIsVisible(true)
    }
  }, [health])

  return {
    isVisible,
    setIsVisible,
    health
  }
}
