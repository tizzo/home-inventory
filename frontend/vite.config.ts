import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    headers: {
      // Allow scripts from localhost for development
      'Content-Security-Policy': "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 http://localhost:*; style-src 'self' 'unsafe-inline';",
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Ensure chunks are properly generated
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
})
