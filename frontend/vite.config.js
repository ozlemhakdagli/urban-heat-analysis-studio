import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The React app talks to the FastAPI backend (uvicorn backend.main:app --port 8000) through /api.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts'
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) return 'map'
        },
      },
    },
  },
})
