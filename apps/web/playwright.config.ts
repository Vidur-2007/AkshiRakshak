/**
 * Playwright smoke tests (SPEC_B_WEB.md §8). Runs against the production build via
 * `vite preview` (service worker included), or against BASE_URL, e.g. a Vercel preview:
 *   BASE_URL=https://akshi-rakshak-git-feat-web-….vercel.app npx playwright test -c apps/web
 */
import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:4173';

// Edge only where it is installed (CI's msedge install may be skipped).
const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/opt/microsoft/msedge/msedge',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];
const hasEdge = process.env.PW_EDGE === '1' || EDGE_PATHS.some((p) => existsSync(p));

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'en-IN',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    ...(hasEdge ? [{ name: 'desktop-edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }] : []),
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  ...(process.env.BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npx vite preview --port 4173 --strictPort',
          url: 'http://localhost:4173',
          // always a fresh preview: a reused one keeps its file list from an older build
          reuseExistingServer: false,
          timeout: 60_000,
        },
      }),
});
