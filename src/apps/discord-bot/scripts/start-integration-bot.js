#!/usr/bin/env node
import { config } from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🤖 結合テスト環境でDiscord Bot起動中...');

// 結合テスト用環境変数を読み込み
const envPath = path.resolve(__dirname, '../.env.integration');

// .env.integrationファイルの存在確認
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.integrationファイルが見つかりません');
  console.error(`   期待されるパス: ${envPath}`);
  console.error('');
  console.error('📝 セットアップ手順:');
  console.error('   1. .env.integration.exampleをコピーして.env.integrationを作成');
  console.error('   2. Discord Bot Token、Guild ID、Category IDなどを設定');
  console.error('   3. 再度実行');
  process.exit(1);
}

config({ path: envPath });

console.log('📁 環境変数ファイル:', envPath);

// 環境変数を確認
const requiredEnvs = [
  'INTEGRATION_DISCORD_TOKEN',
  'INTEGRATION_DATABASE_URL',
  'TEST_GUILD_ID',
  'TEST_CATEGORY_ID',
  'TEST_ADMIN_USER_ID'
];

const missingEnvs = requiredEnvs.filter(env => !process.env[env]);

if (missingEnvs.length > 0) {
  console.error('❌ 必要な環境変数が設定されていません:');
  missingEnvs.forEach(env => console.error(`   - ${env}`));
  console.error('');
  console.error('💡 .env.integrationファイルで以下の値を設定してください:');
  missingEnvs.forEach(env => console.error(`   ${env}=your_value_here`));
  process.exit(1);
}

// Bot用の環境変数を設定（統合テスト用）
const botEnv = {
  ...process.env,
  DISCORD_TOKEN: process.env.INTEGRATION_DISCORD_TOKEN,
  DATABASE_URL: process.env.INTEGRATION_DATABASE_URL,
  NODE_ENV: 'test',
  API_PORT: process.env.INTEGRATION_API_PORT || '3002',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  CHUNK_SIZE: process.env.CHUNK_SIZE || '1000',
  CHUNK_OVERLAP: process.env.CHUNK_OVERLAP || '200',
  MAX_CHUNKS_PER_QUERY: process.env.MAX_CHUNKS_PER_QUERY || '5',
  MAX_KEYWORDS: process.env.MAX_KEYWORDS || '8',
  MIN_CONFIDENCE: process.env.MIN_CONFIDENCE || '0.6',
  MIN_BM25_SCORE: process.env.MIN_BM25_SCORE || '0.1'
};

console.log('🔧 Bot設定確認:');
console.log(`   Discord Token: ${botEnv.DISCORD_TOKEN ? '✅ 設定済み' : '❌ 未設定'}`);
console.log(`   Database URL: ${botEnv.DATABASE_URL ? '✅ 設定済み' : '❌ 未設定'}`);
console.log(`   Guild ID: ${process.env.TEST_GUILD_ID}`);
console.log(`   Category ID: ${process.env.TEST_CATEGORY_ID}`);
console.log(`   Admin User ID: ${process.env.TEST_ADMIN_USER_ID}`);
console.log(`   API Port: ${botEnv.API_PORT}`);
console.log('');

console.log('🚀 Discord Bot起動開始...');

// Bot起動
const botProcess = spawn('tsx', ['watch', 'src/index.ts'], {
  cwd: path.resolve(__dirname, '..'),
  env: botEnv,
  stdio: 'inherit'
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  console.log('\n🔄 Bot停止処理開始...');
  botProcess.kill('SIGTERM');
  setTimeout(() => {
    console.log('✅ Bot停止完了');
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Bot停止処理開始...');
  botProcess.kill('SIGTERM');
  process.exit(0);
});

// Bot起動完了メッセージ
botProcess.on('spawn', () => {
  console.log('');
  console.log('🎯 手動テスト用Bot起動完了！');
  console.log('');
  console.log('📋 テスト手順:');
  console.log('   1. Discordのテストサーバーに移動');
  console.log(`   2. テストカテゴリ内のチャンネルで以下をテスト:`);
  console.log('      !ping                          # Bot応答テスト');
  console.log(`      !init-db ${process.env.TEST_CATEGORY_ID}  # DB初期化テスト`);
  console.log('      !init-db                       # エラーハンドリングテスト');
  console.log('      !init-db invalid-id           # エラーハンドリングテスト');
  console.log('');
  console.log('🔍 期待される結果:');
  console.log('   • !ping → "Pong! Discord RAG Bot is ready." レスポンス');
  console.log('   • 正常なinit-db → "🔄 データベース初期化を開始します" メッセージ');
  console.log('   • 無効なinit-db → 適切なエラーメッセージ');
  console.log('');
  console.log('🛑 停止するには Ctrl+C を押してください');
  console.log('');
});

// Bot異常終了時の処理
botProcess.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`❌ Bot異常終了 (終了コード: ${code})`);
    console.error('');
    console.error('🔍 トラブルシューティング:');
    console.error('   1. Discord Tokenが正しいか確認');
    console.error('   2. データベースが起動しているか確認');
    console.error('   3. Bot権限が適切に設定されているか確認');
    console.error('   4. .env.integrationの設定値を再確認');
  } else {
    console.log('✅ Bot正常終了');
  }
});

botProcess.on('error', (error) => {
  console.error('❌ Bot起動エラー:', error.message);
  console.error('');
  console.error('💡 解決方法:');
  console.error('   1. tsxがインストールされているか確認: npm install tsx');
  console.error('   2. 必要な依存関係がインストールされているか確認: npm install');
});