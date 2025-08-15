import { rpcMonitor, createMonitoredTransport } from '../../services/monitoring'

// Mock fetch for testing
global.fetch = jest.fn()

describe('RPC Monitoring', () => {
  beforeEach(() => {
    rpcMonitor.reset()
    jest.clearAllMocks()
  })

  describe('monitorRpcCall', () => {
    it('should record successful RPC call', async () => {
      const mockCall = jest.fn().mockResolvedValue('success')
      
      const result = await rpcMonitor.monitorRpcCall(
        'https://test.rpc',
        'eth_call',
        mockCall
      )

      expect(result).toBe('success')
      expect(mockCall).toHaveBeenCalledTimes(1)
      
      const metrics = rpcMonitor.getEndpointMetrics('https://test.rpc')
      expect(metrics?.requestCount).toBe(1)
      expect(metrics?.errorCount).toBe(0)
    })

    it('should record failed RPC call', async () => {
      const mockCall = jest.fn().mockRejectedValue(new Error('Network error'))
      
      await expect(
        rpcMonitor.monitorRpcCall('https://test.rpc', 'eth_call', mockCall)
      ).rejects.toThrow('Network error')
      
      const metrics = rpcMonitor.getEndpointMetrics('https://test.rpc')
      expect(metrics?.requestCount).toBe(1)
      expect(metrics?.errorCount).toBe(1)
      expect(metrics?.lastError).toBe('Network error')
    })

    it('should calculate average response time', async () => {
      const mockCall = jest.fn().mockResolvedValue('success')
      
      // Mock performance.now to control timing
      const mockNow = jest.spyOn(performance, 'now')
      mockNow.mockReturnValueOnce(0).mockReturnValueOnce(100) // 100ms duration
      
      await rpcMonitor.monitorRpcCall('https://test.rpc', 'eth_call', mockCall)
      
      const metrics = rpcMonitor.getEndpointMetrics('https://test.rpc')
      expect(metrics?.averageTime).toBe(100)
      
      mockNow.mockRestore()
    })
  })

  describe('getHealthStatus', () => {
    it('should return healthy status for good endpoints', async () => {
      const mockCall = jest.fn().mockResolvedValue('success')
      
      await rpcMonitor.monitorRpcCall('https://test.rpc', 'eth_call', mockCall)
      
      const health = rpcMonitor.getHealthStatus()
      expect(health.overallHealth).toBe(true)
      expect(health.endpoints[0].isHealthy).toBe(true)
      expect(health.endpoints[0].errorRate).toBe(0)
    })

    it('should return unhealthy status for bad endpoints', async () => {
      const mockCall = jest.fn().mockRejectedValue(new Error('Error'))
      
      // Create multiple failed requests to trigger unhealthy status
      for (let i = 0; i < 10; i++) {
        try {
          await rpcMonitor.monitorRpcCall('https://bad.rpc', 'eth_call', mockCall)
        } catch {}
      }
      
      const health = rpcMonitor.getHealthStatus()
      expect(health.overallHealth).toBe(false)
      expect(health.endpoints[0].isHealthy).toBe(false)
      expect(health.endpoints[0].errorRate).toBe(100)
    })
  })

  describe('createMonitoredTransport', () => {
    it('should wrap transport with monitoring', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: 'success' })
      })

      const transport = createMonitoredTransport('https://test.rpc')
      const result = await transport.request({ method: 'eth_call' })
      
      expect(result).toEqual({ result: 'success' })
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.rpc',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      )
    })

    it('should handle transport errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const transport = createMonitoredTransport('https://test.rpc')
      
      await expect(
        transport.request({ method: 'eth_call' })
      ).rejects.toThrow('HTTP 500')
    })
  })
})
