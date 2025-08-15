import React from 'react'
import { trackRpcPerformance } from './sentry'
import { isDeveloper } from '../utils/permissions'

interface RpcMetrics {
  endpoint: string
  requestCount: number
  totalTime: number
  errorCount: number
  lastError?: string
  lastSuccess?: number
  averageTime: number
}

class RpcMonitor {
  private metrics = new Map<string, RpcMetrics>()
  private healthCheckInterval?: number

  constructor() {
    // Start health monitoring
    this.startHealthCheck()
  }

  // Wrap RPC calls with monitoring
  async monitorRpcCall<T>(
    endpoint: string, 
    _operation: string,
    call: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now()
    let success = false
    
    try {
      const result = await call()
      success = true
      this.recordSuccess(endpoint, performance.now() - startTime)
      return result
    } catch (error) {
      this.recordError(endpoint, performance.now() - startTime, error)
      throw error
    } finally {
      // Track in Sentry
      trackRpcPerformance(endpoint, performance.now() - startTime, success)
    }
  }

  private recordSuccess(endpoint: string, duration: number) {
    const metrics = this.getOrCreateMetrics(endpoint)
    metrics.requestCount++
    metrics.totalTime += duration
    metrics.averageTime = metrics.totalTime / metrics.requestCount
    metrics.lastSuccess = Date.now()
  }

  private recordError(endpoint: string, duration: number, error: unknown) {
    const metrics = this.getOrCreateMetrics(endpoint)
    metrics.requestCount++
    metrics.errorCount++
    metrics.totalTime += duration
    metrics.averageTime = metrics.totalTime / metrics.requestCount
    metrics.lastError = error instanceof Error ? error.message : String(error)
  }

  private getOrCreateMetrics(endpoint: string): RpcMetrics {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, {
        endpoint,
        requestCount: 0,
        totalTime: 0,
        errorCount: 0,
        averageTime: 0,
      })
    }
    return this.metrics.get(endpoint)!
  }

  // Get health status of all endpoints
  getHealthStatus() {
    const now = Date.now()
    const results = Array.from(this.metrics.entries()).map(([endpoint, metrics]) => {
      const errorRate = metrics.requestCount > 0 ? metrics.errorCount / metrics.requestCount : 0
      const isHealthy = errorRate < 0.1 && metrics.averageTime < 5000 // < 10% errors, < 5s avg
      const lastSeenMinutes = metrics.lastSuccess ? (now - metrics.lastSuccess) / (1000 * 60) : null
      
      return {
        endpoint,
        isHealthy,
        errorRate: Math.round(errorRate * 100),
        averageTime: Math.round(metrics.averageTime),
        requestCount: metrics.requestCount,
        lastError: metrics.lastError,
        lastSeenMinutes: lastSeenMinutes ? Math.round(lastSeenMinutes) : null,
      }
    })

    return {
      timestamp: now,
      endpoints: results,
      overallHealth: results.length === 0 || results.every(r => r.isHealthy),
    }
  }

  // Periodic health check
  private startHealthCheck() {
    this.healthCheckInterval = window.setInterval(() => {
      const health = this.getHealthStatus()
      
      // Log health status
      console.log('RPC Health Check:', health)
      
      // Alert on unhealthy endpoints
      const unhealthy = health.endpoints.filter(e => !e.isHealthy)
      if (unhealthy.length > 0) {
        console.warn('Unhealthy RPC endpoints detected:', unhealthy)
        
        // Dispatch custom event for UI to handle
        window.dispatchEvent(new CustomEvent('rpc:unhealthy', {
          detail: { endpoints: unhealthy }
        }))
      }
      
      // Store metrics in localStorage for debugging
      try {
        localStorage.setItem('rpc_metrics', JSON.stringify(health))
      } catch {
        // Ignore storage errors
      }
    }, 30000) // Check every 30 seconds
  }

  // Clean up
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
  }

  // Reset metrics
  reset() {
    this.metrics.clear()
  }

  // Get specific endpoint metrics
  getEndpointMetrics(endpoint: string) {
    return this.metrics.get(endpoint)
  }
}

// Global instance
export const rpcMonitor = new RpcMonitor()

// Utility function to wrap Wagmi config with monitoring
export function createMonitoredTransport(url: string, options: any = {}) {
  return {
    ...options,
    request: async (params: any) => {
      return rpcMonitor.monitorRpcCall(
        url,
        params.method || 'unknown',
        () => {
          // Create standard HTTP transport
          const transport = typeof options.request === 'function' 
            ? options.request 
            : async (p: any) => {
                const response = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    ...p
                  })
                })
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return response.json()
              }
          return transport(params)
        }
      )
    }
  }
}

// React hook for RPC health status
export function useRpcHealth() {
  const [health, setHealth] = React.useState(rpcMonitor.getHealthStatus())

  React.useEffect(() => {
    const updateHealth = () => setHealth(rpcMonitor.getHealthStatus())
    
    // Update immediately
    updateHealth()
    
    // Listen for unhealthy events
    const handleUnhealthy = () => updateHealth()
    window.addEventListener('rpc:unhealthy', handleUnhealthy)
    
    // Update periodically
    const interval = setInterval(updateHealth, 10000) // Every 10 seconds
    
    return () => {
      window.removeEventListener('rpc:unhealthy', handleUnhealthy)
      clearInterval(interval)
    }
  }, [])

  return health
}

// Export for global access (only for developers)
declare global {
  interface Window {
    __rpcMonitor?: typeof rpcMonitor
  }
}

if (typeof window !== 'undefined') {
  // Only expose global monitoring for developers
  if (isDeveloper()) {
    window.__rpcMonitor = rpcMonitor
  }
}
