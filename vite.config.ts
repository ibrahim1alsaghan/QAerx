import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Track which modules are used by content/background scripts
const contentAndBackgroundDeps = new Set<string>();

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
          // Normalize path separators for cross-platform compatibility
          const normalizedId = id.replace(/\\/g, '/');

          // Check if this module is directly in content or background
          if (normalizedId.includes('/src/content/') || normalizedId.includes('/src/background/')) {
            contentAndBackgroundDeps.add(normalizedId);
            return undefined; // Don't chunk - inline into entry
          }

          // Check if this is a shared utility that should be inlined
          // Shared utilities used by content scripts should not be chunked
          if (normalizedId.includes('/src/shared/')) {
            return undefined;
          }

          // Check transitive dependencies
          const info = getModuleInfo(id);
          if (info) {
            const importers = info.importers || [];
            for (const importer of importers) {
              const normalizedImporter = importer.replace(/\\/g, '/');
              if (normalizedImporter.includes('/src/content/') ||
                  normalizedImporter.includes('/src/background/') ||
                  contentAndBackgroundDeps.has(normalizedImporter)) {
                contentAndBackgroundDeps.add(normalizedId);
                return undefined;
              }
            }
          }

          // Only create chunks for UI (sidepanel/popup) node_modules dependencies
          if (normalizedId.includes('node_modules')) {
            return 'client';
          }
        },
      },
    },
  },
  publicDir: 'public',
});
