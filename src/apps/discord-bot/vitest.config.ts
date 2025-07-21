import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 60000
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../../packages/shared/src')
    }
  }
});