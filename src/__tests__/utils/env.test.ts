import { getEnvVar, getMode, isDevelopment, isProduction } from '../../utils/env'

describe('Environment Utilities', () => {
  const originalProcess = process
  const originalWindow = global.window

  beforeEach(() => {
    // Reset environment
    delete (global as any).process
    delete (global as any).window
  })

  afterEach(() => {
    global.process = originalProcess
    global.window = originalWindow
  })

  describe('getEnvVar', () => {
    it('should get environment variable from process.env', () => {
      global.process = { env: { TEST_VAR: 'test-value' } } as any
      
      const result = getEnvVar('TEST_VAR')
      expect(result).toBe('test-value')
    })

    it('should return undefined for missing variables', () => {
      global.process = { env: {} } as any
      
      const result = getEnvVar('MISSING_VAR')
      expect(result).toBeUndefined()
    })

    it('should fallback to import.meta in browser environment', () => {
      // Simulate browser environment without process
      delete (global as any).process
      
      // Mock eval to simulate import.meta
      const mockEval = jest.fn().mockReturnValue({
        env: { VITE_TEST: 'vite-value' }
      })
      global.eval = mockEval as any
      
      const result = getEnvVar('VITE_TEST')
      expect(result).toBe('vite-value')
    })

    it('should handle import.meta errors gracefully', () => {
      delete (global as any).process
      
      // Mock eval to throw error
      global.eval = jest.fn().mockImplementation(() => {
        throw new Error('import.meta not available')
      }) as any
      
      const result = getEnvVar('ANY_VAR')
      expect(result).toBeUndefined()
    })
  })

  describe('getMode', () => {
    it('should return MODE environment variable', () => {
      global.process = { env: { MODE: 'test' } } as any
      
      const result = getMode()
      expect(result).toBe('test')
    })

    it('should fallback to NODE_ENV', () => {
      global.process = { env: { NODE_ENV: 'production' } } as any
      
      const result = getMode()
      expect(result).toBe('production')
    })

    it('should default to development', () => {
      global.process = { env: {} } as any
      
      const result = getMode()
      expect(result).toBe('development')
    })
  })

  describe('isDevelopment', () => {
    it('should return true for development mode', () => {
      global.process = { env: { NODE_ENV: 'development' } } as any
      
      const result = isDevelopment()
      expect(result).toBe(true)
    })

    it('should return true for dev mode', () => {
      global.process = { env: { MODE: 'dev' } } as any
      
      const result = isDevelopment()
      expect(result).toBe(true)
    })

    it('should return false for production', () => {
      global.process = { env: { NODE_ENV: 'production' } } as any
      
      const result = isDevelopment()
      expect(result).toBe(false)
    })
  })

  describe('isProduction', () => {
    it('should return true for production mode', () => {
      global.process = { env: { NODE_ENV: 'production' } } as any
      
      const result = isProduction()
      expect(result).toBe(true)
    })

    it('should return true for prod mode', () => {
      global.process = { env: { MODE: 'prod' } } as any
      
      const result = isProduction()
      expect(result).toBe(true)
    })

    it('should return false for development', () => {
      global.process = { env: { NODE_ENV: 'development' } } as any
      
      const result = isProduction()
      expect(result).toBe(false)
    })
  })
})
