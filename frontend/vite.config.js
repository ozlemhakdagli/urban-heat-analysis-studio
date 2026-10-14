import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The React app talks to the FastAPI backend (uvicorn backend.main:app --port 8000) through /api.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8000' } },
})
