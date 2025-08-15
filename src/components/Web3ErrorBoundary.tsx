import React from 'react'
import * as Sentry from '@sentry/react'
import { isDeveloper } from '../utils/permissions'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; message?: string; eventId?: string }

export class Web3ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Web3 error:', error)
    
    // Capture error in Sentry with additional context
    const eventId = Sentry.withScope((scope) => {
      scope.setTag('error_boundary', 'web3')
      scope.setLevel('error')
      scope.setContext('error_info', {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'Web3ErrorBoundary'
      })
      return Sentry.captureException(error)
    })
    
    this.setState({ eventId })
  }
  render() {
    if (this.state.hasError) {
      const devMode = isDeveloper()

      return (
        <div className="error-container">
          <h2>Что-то пошло не так</h2>
          {devMode ? (
            <p>{this.state.message}</p>
          ) : (
            <p>Произошла техническая ошибка. Пожалуйста, перезагрузите страницу или попробуйте позже.</p>
          )}
          <div className="error-actions">
            <button onClick={() => this.setState({ hasError: false, message: undefined, eventId: undefined })}>
              Попробовать снова
            </button>
            {devMode && this.state.eventId && (
              <button 
                onClick={() => Sentry.showReportDialog({ eventId: this.state.eventId })}
                style={{ marginLeft: '10px' }}
              >
                Сообщить об ошибке
              </button>
            )}
          </div>
          {devMode && (
            <details style={{ marginTop: '10px', fontSize: '12px' }}>
              <summary>Техническая информация (только для разработчиков)</summary>
              <pre>{this.state.message}</pre>
              {this.state.eventId && <p>Sentry Event ID: {this.state.eventId}</p>}
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}



