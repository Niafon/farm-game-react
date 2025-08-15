import React, { lazy, Suspense } from 'react'

// Lazy load RainbowKit to reduce initial bundle size
const ConnectButton = lazy(async () => {
  const { ConnectButton } = await import('@rainbow-me/rainbowkit')
  return { default: ConnectButton }
})

const RainbowKitProvider = lazy(async () => {
  const { RainbowKitProvider } = await import('@rainbow-me/rainbowkit')
  return { default: RainbowKitProvider }
})

export function LazyConnectButton() {
  return (
    <Suspense fallback={
      <button className="wallet-button loading">
        Connecting...
      </button>
    }>
      <ConnectButton />
    </Suspense>
  )
}

export function LazyRainbowKitProvider({ 
  children, 
  ...props 
}: React.ComponentProps<typeof RainbowKitProvider>) {
  return (
    <Suspense fallback={
      <div className="wallet-provider-loading">
        Loading wallet provider...
      </div>
    }>
      <RainbowKitProvider {...props}>
        {children}
      </RainbowKitProvider>
    </Suspense>
  )
}
