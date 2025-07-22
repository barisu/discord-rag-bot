#!/usr/bin/env node
import { config } from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🗃️ 結合テスト用DB - Drizzle Studio起動中...');

// 結合テスト用環境変数を読み込み
const envPath = path.resolve(__dirname, '../.env.integration');

// .env.integrationファイルの存在確認
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.integrationファイルが見つかりません');
  console.error(`   期待されるパス: ${envPath}`);
  console.error('');
  console.error('📝 セットアップ手順:');
  console.error('   1. .env.integration.exampleをコピーして.env.integrationを作成');
  console.error('   2. INTEGRATION_DATABASE_URLを設定');
  console.error('   3. 再度実行');
  process.exit(1);
}

config({ path: envPath });

console.log('📁 環境変数ファイル:', envPath);

// 必要な環境変数を確認
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ INTEGRATION_DATABASE_URLが設定されていません');
  console.error('');
  console.error('💡 .env.integrationファイルで以下を設定してください:');
  console.error('   INTEGRATION_DATABASE_URL=postgres://test:test@localhost:5433/discord_rag_bot_test');
  process.exit(1);
}

console.log('🔧 Drizzle Studio設定確認:');
console.log(`   Database URL: ${databaseUrl.replace(/:\/\/.*@/, '://***:***@')}`);
console.log('');

// テスト用PostgreSQLコンテナの起動確認
console.log('🔍 PostgreSQLコンテナ状態を確認中...');

const dockerPs = spawn('docker', ['ps', '--filter', 'name=test-postgres', '--format', 'table {{.Names}}\t{{.Status}}'], {
  stdio: 'pipe'
});

dockerPs.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('test-postgres')) {
    console.log('✅ test-postgresコンテナが実行中です');
    startDrizzleStudio();
  } else {
    console.log('⚠️ test-postgresコンテナが見つかりません');
    console.log('');
    console.log('🚀 データベースセットアップを実行してください:');
    console.log('   npm run dev:integration:setup');
    console.log('');
    console.log('または手動でコンテナを起動:');
    console.log('   npm run test:integration:setup');
    process.exit(1);
  }
});

dockerPs.stderr.on('data', (data) => {
  console.warn('Docker確認警告:', data.toString());
  // Dockerが利用できない場合でも続行
  console.log('⚠️ Docker状態の確認に失敗しましたが、Drizzle Studioを起動します...');
  startDrizzleStudio();
});

dockerPs.on('close', (code) => {
  if (code !== 0) {
    console.log('⚠️ Docker確認が完了できませんでしたが、Drizzle Studioを起動します...');
    startDrizzleStudio();
  }
});

function startDrizzleStudio() {
  console.log('🚀 Drizzle Studio起動開始...');

  // Drizzle Studio用の環境変数を設定
  const studioEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  };

  // ルートディレクトリに移動してDrizzle Studioを起動
  const rootDir = path.resolve(__dirname, '../../../..');

  console.log(`📂 実行ディレクトリ: ${rootDir}`);
  console.log('');

  // Drizzle Studio起動
  const studioProcess = spawn('npm', ['run', 'db:studio'], {
    cwd: rootDir,
    env: studioEnv,
    stdio: 'inherit'
  });

  // プロセス終了時のクリーンアップ
  process.on('SIGINT', () => {
    console.log('\n🔄 Drizzle Studio停止処理開始...');
    studioProcess.kill('SIGTERM');
    setTimeout(() => {
      console.log('✅ Drizzle Studio停止完了');
      process.exit(0);
    }, 1000);
  });

  process.on('SIGTERM', () => {
    console.log('\n🔄 Drizzle Studio停止処理開始...');
    studioProcess.kill('SIGTERM');
    process.exit(0);
  });

  // Studio起動完了メッセージ
  studioProcess.on('spawn', () => {
    console.log('');
    console.log('🎯 Drizzle Studio起動完了！');
    console.log('');
    console.log('🌐 アクセス方法:');
    console.log('   通常: https://local.drizzle.studio');
    console.log('   または: http://localhost:4983 (ポートは起動ログで確認)');
    console.log('');
    console.log('📊 確認できるテーブル:');
    console.log('   • discord_messages - 取得済みDiscordメッセージ');
    console.log('   • documents - 処理済みドキュメント');
    console.log('   • embeddings - ベクトル埋め込みデータ');
    console.log('   • init_jobs - DB初期化ジョブ履歴');
    console.log('   • rag_queries - 検索クエリログ');
    console.log('');
    console.log('💡 使用例:');
    console.log('   • SELECT COUNT(*) FROM discord_messages;');
    console.log('   • SELECT * FROM documents ORDER BY created_at DESC LIMIT 10;');
    console.log('   • SELECT * FROM init_jobs ORDER BY created_at DESC;');
    console.log('');
    console.log('🛑 停止するには Ctrl+C を押してください');
    console.log('');
  });

  // Studio異常終了時の処理
  studioProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Drizzle Studio異常終了 (終了コード: ${code})`);
      console.error('');
      console.error('🔍 トラブルシューティング:');
      console.error('   1. データベースが起動しているか確認');
      console.error('   2. INTEGRATION_DATABASE_URLが正しいか確認');
      console.error('   3. drizzle-kitがインストールされているか確認');
      console.error('   4. ポート4983が使用中でないか確認');
    } else {
      console.log('✅ Drizzle Studio正常終了');
    }
  });

  studioProcess.on('error', (error) => {
    console.error('❌ Drizzle Studio起動エラー:', error.message);
    console.error('');
    console.error('💡 解決方法:');
    console.error('   1. drizzle-kitがインストールされているか確認: npm install drizzle-kit');
    console.error('   2. ルートディレクトリのpackage.jsonにdb:studioスクリプトがあるか確認');
    console.error('   3. drizzle.config.tsが正しく設定されているか確認');
  });
}