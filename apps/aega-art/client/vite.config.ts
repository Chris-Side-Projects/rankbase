import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Vite config for the aega.art SPA.
 *
 * Build output lands in ../dist/client (read by Express in app.ts) so
 * `npm run build:all` from the repo root produces a single deployable tree.
 *
 * The PWA plugin generates a service worker that precaches the app shell
 * and swaps in updates on the next load. `registerType: 'autoUpdate'` means
 * users don't have to reload manually after a deploy — the new SW activates
 * in the background and the next navigation picks it up.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Inject this app's platform config into the shared UI package
      '../platform.config': path.resolve(__dirname, './platform.config.ts'),
      './platform.config': path.resolve(__dirname, './platform.config.ts'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'aega.art',
        short_name: 'aega.art',
        description: 'Head-to-head ELO ranking for AI-generated images.',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/',
        // SVG icon works in modern browsers (Chrome 92+, Safari 16+, Firefox).
        // We declare it as `any maskable` because the rectangle has enough
        // safe zone for OS launcher cropping. If iOS-pre-16 or older Android
        // matters, generate PNGs from icon-pwa.svg via your build pipeline
        // and add them here too.
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
        // Runtime-cache Cloudflare Images delivery URLs for offline browsing.
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
        // Don't claim clients immediately; wait for user to refresh.
        clientsClaim: false,
        skipWaiting: false,
      },
    }),
  ],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    // Proxy /api/* to the express server during `vite dev`.
    proxy: {
      '/api': 'http://localhost:3042',
      '/health': 'http://localhost:3042',
    },
  },
});
