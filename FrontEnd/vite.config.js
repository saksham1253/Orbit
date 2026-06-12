import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    compression({ algorithm: 'gzip', ext: '.gz' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
  ],

  build: {
    target: 'es2020',
    cssMinify: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Vite 8 / rolldown requires manualChunks as a function
        manualChunks: (id) => {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-vendor';
          if (id.includes('node_modules/react-router-dom/') || id.includes('node_modules/react-router/')) return 'router';
          if (id.includes('node_modules/@tanstack/')) return 'query';
          if (id.includes('node_modules/framer-motion/')) return 'motion';
          if (id.includes('node_modules/leaflet/') || id.includes('node_modules/react-leaflet/')) return 'map';
          if (id.includes('node_modules/socket.io-client/') || id.includes('node_modules/engine.io-client/')) return 'socket';
          if (id.includes('node_modules/react-hook-form/') || id.includes('node_modules/@hookform/') || id.includes('node_modules/zod/')) return 'forms';
          if (id.includes('node_modules/zustand/')) return 'state';
          if (id.includes('node_modules/lucide-react/') || id.includes('node_modules/date-fns/') || id.includes('node_modules/axios/')) return 'utils';
        },
      },
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'framer-motion',
      'zustand',
      'axios',
      'date-fns',
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});
