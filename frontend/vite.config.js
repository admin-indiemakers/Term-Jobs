import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Keep application CSS render-blocking so refresh never paints unstyled content.
  plugins: [react(), tailwindcss()],
  // Interview routes are lazy loaded; prepare their media dependency at startup.
  optimizeDeps: {
    include: ['livekit-client'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') || 
              id.includes('\\react\\') || 
              id.includes('/react-dom/') || 
              id.includes('\\react-dom\\') || 
              id.includes('/react-router') || 
              id.includes('\\react-router') ||
              id.includes('/scheduler/') ||
              id.includes('\\scheduler\\')
            ) {
              return 'vendor-react'
            }
            if (id.includes('framer-motion') || id.includes('motion')) {
              return 'vendor-motion'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide'
            }
            if (id.includes('marked')) {
              return 'vendor-marked'
            }
          }
        },
      },
    },
  },
  server: {
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok-free.dev',
      'liftable-actionable-joeann.ngrok-free.dev',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

