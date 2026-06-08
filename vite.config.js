import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5180,
    proxy: {
      // DeepSeek API 代理 —— 绕过浏览器 CORS 限制
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
      },
      // SerpAPI 代理 —— 绕过浏览器 CORS 限制
      '/api/serpapi': {
        target: 'https://serpapi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/serpapi/, ''),
      },
    },
  },
  build: {
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
