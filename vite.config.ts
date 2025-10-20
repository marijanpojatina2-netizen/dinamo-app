import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000, // Povećaj limit upozorenja sa 500kB na 1MB
    rollupOptions: {
      output: {
        manualChunks: {
          // Splitaj velike deps u zasebne chunkove
          vendor: ['react', 'react-dom', 'framer-motion'], // Dodaj svoje deps (npr. bwip-js)
          bwip: ['bwip-js'], // Primjer za bwip-js
        },
      },
    },
  },
}); 