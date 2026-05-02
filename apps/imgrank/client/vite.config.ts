import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const uiRoot = path.resolve(__dirname, '../../../packages/ui/src');

export default defineConfig({
  root: uiRoot,
  // .env lives in the client/ dir, not in packages/ui/src (the vite root)
  envDir: path.resolve(__dirname),
  resolve: {
    alias: {
      './platform.config': path.resolve(__dirname, './platform.config.ts'),
      '../platform.config': path.resolve(__dirname, './platform.config.ts'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'SkillTracker',
        short_name: 'SkillTracker',
        description: 'Head-to-head ELO ranking for AI-generated images.',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-pwa.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'imagedelivery.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'cf-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  build: {
    outDir: path.resolve(__dirname, '../dist/client'),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3041',
      '/health': 'http://localhost:3041',
    },
  },
});
