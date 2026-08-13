import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Hawkbot',
        short_name: 'Hawkbot',
        description: 'ULM student Q&A forum and campus chatbot',
        start_url: '/',
        display: 'standalone',
        background_color: '#FAF3E1',
        theme_color: '#8A244B',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // vite-plugin-pwa defaults to a precache-backed navigateFallback
        // ('index.html'), which registers a NavigationRoute ahead of our
        // own runtimeCaching rules and would swallow every navigation
        // before the app-shell rule below ever runs. Disable it so
        // navigations go through our explicit StaleWhileRevalidate rule.
        navigateFallback: undefined,
        // Hashed JS/CSS/icons are precached by default (globPatterns below)
        // — precached assets are served cache-first with revision-based
        // invalidation on the next SW update, so no separate runtime rule
        // is needed for them. HTML is excluded from precache on purpose:
        // it's handled by the navigation rule instead so the shell can be
        // revalidated on every load rather than only on a new SW install.
        globPatterns: ['**/*.{js,css,ico,png,svg,webmanifest}'],
        runtimeCaching: [
          {
            // HTML app shell: serve the cached shell instantly, revalidate
            // against the network in the background on every navigation.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'html-app-shell',
            },
          },
          {
            // Live authenticated data (feed, votes, chat) must never be
            // served stale — explicitly excluded from any caching.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
})
