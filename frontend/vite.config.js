import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  // Required for loading index.html from the electron file:// protocol
  base: './',

  server: {
    port: 3000,
    strictPort: true,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    // Raise warning threshold to 1 MB — the app is intentionally large
    // due to recharts and lucide-react; we split per route below.
    chunkSizeWarningLimit: 1024,

    rollupOptions: {
      output: {
        // Manual chunk splitting by concern — keeps each chunk under 400 KB
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // Charting library (big; isolate so it can be cached separately)
          'vendor-recharts': ['recharts'],

          // Icons — lucide-react is tree-shaken by Vite already,
          // but grouping gives better long-term cache hits.
          'vendor-lucide': ['lucide-react'],

          // HTTP client
          'vendor-axios': ['axios'],

          // State management (small, but keeps vendor chunks clean)
          'vendor-zustand': ['zustand'],
        },
      },
    },
  },
});
