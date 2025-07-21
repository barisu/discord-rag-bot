import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
    testTimeout: 60000, // testcontainers用
    hookTimeout: 60000,
    teardownTimeout: 60000
  }
});