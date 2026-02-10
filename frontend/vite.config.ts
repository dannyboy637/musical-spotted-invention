import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

function gitInfo() {
  // Vercel provides these env vars in builds (no .git dir available)
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const vercelRef = process.env.VERCEL_GIT_COMMIT_REF;
  if (vercelSha && vercelRef) {
    return { commit: vercelSha.slice(0, 7), branch: vercelRef };
  }
  // Local/other CI: use git directly
  try {
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return { commit, branch };
  } catch {
    return { commit: 'unknown', branch: 'unknown' };
  }
}

const git = gitInfo();

export default defineConfig({
  plugins: [react()],
  define: {
    __GIT_COMMIT__: JSON.stringify(git.commit),
    __GIT_BRANCH__: JSON.stringify(git.branch),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
