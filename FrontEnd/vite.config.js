import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import compression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ── FCM readiness (build-time, authoritative) ───────────────────────────────
// Calling PushNotifications.register() WITHOUT a valid google-services.json makes
// the native Firebase layer throw "Default FirebaseApp is not initialized", which
// crashes the whole APK to the home screen (a native exception JS can't catch) —
// the "APK closes every time I log in" bug. So we detect, at build time, whether
// a STRUCTURALLY-VALID google-services.json for our appId is actually present in
// the Android project, and expose the result as __FCM_CONFIGURED__. Push then
// enables ONLY when this is true (see utils/pushNotify.js) — it's impossible to
// ship a build that crashes on login, with no manual env coordination needed.
const APP_ID = 'app.orbit.mobile';
function detectFcmConfigured() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(resolve(here, 'android/app/google-services.json'), 'utf8');
    const j = JSON.parse(raw);
    const clients = (j.client || []);
    const ok = clients.some((c) =>
      c?.client_info?.android_client_info?.package_name === APP_ID &&
      c?.client_info?.mobilesdk_app_id &&
      Array.isArray(c?.api_key) && c.api_key[0]?.current_key,
    );
    if (ok) console.log(`[vite] FCM configured — google-services.json valid for ${APP_ID}; push enabled.`);
    else console.log('[vite] google-services.json present but not valid for this appId; push stays OFF.');
    return ok;
  } catch {
    console.log('[vite] no google-services.json — push stays OFF (safe; no crash).');
    return false;
  }
}
const FCM_CONFIGURED = detectFcmConfigured();

export default defineConfig({
  define: {
    // Authoritative build-time signal: is FCM actually configured for this build?
    __FCM_CONFIGURED__: JSON.stringify(FCM_CONFIGURED),
  },
  plugins: [
    react(),
    tailwindcss(),
    compression({ algorithm: 'gzip', ext: '.gz' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
    // PWA: makes the deployed site installable ("Add to Home Screen") on
    // iPhone + Android. The Capacitor APK ships the same dist/ build; the
    // service worker is harmless inside the native shell.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png', 'orbit-app.svg'],
      manifest: {
        name: 'Orbit — Exchange skills, rise together',
        short_name: 'Orbit',
        description: "Learn in each other's orbit. Teach what you know, learn what you don't.",
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b0a20',
        background_color: '#06050f',
        categories: ['education', 'social', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell; bump the limit so the larger JS chunks
        // (map/motion) are cached for offline launch.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
        runtimeCaching: [
          {
            // API + sockets must always hit the network (auth, realtime); never
            // serve stale data from the cache.
            urlPattern: ({ url }) => url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],

  build: {
    target: 'es2020',
    cssMinify: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Vite 8 / rolldown requires manualChunks as a function
        manualChunks: (id) => {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-vendor';
          if (id.includes('node_modules/react-router-dom/') || id.includes('node_modules/react-router/')) return 'router';
          if (id.includes('node_modules/@tanstack/')) return 'query';
          if (id.includes('node_modules/framer-motion/')) return 'motion';
          if (id.includes('node_modules/leaflet/') || id.includes('node_modules/react-leaflet/')) return 'map';
          if (id.includes('node_modules/socket.io-client/') || id.includes('node_modules/engine.io-client/')) return 'socket';
          if (id.includes('node_modules/react-hook-form/') || id.includes('node_modules/@hookform/') || id.includes('node_modules/zod/')) return 'forms';
          if (id.includes('node_modules/zustand/')) return 'state';
          if (id.includes('/src/whiteboard/')) return 'whiteboard';
          if (id.includes('node_modules/lucide-react/') || id.includes('node_modules/date-fns/') || id.includes('node_modules/axios/')) return 'utils';
        },
      },
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },

  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'framer-motion',
      'zustand',
      'axios',
      'date-fns',
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});
