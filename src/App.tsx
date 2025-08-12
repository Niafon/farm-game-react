/**
 * Entry: restore original DOM-driven game to preserve all behaviors/animations.
 */
import React, { useEffect, useRef } from 'react'
import './App.css'
import { initializeGame } from './game'
import StaticMarkup from './components/StaticMarkup'
import { Web3ErrorBoundary } from './components/Web3ErrorBoundary'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Game error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong.</h2>
          <button onClick={() => this.setState({ hasError: false })}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const initialized = useRef(false)
  const gameInstance = useRef<ReturnType<typeof initializeGame> | null>(null)

  useEffect(() => {
    if (!initialized.current) {
      gameInstance.current = initializeGame()
      initialized.current = true
    }
    return () => {
      if (gameInstance.current) {
        gameInstance.current.cleanup()
      }
    }
  }, [])

  return (
    <ErrorBoundary>
      <Web3ErrorBoundary>
        <StaticMarkup />
      </Web3ErrorBoundary>
    </ErrorBoundary>
  )
}

export default App
