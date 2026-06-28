import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'sheer-prediction-return-arbitrary.trycloudflare.com',
      '.trycloudflare.com',
      '.ngrok-free.dev',
    ],
  },
})
