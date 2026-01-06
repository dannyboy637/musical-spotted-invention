import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Increase chunk size warning limit since we're splitting intentionally
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React packages
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // State management and data fetching
          'vendor-state': ['zustand', '@tanstack/react-query', 'axios'],
          // Charts - large library, separate chunk
          'vendor-charts': ['recharts'],
          // Date utilities
          'vendor-date': ['date-fns'],
          // UI utilities
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
});
