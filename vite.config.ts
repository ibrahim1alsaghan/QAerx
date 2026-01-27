import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[ext]',
        // Prevent code splitting for content script and background
        manualChunks(id, { getModuleInfo }) {
          // Keep everything in the main bundle for content script
          const info = getModuleInfo(id);
          if (info) {
            const importers = info.importers || [];
            const isContentDep = importers.some(i => i.includes('src/content/')) || id.includes('src/content/');
            const isBackgroundDep = importers.some(i => i.includes('src/background/')) || id.includes('src/background/');

            // Don't chunk content or background dependencies
            if (isContentDep || isBackgroundDep) {
              return undefined;
            }
          }

          // Only create chunks for UI dependencies
          if (id.includes('node_modules')) {
            return 'client';
          }
        },
      },
    },
  },
  publicDir: 'public',
});
