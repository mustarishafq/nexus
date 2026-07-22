
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
        // Prevent Rollup from pulling transitive deps (e.g. react) into other
        // manual chunks, which creates circular init / TDZ runtime crashes.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (!id.includes('node_modules') || id.includes('\0')) return;

          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@lottiefiles')) return 'vendor-lottie';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          // Keep React + Radix together. A separate vendor-radix chunk caused
          // "Cannot access 'bn' before initialization" from circular chunk init.
          // Match real react packages only — `/react/` wrongly caught @tiptap/react.
          if (
            id.includes('/node_modules/react/')
            || id.includes('/node_modules/react-dom/')
            || id.includes('/node_modules/scheduler/')
            || id.includes('@radix-ui')
          ) {
            return 'vendor-react';
          }
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-editor';
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
  optimizeDeps: {
    include: [
      'dompurify',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-underline',
    ],
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
      '/token': { target: 'http://localhost:8000', changeOrigin: true },
      '/authorize': { target: 'http://localhost:8000', changeOrigin: true },
      '/oauth': { target: 'http://localhost:8000', changeOrigin: true },
      '/.well-known/oauth': { target: 'http://localhost:8000', changeOrigin: true },
    },
    hmr: {
      host: 'localhost',
    },
  },
});