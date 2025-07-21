import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
    testTimeout: 60000, // 60秒（testcontainers用）
    hookTimeout: 60000,
    teardownTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/tests/**',
        '**/*.test.*',
        '**/*.spec.*'
      ]
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, './src/packages/shared/src'),
      '@rag': resolve(__dirname, './src/packages/rag/src'),
      '@discord-bot': resolve(__dirname, './src/apps/discord-bot/src')
    }
  }
});