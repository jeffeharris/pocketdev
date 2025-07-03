import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:3005',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://backend:3005',
        ws: true,
        changeOrigin: true,
      },
      '/shelltender-terminal.html': {
        target: 'http://backend:3005',
        changeOrigin: true,
      },
      '/shelltender-ws': {
        target: 'http://shelltender:8080',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/shelltender-ws/, ''),
      },
      '/shelltender-api': {
        target: 'http://shelltender:8081',
        changeOrigin: true,
        ws: false, // Explicitly disable WebSocket for API endpoint
        rewrite: (path) => path.replace(/^\/shelltender-api/, ''),
      },
    },
  },
})