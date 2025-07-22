/**
 * 結合テスト用グローバルセットアップ
 * 全テスト実行前に1回だけ実行されます
 */

import { config } from 'dotenv';
import path from 'path';
import postgres from 'postgres';

export default async function globalSetup() {
  console.log('🌍 結合テスト グローバルセットアップ開始...');

  // 環境変数読み込み
  const envPath = path.resolve(__dirname, '../../.env.integration');
  config({ path: envPath });

  // データベース接続テスト
  await testDatabaseConnection();

  console.log('✅ 結合テスト グローバルセットアップ完了');
}

/**
 * データベース接続テスト
 */
async function testDatabaseConnection() {
  const databaseUrl = process.env.INTEGRATION_DATABASE_URL || 
                     'postgres://test:test@localhost:5433/discord_rag_bot_test';

  console.log('🔍 データベース接続テスト...');
  console.log(`   URL: ${databaseUrl.replace(/:\/\/.*@/, '://***:***@')}`);

  let client: postgres.Sql | null = null;

  try {
    client = postgres(databaseUrl, {
      max: 1,
      connect_timeout: 5,
    });

    // 接続テスト
    await client`SELECT 1 as test`;
    
    // pgvector拡張確認
    const extensions = await client`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;
    
    if (extensions.length === 0) {
      console.warn('⚠️ pgvector拡張が見つかりません');
    } else {
      console.log('✅ pgvector拡張確認完了');
    }

    // 必要なテーブル確認
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('discord_messages', 'documents', 'init_jobs')
    `;

    const expectedTables = ['discord_messages', 'documents', 'init_jobs'];
    const existingTables = tables.map(t => t.table_name as string);
    const missingTables = expectedTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      throw new Error(`必要なテーブルが不足しています: ${missingTables.join(', ')}`);
    }

    console.log('✅ データベース接続・スキーマ確認完了');

  } catch (error) {
    console.error('❌ データベース接続テスト失敗:', error);
    throw error;

  } finally {
    if (client) {
      await client.end();
    }
  }
}

/**
 * Discord Bot接続の事前確認（オプション）
 * 実際の接続はテスト実行時に行います
 */
async function testDiscordEnvironment() {
  const token = process.env.INTEGRATION_DISCORD_TOKEN;
  const guildId = process.env.TEST_GUILD_ID;
  const categoryId = process.env.TEST_CATEGORY_ID;

  if (!token || !guildId || !categoryId) {
    throw new Error('Discord関連の環境変数が不足しています');
  }

  console.log('✅ Discord環境変数確認完了');
  console.log(`   Guild ID: ${guildId}`);
  console.log(`   Category ID: ${categoryId}`);
}