import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'discord-bot-integration',
    root: path.resolve(__dirname),
    
    // 結合テストの実行設定
    include: [
      '__tests__/integration/**/*.integration.test.ts',
    ],
    
    // 通常のユニットテストを除外
    exclude: [
      '__tests__/commands/**/*.test.ts',
      '__tests__/setup.ts',
      'node_modules/**',
      'dist/**',
    ],
    
    // 環境設定
    environment: 'node',
    
    // タイムアウト設定（結合テストは時間がかかる）
    testTimeout: 60000, // 60秒
    hookTimeout: 30000, // 30秒
    teardownTimeout: 15000, // 15秒
    
    // 並列実行を無効化（Discord API制限とリソース管理のため）
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // シングルスレッドで実行
      },
    },
    
    // レポーター設定
    reporters: ['verbose'],
    
    // グローバル設定
    globals: true,
    
    // セットアップファイル
    setupFiles: [
      './__tests__/integration/setup-integration.ts'
    ],
    
    // テスト実行前の環境変数チェック
    globalSetup: './__tests__/integration/global-setup.ts',
    
    // ファイル監視を無効化（結合テストは手動実行推奨）
    watch: false,
    
    // カバレッジ設定（結合テストでは詳細カバレッジは不要）
    coverage: {
      enabled: false,
    },
  },
  
  // モジュール解決設定
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@rag': path.resolve(__dirname, '../../packages/rag/src'),
    },
  },
  
  // ESM対応
  esbuild: {
    target: 'es2022',
    format: 'esm',
  },
});