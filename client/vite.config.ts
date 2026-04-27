import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || '';

  return {
    plugins: [
      react(),

      // ── Legacy browser support ──────────────────────────────────────────────
      // Generates a second set of ES5-compatible chunks served via <script nomodule>
      // to browsers that don't support ES modules (truly old browsers only).
      //
      // CRITICAL: modernPolyfills MUST be false (or omitted).
      // Setting modernPolyfills: true injects a core-js/stable polyfills chunk
      // (~119 kB) into the modern build. On iOS Safari (JavaScriptCore engine),
      // certain core-js iterator/Symbol polyfills cause infinite recursion:
      //   RangeError: Maximum call stack size exceeded
      // iOS 18.7 has every modern JS feature natively — no core-js needed.
      // The manual polyfills in main.tsx safely patch only what's missing on
      // iOS < 15.4 without conflicting with JavaScriptCore's native implementation.
      legacy({
        targets: [
          'iOS >= 13',
          'Safari >= 13',
          'last 2 Chrome versions',
          'last 2 Firefox versions',
        ],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        renderLegacyChunks: true,
        modernPolyfills: false,
      }),

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
          // Allow up to 4 MB per file in the precache.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            // ── Navigate requests: NetworkFirst ─────────────────────────────
            // CRITICAL for iOS: always fetch fresh index.html from the network
            // so the browser gets the correct content-hashed JS chunk filenames.
            // navigateFallback (CacheFirst) was the likely cause of blank screen:
            // the SW served a stale index.html with old chunk names after a deploy.
            // NetworkFirst tries the network, falls back to cache on failure (offline).
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
      // build.target is intentionally omitted here — @vitejs/plugin-legacy
      // sets the modern target automatically based on its own `targets` option.
      // Setting it explicitly would generate the "plugin-legacy overrode build.target" warning.
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react:  ['react', 'react-dom'],
            charts: ['recharts'],
            vendor: ['axios', 'zustand'],
          },
        },
      },
    },
  };
});
