import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: command === 'serve' ? {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        }
      } : {}
    }
  }
})