import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vercel from 'vite-plugin-vercel';  // Dodaj ovaj import

export default defineConfig({
  plugins: [react(), vercel()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'framer-motion'],
          bwip: ['bwip-js'],
        },
      },
    },
  },
}); 