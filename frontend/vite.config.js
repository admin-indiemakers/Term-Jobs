import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: [
      '5589-2405-201-f00f-c124-9a9-27c6-4704-42aa.ngrok-free.app',
      '.ngrok-free.app',
    ],
  },
})
