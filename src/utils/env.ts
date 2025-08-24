// Environment utilities compatible with both Vite and Jest
export function getEnvVar(key: string): string | undefined {
  // Prefer Node/Jest env when available
  if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
    const fromProcess = process.env[key]
    if (typeof fromProcess !== 'undefined') return fromProcess
  }

  // Vite/browser: use import.meta.env when available without referencing undeclared globals
  try {
    // Access import.meta via eval so Jest can parse this file in CommonJS mode
    const meta = (0, eval)('import.meta') as any
    if (meta?.env) {
      return (meta.env as Record<string, string | undefined>)[key]
    }
  } catch {
    // Swallow in non-Vite contexts (e.g., Jest)
  }

  return undefined
}

export function getMode(): string {
  return getEnvVar('MODE') || getEnvVar('NODE_ENV') || 'development'
}

export function isDevelopment(): boolean {
  const mode = getMode()
  return mode === 'development' || mode === 'dev'
}

export function isProduction(): boolean {
  const mode = getMode()
  return mode === 'production' || mode === 'prod'
}
