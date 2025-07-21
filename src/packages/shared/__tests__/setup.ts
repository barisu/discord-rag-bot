import { beforeAll, afterAll } from 'vitest';

// テスト用の環境変数設定
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // テスト用のダミー環境変数
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.DISCORD_TOKEN = 'test_discord_token';
  process.env.OPENAI_API_KEY = 'test_openai_key';
});

afterAll(() => {
  // テスト後のクリーンアップ
});