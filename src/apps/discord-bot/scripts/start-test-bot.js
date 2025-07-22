#!/usr/bin/env node
import { config } from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 結合テスト用環境変数を読み込み
const envPath = path.resolve(__dirname, '../.env.integration');
config({ path: envPath });

console.log('🤖 結合テスト用Discord Bot起動中...');

// 環境変数を確認
const requiredEnvs = ['INTEGRATION_DISCORD_TOKEN', 'INTEGRATION_DATABASE_URL'];
for (const env of requiredEnvs) {
  if (!process.env[env]) {
    console.error(`❌ 環境変数 ${env} が設定されていません`);
    process.exit(1);
  }
}

// Bot用の環境変数を設定
const botEnv = {
  ...process.env,
  DISCORD_TOKEN: process.env.INTEGRATION_DISCORD_TOKEN,
  DATABASE_URL: process.env.INTEGRATION_DATABASE_URL,
  NODE_ENV: 'integration',
  API_PORT: process.env.INTEGRATION_API_PORT || '3002'
};

// Bot起動
const botProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.resolve(__dirname, '..'),
  env: botEnv,
  stdio: 'inherit',
  detached: true
});

// プロセスIDを保存（停止用）
import fs from 'fs';
const pidFile = path.resolve(__dirname, '../.test-bot.pid');
fs.writeFileSync(pidFile, botProcess.pid.toString());

console.log(`✅ テストBot起動完了 (PID: ${botProcess.pid})`);

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  console.log('🔄 テストBot停止中...');
  process.kill(-botProcess.pid);
  try {
    fs.unlinkSync(pidFile);
  } catch (error) {
    // ファイルが存在しない場合は無視
  }
  process.exit(0);
});

// Bot起動の完了を待機
botProcess.on('close', (code) => {
  try {
    fs.unlinkSync(pidFile);
  } catch (error) {
    // ファイルが存在しない場合は無視
  }
  console.log(`📄 テストBot終了 (終了コード: ${code})`);
});