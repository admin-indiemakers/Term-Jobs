import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function deferCssPlugin() {
  return {
    name: 'defer-css-plugin',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<link\s+rel="stylesheet"\s+crossorigin\s+href="(\/assets\/[^"]+\.css)">/g,
        '<link rel="preload" as="style" href="$1" crossorigin>\n    <link rel="stylesheet" href="$1" media="print" onload="this.media=\'all\'" crossorigin>\n    <noscript><link rel="stylesheet" href="$1" crossorigin></noscript>'
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), deferCssPlugin()],
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

