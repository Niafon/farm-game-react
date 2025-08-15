import { render, screen } from '@testing-library/react'
import { Web3ErrorBoundary } from '../../components/Web3ErrorBoundary'
import { isDeveloper } from '../../utils/permissions'
import React from 'react'

// Mock Sentry
jest.mock('@sentry/react', () => ({
  withScope: jest.fn((callback) => callback({ 
    setTag: jest.fn(), 
    setLevel: jest.fn(),
    setContext: jest.fn()
  })),
  captureException: jest.fn().mockReturnValue('event-id-123'),
  showReportDialog: jest.fn()
}))

// Mock isDeveloper
jest.mock('../../utils/permissions', () => ({
  isDeveloper: jest.fn().mockReturnValue(false)
}))

const ThrowError = ({ error }: { error?: Error }) => {
  if (error) {
    throw error
  }
  return <div>No error</div>
}

describe('Web3ErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should render children when no error occurs', () => {
    render(
      <Web3ErrorBoundary>
        <div>Test content</div>
      </Web3ErrorBoundary>
    )

    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('should render error UI when error occurs', () => {
    const error = new Error('Test error')
    
    render(
      <Web3ErrorBoundary>
        <ThrowError error={error} />
      </Web3ErrorBoundary>
    )

    expect(screen.getByText(/Что-то пошло не так/)).toBeInTheDocument()
    expect(screen.getByText(/Попробовать снова/)).toBeInTheDocument()
  })

  it('should show generic error message for production users', () => {
    const error = new Error('User rejected transaction')
    
    render(
      <Web3ErrorBoundary>
        <ThrowError error={error} />
      </Web3ErrorBoundary>
    )

    expect(screen.getByText(/Произошла техническая ошибка/)).toBeInTheDocument()
  })

  it('should show error details for developers', () => {
    ;(isDeveloper as jest.Mock).mockReturnValue(true)
    
    const error = new Error('Network request failed')
    
    render(
      <Web3ErrorBoundary>
        <ThrowError error={error} />
      </Web3ErrorBoundary>
    )

    expect(screen.getAllByText('Network request failed')).toHaveLength(2) // In p and pre
  })

  it('should show reset button in developer mode', () => {
    ;(isDeveloper as jest.Mock).mockReturnValue(true)
    const error = new Error('Test error')
    
    render(
      <Web3ErrorBoundary>
        <ThrowError error={error} />
      </Web3ErrorBoundary>
    )

    // Error boundary should show error UI
    expect(screen.getByText(/Что-то пошло не так/)).toBeInTheDocument()
    expect(screen.getByText(/Попробовать снова/)).toBeInTheDocument()
    expect(screen.getByText(/Сообщить об ошибке/)).toBeInTheDocument()
  })

  it('should provide error details when developer mode is enabled', () => {
    ;(isDeveloper as jest.Mock).mockReturnValue(true)
    
    const error = new Error('Detailed error message')
    
    render(
      <Web3ErrorBoundary>
        <ThrowError error={error} />
      </Web3ErrorBoundary>
    )

    expect(screen.getAllByText('Detailed error message')).toHaveLength(2) // Once in p, once in pre
  })

  it('should hide error details when not in developer mode', () => {
    ;(isDeveloper as jest.Mock).mockReturnValue(false)
    
    const error = new Error('Sensitive error details')
    
    render(
      <Web3ErrorBoundary>
        <ThrowError error={error} />
      </Web3ErrorBoundary>
    )

    expect(screen.queryByText('Sensitive error details')).not.toBeInTheDocument()
    expect(screen.getByText(/Произошла техническая ошибка/)).toBeInTheDocument()
  })
})
