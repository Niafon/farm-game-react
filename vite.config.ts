import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react()];
  if (mode === 'analyze') {
    plugins.push(visualizer({ filename: 'bundle-stats.html', gzipSize: true, brotliSize: true }) as PluginOption);
  }
  return {
    plugins,
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            ethers: ['ethers'],
          },
        },
      },
    },
  };
})
