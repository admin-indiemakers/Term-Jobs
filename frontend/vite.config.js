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
            if (id.includes('onnxruntime-web') || id.includes('livekit') || id.includes('@ricky0123/vad-react')) {
              return 'vendor-interview'
            }
            if (id.includes('framer-motion') || id.includes('motion')) {
              return 'vendor-motion'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide'
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

