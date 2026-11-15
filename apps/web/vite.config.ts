import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/**
 * Named chunks for the heaviest lazy libraries (SPEC_B_WEB.md §7). Only libraries that
 * nothing in the first load imports belong here: a manual chunk that also catches a
 * shared helper drags the whole chunk into every page. That happened with a 'graph'
 * chunk for react-force-graph (69 KB gzipped on every route), so the force graph is
 * left to normal code-splitting behind its lazy ForceGraphView import.
 * Matched against module ids with forward slashes (Windows ids are normalised below).
 */
const CHUNKS: [RegExp, string][] = [
  [/node_modules\/tesseract\.js[^/]*\//, 'ocr'],
  [/packages\/model\/model\/.+\.json$/, 'model'],
];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          // tesseract worker, core and tessdata as Laptop A ships them
          src: '../../packages/engine/assets/**/*',
          dest: 'engine-assets',
          rename: { stripBase: 3 },
        },
      ],
    }),
    // PWA (SPEC_B_WEB.md §2.1, §5.16): the app shell, fonts, lexicons (engine JS) and
    // the model JSON chunk are precached; tessdata is cached on first OCR use; /api never.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Akshi Rakshak',
        short_name: 'Akshi',
        description: 'Scan Anything. Stop Fraud Before It Happens.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#05070B',
        theme_color: '#05070B',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        share_target: {
          action: '/share-target',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        globIgnores: ['engine-assets/tessdata/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/engine-assets/tessdata/'),
            handler: 'CacheFirst',
            options: { cacheName: 'akshi-tessdata', expiration: { maxEntries: 16 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          const path = id.replaceAll('\\', '/');
          for (const [re, name] of CHUNKS) if (re.test(path)) return name;
          return undefined;
        },
      },
    },
  },
});
