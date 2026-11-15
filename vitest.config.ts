import { defineConfig } from 'vitest/config';

// One Vitest project per workspace folder. Folders that do not exist yet
// (apps/web from Laptop B, eval/ from Laptop C) are picked up automatically
// once they are created; a folder with its own vitest/vite config uses it.
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      'packages/*',
      'apps/*',
      'eval*',
      // Vercel Functions: tests live in api/_test (underscore folders are not deployed as functions)
      {
        test: { name: 'api', root: './api', include: ['_test/**/*.test.ts'], environment: 'node' },
      },
    ],
  },
});
