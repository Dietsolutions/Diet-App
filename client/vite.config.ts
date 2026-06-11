import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || '';

  return {
    plugins: [
      react(),

      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png'],
        manifest: {
          name: 'Diet Plan & Tracker',
          short_name: 'Diet Plan',
          description: 'AI-powered personalised diet plan and meal tracker',
          theme_color: '#0F1117',
          background_color: '#0F1117',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            { src: '/icons/icon-72.png',  sizes: '72x72',   type: 'image/png' },
            { src: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png' },
            { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
            { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
            { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ]
        },
        workbox: {
          // Force new SW to take over immediately — prevents iOS getting stuck
          // on stale cached JS bundles after a new deploy.
          skipWaiting: true,
          clientsClaim: true,
          // Remove stale caches from old SW versions on activation.
          cleanupOutdatedCaches: true,
          // Allow up to 12 MB per file in the precache. The Recharts bundle
          // alone is ~9 MB; the previous 4 MB ceiling forced workbox to
          // throw a build error after a successful bundle.
          maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            // ── Navigate requests: NetworkFirst ─────────────────────────────
            // CRITICAL for iOS: always fetch fresh index.html from the network
            // so the browser gets the correct content-hashed JS chunk filenames.
            {
              urlPattern: ({ request }: { request: Request }) =>
                request.mode === 'navigate' && !request.url.includes('/api/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'navigation-cache',
                networkTimeoutSeconds: 5,
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // ── Google Fonts ─────────────────────────────────────────────────
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            // ⚠️ API routes must NOT be cached — auth state and session tokens
            // change per-request; caching causes stale 401/session bugs on iOS.
          ],
        },
      }),
    ],

    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },

    resolve: {
      alias: {
        '@shared': resolve(__dirname, '../api'),
      },
    },

    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },

    build: {
      // Target modern browsers — iOS 13+ (Safari 13+) supports all of these.
      // @vitejs/plugin-legacy has been removed: it was generating polyfill
      // detection code that caused RangeError: Maximum call stack size exceeded
      // on iOS Safari 18 (a fully modern engine that needs zero legacy polyfills).
      target: ['es2020', 'safari13', 'chrome87', 'firefox78'],
      sourcemap: false,
      chunkSizeWarningLimit: 12000, // country-state-city (onboarding) is ~8.7 MB, lazy-loaded for new users only
      rollupOptions: {
        output: {
          // Function form is required by Vite 8's rolldown bundler; the
          // object form was a rollup-only feature. Returns the same vendor/
          // charts split but is portable across both bundlers.
          manualChunks(id: string): string | undefined {
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('d3-')) return 'charts';
              if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});
