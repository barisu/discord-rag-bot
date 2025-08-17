import { beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'path';

// テスト用の環境変数設定
beforeAll(() => {
  // .env.testファイルを読み込み
  const envPath = resolve(process.cwd(), '../../../.env.test');
  config({ path: envPath });
  
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // GEMINI_API_KEYが設定されていることを確認
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set in .env.test file');
  }
});

afterAll(() => {
  // テスト後のクリーンアップ
});