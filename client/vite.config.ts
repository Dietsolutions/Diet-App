import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

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
            { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png' },
            { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
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
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Serve index.html for all non-API navigate requests (SPA routing).
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            // Cache Google Fonts — safe, long-lived, never auth-related.
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
            },
            // ⚠️ API routes must NOT be cached — auth state and session tokens
            // change per-request and caching them causes stale 401/session bugs,
            // especially on iOS Safari where the SW cookie jar differs from the
            // browser's. Always go directly to the network for /api/*.
          ]
        }
      })
    ],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl)
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true
        }
      }
    },
    build: {
      // Target iOS Safari 14+ so modern JS syntax is transpiled correctly.
      // iOS 14 shipped Sept 2020 and supports ES2017+, optional chaining, etc.
      // Without an explicit target Vite defaults to 'modules' which can leave
      // some syntax un-transpiled that JavaScriptCore on older iOS can't parse.
      target: ['es2019', 'safari14', 'chrome87', 'firefox78', 'edge88'],
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            charts: ['recharts'],
            vendor: ['axios', 'zustand']
          }
        }
      }
    }
  };
});
