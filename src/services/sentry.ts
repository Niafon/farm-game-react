import * as Sentry from '@sentry/react'
import { getEnvVar, getMode } from '../utils/env'

export function initSentry() {
  const dsn = getEnvVar('VITE_SENTRY_DSN')
  if (!dsn) {
    console.warn('Sentry DSN not configured, error tracking disabled')
    return
  }

  Sentry.init({
    dsn,
    environment: getMode(),
    integrations: [
      // Basic browser integrations without tracing to avoid compatibility issues
    ],
    
    // Performance monitoring
    tracesSampleRate: getMode() === 'production' ? 0.1 : 1.0,
    
    // Error filtering
    beforeSend(event, hint) {
      // Filter out user-cancelled transactions
      const error = hint.originalException
      if (error && typeof error === 'object' && 'code' in error) {
        // Don't send user rejection errors to Sentry
        if ((error as any).code === 4001) return null
        // Don't send network errors that are expected
        if ((error as any).code === -32002) return null
      }
      return event
    },

    // Release tracking
    release: getEnvVar('VITE_APP_VERSION') || 'unknown',

    // User context
    initialScope: {
      tags: {
        component: 'farm-game-web3',
      },
    },
  })
}

// Custom error tracking for Web3 operations
export function trackWeb3Error(error: unknown, context: {
  operation: string
  address?: string
  chainId?: string
  txHash?: string
}) {
  Sentry.withScope((scope) => {
    scope.setTag('error_type', 'web3')
    scope.setTag('operation', context.operation)
    if (context.address) scope.setUser({ id: context.address })
    if (context.chainId) scope.setTag('chain_id', context.chainId)
    if (context.txHash) scope.setTag('tx_hash', context.txHash)
    
    Sentry.captureException(error)
  })
}

// Track wallet connection events
export function trackWalletEvent(event: 'connect_attempt' | 'connect_success' | 'connect_failed' | 'disconnect', data?: {
  walletType?: string
  chainId?: string
  error?: string
}) {
  Sentry.addBreadcrumb({
    category: 'wallet',
    message: event,
    level: event.includes('failed') ? 'error' : 'info',
    data,
  })

  // Track as custom event for analytics
  if (event === 'connect_failed') {
    Sentry.withScope((scope) => {
      scope.setTag('event_type', 'wallet_connection')
      scope.setLevel('warning')
      Sentry.captureMessage(`Wallet connection failed: ${data?.error || 'Unknown error'}`)
    })
  }
}

// Track RPC performance
export function trackRpcPerformance(endpoint: string, duration: number, success: boolean) {
  Sentry.addBreadcrumb({
    category: 'rpc',
    message: `RPC call to ${endpoint}`,
    level: success ? 'info' : 'error',
    data: {
      endpoint,
      duration,
      success,
    },
  })

  // Track slow RPC calls
  if (duration > 5000) { // > 5 seconds
    Sentry.withScope((scope) => {
      scope.setTag('performance_issue', 'slow_rpc')
      scope.setTag('rpc_endpoint', endpoint)
      scope.setLevel('warning')
      Sentry.captureMessage(`Slow RPC response: ${endpoint} took ${duration}ms`)
    })
  }
}

// Track game state errors
export function trackGameStateError(error: unknown, context: {
  action: string
  bedIndex?: number
  gameState?: any
}) {
  Sentry.withScope((scope) => {
    scope.setTag('error_type', 'game_state')
    scope.setTag('game_action', context.action)
    if (context.bedIndex !== undefined) scope.setTag('bed_index', context.bedIndex.toString())
    if (context.gameState) scope.setContext('game_state', context.gameState)
    
    Sentry.captureException(error)
  })
}

// Performance mark helpers
export function startPerformanceMark(name: string) {
  if (typeof performance !== 'undefined') {
    performance.mark(`${name}-start`)
  }
}

export function endPerformanceMark(name: string) {
  if (typeof performance !== 'undefined') {
    performance.mark(`${name}-end`)
    try {
      performance.measure(name, `${name}-start`, `${name}-end`)
      const measure = performance.getEntriesByName(name, 'measure')[0]
      if (measure && measure.duration > 1000) { // > 1 second
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Slow operation: ${name}`,
          level: 'warning',
          data: { duration: measure.duration },
        })
      }
      } catch {
    // Ignore measurement errors
  }
  }
}
