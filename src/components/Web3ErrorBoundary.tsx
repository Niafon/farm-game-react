import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; message?: string }

export class Web3ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }
  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('Web3 error:', error)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong with Web3.</h2>
          <p>{this.state.message}</p>
          <button onClick={() => this.setState({ hasError: false, message: undefined })}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}



