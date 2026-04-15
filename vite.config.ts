import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // Target Electron renderer process (Chromium)
    build: {
      target: 'chrome120',
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react'
            }
            if (id.includes('node_modules/react-router-dom/')) {
              return 'router'
            }
            if (id.includes('node_modules/@tanstack/react-query/')) {
              return 'query'
            }
            if (id.includes('node_modules/recharts/')) {
              return 'charts'
            }
            if (id.includes('node_modules/framer-motion/')) {
              return 'motion'
            }
            return undefined
          },
        },
      },
    },

    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },

    // Pass all VITE_ env vars through to the renderer
    define: {
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'process.env.VITE_WS_URL': JSON.stringify(env.VITE_WS_URL),
      'process.env.VITE_APP_VERSION': JSON.stringify(env.VITE_APP_VERSION),
      'process.env.VITE_ENVIRONMENT': JSON.stringify(env.VITE_ENVIRONMENT),
    },
  }
})
