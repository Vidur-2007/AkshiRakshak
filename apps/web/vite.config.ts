import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/** Heavy libraries get their own chunks so /scan stays under its JS budget (SPEC_B_WEB.md §7). */
// Matched against module ids with forward slashes (Windows ids are normalised below).
const CHUNKS: [RegExp, string][] = [
  [/node_modules\/(three|@react-three)\//, 'three'],
  [/node_modules\/(recharts|d3-[^/]+|victory-vendor)\//, 'charts'],
  [/node_modules\/(react-force-graph-[^/]+|force-graph|3d-force-graph|kapsule)\//, 'graph'],
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
