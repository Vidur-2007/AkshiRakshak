import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: '@akshi/engine', setupFiles: ['test/setup.ts'] },
});
