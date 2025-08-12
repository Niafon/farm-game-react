/**
 * Entry point for the React application. It mounts the App component
 * into the DOM element with id="root".
 */
import { createRoot } from 'react-dom/client'

import App from './App'
import { WalletProvider } from './web3/WalletProvider'

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  (async () => {
    try {
      const pkg = '@sentry/browser'
      // @vite-ignore dynamic optional import
      const Sentry: any = await import(/* @vite-ignore */ (pkg as string))
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN as string,
        tracesSampleRate: 0.1,
        beforeSend(event: { user?: unknown; breadcrumbs?: Array<{ category?: string }> } | null) {
          if (!event) return event
          if ('user' in event && event.user) {
            (event as { user?: unknown }).user = undefined
          }
          if (event.breadcrumbs) {
            event.breadcrumbs = event.breadcrumbs.filter((b: { category?: string }) => b.category !== 'console')
          }
          return event
        },
      })
    } catch {
      // ignore missing optional monitoring dependency
    }
  })()
}

createRoot(document.getElementById('root')!).render(
  <WalletProvider>
    <App />
  </WalletProvider>
)

// Production runtime env validation
if (import.meta.env.PROD) {
  const required = ['VITE_CONTRACT_ADDRESS'] as const
  const missing = required.filter((k) => !import.meta.env[k] || String(import.meta.env[k]).trim() === '')
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn(`Missing required env vars: ${missing.join(', ')}`)
  }
}
