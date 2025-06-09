/**
 * Root React component that injects the static markup
 * and boots the FarmGame logic once on mount.
 */
import React, { useEffect, useRef } from 'react'
import './App.css'
import markup from './markup.html?raw'
import { initializeGame } from './game'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Game error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="error-container">
        <h2>Something went wrong.</h2>
        <button onClick={() => this.setState({ hasError: false })}>
          Try again
        </button>
      </div>;
    }

    return this.props.children;
  }
}

/** React component wrapper around the ASCII farm game. */
function App() {
  const initialized = useRef(false)
  const gameInstance = useRef<ReturnType<typeof initializeGame> | null>(null)

  useEffect(() => {
    if (!initialized.current) {
      gameInstance.current = initializeGame()
      initialized.current = true
    }

    return () => {
      // Cleanup game instance
      if (gameInstance.current) {
        gameInstance.current.cleanup()
      }
    }
  }, [])

  return (
    <ErrorBoundary>
      <div dangerouslySetInnerHTML={{ __html: markup }} />
    </ErrorBoundary>
  )
}

export default App;
