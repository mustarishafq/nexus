
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@lottiefiles')) return 'vendor-lottie';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('lucide-react')) return 'vendor-icons';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // MCP + OAuth paths when using the frontend origin as the public connector URL
      '/mcp': { target: 'http://localhost:8000', changeOrigin: true },
      '/register': { target: 'http://localhost:8000', changeOrigin: true },
      '/authorize': { target: 'http://localhost:8000', changeOrigin: true },
      '/oauth': { target: 'http://localhost:8000', changeOrigin: true },
      '/.well-known/oauth': { target: 'http://localhost:8000', changeOrigin: true },
    },
    hmr: {
      host: 'localhost',
    },
  },
});