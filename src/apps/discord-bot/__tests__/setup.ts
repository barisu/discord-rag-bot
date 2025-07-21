import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Discord Bot用のテスト環境変数
  process.env.DISCORD_TOKEN = 'test_discord_token';
  process.env.DISCORD_CLIENT_ID = 'test_client_id';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
});

afterAll(() => {
  // テスト後のクリーンアップ
});