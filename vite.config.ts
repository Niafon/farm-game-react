import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
// Visualizer loaded lazily only in analyze mode to avoid hard dependency in dev

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react()];
  if (mode === 'analyze') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { visualizer } = require('rollup-plugin-visualizer') as { visualizer: (opts?: any) => PluginOption }
      plugins.push(visualizer({ filename: 'bundle-stats.html', gzipSize: true, brotliSize: true }) as PluginOption)
    } catch {
      // optional dependency missing – skip analyzer
    }
  }
  return {
    plugins,
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      // Expose app version for Sentry release tagging and diagnostics
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '1.0.0'),
    },
    esbuild: { 
      drop: mode === 'production' ? ['console', 'debugger'] : [],
      // Tree-shaking optimizations
      treeShaking: true,
    },
    // Better source maps for development
    css: {
      devSourcemap: true,
    },
    // Optimize dependencies resolution
    resolve: {
      // Leave default resolution for better compatibility
    },
    // Optimize imports for tree-shaking
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'eventemitter3',
        'use-sync-external-store/shim/with-selector',
      ],
      // Allow pre-bundling of wagmi/viem/rainbowkit so their CJS deps are converted properly
      exclude: [],
    },
    server: {
      proxy: {
        '/siwe': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1024,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React libraries
            react: ['react', 'react-dom'],
            // Web3 core (wagmi + viem - keep together for better tree-shaking)
            'web3-core': ['wagmi', 'viem', '@wagmi/core'],
            // RainbowKit UI (heavy with locales)
            rainbowkit: ['@rainbow-me/rainbowkit'],
            // Monitoring
            sentry: ['@sentry/react', '@sentry/tracing'],
            // Utilities
            utils: ['zod'],
          },
        },
      },
    },
    preview: {
      headers: {
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; font-src 'self' data:",
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Permissions-Policy': 'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), clipboard-read=(), clipboard-write=(), display-capture=(), document-domain=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), speaker-selection=(), usb=(), vr=(), xr-spatial-tracking=()'
      }
    },
  };
})
