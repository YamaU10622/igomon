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
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});