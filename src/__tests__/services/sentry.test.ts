import * as Sentry from '@sentry/react'
import { 
  trackWalletEvent, 
  trackWeb3Error, 
  trackRpcPerformance,
  startPerformanceMark,
  endPerformanceMark
} from '../../services/sentry'

// Mock Sentry
jest.mock('@sentry/react', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  withScope: jest.fn((callback) => callback({ 
    setTag: jest.fn(), 
    setContext: jest.fn(), 
    setLevel: jest.fn(),
    setUser: jest.fn()
  }))
}))

describe('Sentry Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('trackWalletEvent', () => {
    it('should track wallet connection attempt', () => {
      trackWalletEvent('connect_attempt')
      
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'wallet',
        message: 'connect_attempt',
        level: 'info',
        data: undefined
      })
    })

    it('should track wallet connection success with data', () => {
      trackWalletEvent('connect_success', { walletType: 'metamask', chainId: '0x27d7' })
      
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'wallet',
        message: 'connect_success',
        level: 'info',
        data: { walletType: 'metamask', chainId: '0x27d7' }
      })
    })

    it('should track wallet errors', () => {
      trackWalletEvent('connect_failed', { error: 'User rejected' })
      
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'wallet',
        message: 'connect_failed',
        level: 'error',
        data: { error: 'User rejected' }
      })
    })
  })

  describe('trackWeb3Error', () => {
    it('should capture Web3 errors with context', () => {
      const error = new Error('Transaction failed')
      const context = { 
        operation: 'harvest',
        address: '0x123...',
        txHash: '0xabc...'
      }

      trackWeb3Error(error, context)

      expect(Sentry.withScope).toHaveBeenCalled()
      expect(Sentry.captureException).toHaveBeenCalledWith(error)
    })

    it('should capture user rejection errors (trackWeb3Error always captures)', () => {
      const error = new Error('User rejected transaction')
      Object.assign(error, { code: 4001 })
      
      trackWeb3Error(error, { operation: 'test' })

      expect(Sentry.captureException).toHaveBeenCalledWith(error)
    })
  })

  describe('trackRpcPerformance', () => {
    it('should track RPC performance metrics', () => {
      trackRpcPerformance('https://rpc.example.com', 150, true)
      
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'rpc',
        message: 'RPC call to https://rpc.example.com',
        level: 'info',
        data: {
          endpoint: 'https://rpc.example.com',
          duration: 150,
          success: true
        }
      })
    })

    it('should track slow RPC calls as warnings', () => {
      trackRpcPerformance('https://rpc.example.com', 6000, true)
      
      // Should call addBreadcrumb for the regular RPC call
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'rpc',
        message: 'RPC call to https://rpc.example.com',
        level: 'info',
        data: {
          endpoint: 'https://rpc.example.com',
          duration: 6000,
          success: true
        }
      })
      
      // Should also capture message for slow RPC
      expect(Sentry.withScope).toHaveBeenCalled()
      expect(Sentry.captureMessage).toHaveBeenCalledWith('Slow RPC response: https://rpc.example.com took 6000ms')
    })

    it('should track failed RPC calls', () => {
      trackRpcPerformance('https://rpc.example.com', 1000, false)
      
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'rpc',
        message: 'RPC call to https://rpc.example.com',
        level: 'error',
        data: {
          endpoint: 'https://rpc.example.com',
          duration: 1000,
          success: false
        }
      })
    })
  })

  describe('Performance Marking', () => {
    beforeEach(() => {
      // Mock performance API
      Object.defineProperty(global, 'performance', {
        value: {
          mark: jest.fn(),
          measure: jest.fn(),
          getEntriesByName: jest.fn().mockReturnValue([{ duration: 1500 }])
        },
        writable: true
      })
    })

    it('should start performance marking', () => {
      startPerformanceMark('complex-operation')
      
      expect(performance.mark).toHaveBeenCalledWith('complex-operation-start')
    })

    it('should end performance marking and log slow operations', () => {
      startPerformanceMark('slow-operation')
      endPerformanceMark('slow-operation')
      
      expect(performance.mark).toHaveBeenCalledWith('slow-operation-end')
      expect(performance.measure).toHaveBeenCalledWith(
        'slow-operation',
        'slow-operation-start',
        'slow-operation-end'
      )
      
      // Should log slow operation (>1000ms)
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'performance',
        message: 'Slow operation: slow-operation',
        level: 'warning',
        data: { duration: 1500 }
      })
    })

    it('should not log fast operations', () => {
      ;(performance.getEntriesByName as jest.Mock).mockReturnValueOnce([{ duration: 500 }])
      
      startPerformanceMark('fast-operation')
      endPerformanceMark('fast-operation')
      
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'performance'
        })
      )
    })
  })
})
