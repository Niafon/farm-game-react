/**
 * Utility functions for checking user permissions and access levels
 */

export function isDeveloper(): boolean {
  // Never expose developer features in production builds
  if (process.env.NODE_ENV === 'production') {
    return false
  }
  // In non-production environments, enable developer features
  return true
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' && !isDeveloper()
}

// Enable developer mode (for authorized users)
export function enableDeveloperMode(password?: string): boolean {
  // Guard against production usage entirely
  if (process.env.NODE_ENV === 'production') {
    return false
  }
  // Lightweight local guard for non-production only
  const devPassword = 'farm_dev_2024'
  if (password === devPassword) {
    try { localStorage.setItem('dev_mode', 'true') } catch {}
    console.log('Developer mode enabled')
    return true
  }
  return false
}

// Disable developer mode
export function disableDeveloperMode(): void {
  localStorage.removeItem('dev_mode')
  console.log('Developer mode disabled')
}

// Check if user has admin privileges
export function isAdmin(): boolean {
  // In production, this would check against a proper auth system
  return isDeveloper() && localStorage.getItem('admin_role') === 'true'
}

// Console command for enabling dev mode (only works in development)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // @ts-expect-error - Adding global functions for debugging
  window.enableDevMode = enableDeveloperMode
  // @ts-expect-error - Adding global functions for debugging
  window.disableDevMode = disableDeveloperMode
}
