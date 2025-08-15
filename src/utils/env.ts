// Environment utilities compatible with both Vite and Jest
export function getEnvVar(key: string): string | undefined {
  // Prefer Node/Jest env when available
  if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
    const fromProcess = process.env[key]
    if (typeof fromProcess !== 'undefined') return fromProcess
  }

  // Vite/browser: use import.meta.env when available without referencing undeclared globals
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - import.meta is provided by Vite at runtime
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return ((import.meta as any).env as Record<string, string | undefined>)[key]
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
