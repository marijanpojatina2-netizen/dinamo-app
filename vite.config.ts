import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore  // Ignoriraj TS error za fork bez punih tipova

export default defineConfig({
plugins: [react(),
// @ts-ignore  // Ignoriraj za korištenje vercel
],
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