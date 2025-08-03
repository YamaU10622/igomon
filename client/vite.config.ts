import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['dev.igomon.net', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://dev.igomon.net:3000',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://dev.igomon.net:3000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://dev.igomon.net:3000',
        ws: true
      },
      '/ogp': {
        target: 'http://dev.igomon.net:3000',
        changeOrigin: true
      },
      '/placeholder-board.png': {
        target: 'http://dev.igomon.net:3000',
        changeOrigin: true
      },
      '/wgo': {
        target: 'http://dev.igomon.net:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
    // パフォーマンス最適化設定
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // コード分割の最適化
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          utils: ['@sabaki/sgf', '@sabaki/go-board'],
        },
      },
    },
    // 圧縮の最適化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  // 依存関係の事前バンドル
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@mui/material'],
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});