import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 開発時(npm run dev)はフロントエンドを5173番、バックエンドを4000番で別々に動かすため、
    // /api へのリクエストをバックエンドへ転送する。本番(npm run start)は同一オリジンなので不要。
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
