import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'assets/images/hacki_icon.png'],
      manifest: {
        id: '/',
        name: 'Hacki — TUTTOmercatoWEB',
        short_name: 'Hacki TMW',
        description:
          'Lettore TUTTOmercatoWEB installabile con lettura offline per Serie A, Esteri, Serie B ed Editoriali.',
        theme_color: '#FF5722',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,ttf,woff,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/tmw/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tmw-api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*(?:tcccdn\.com|tuttomercatoweb\.com)\/.*\.(?:png|jpg|jpeg|webp|gif)(?:\?.*)?$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tmw-images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 14,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: false,
  },
});
