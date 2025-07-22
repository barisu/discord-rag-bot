#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pidFile = path.resolve(__dirname, '../.test-bot.pid');

console.log('🔄 テストBot停止中...');

try {
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
    
    try {
      // プロセスグループを停止（tsx watchとその子プロセス）
      process.kill(-pid, 'SIGTERM');
      console.log(`✅ テストBot停止完了 (PID: ${pid})`);
    } catch (error) {
      console.warn(`⚠️ プロセス停止エラー (PID: ${pid}):`, error.message);
    }
    
    // PIDファイル削除
    fs.unlinkSync(pidFile);
  } else {
    console.log('📄 テストBotのPIDファイルが見つかりません（既に停止済み）');
  }
} catch (error) {
  console.error('❌ テストBot停止エラー:', error);
}

// 念のため、すべてのtsx watchプロセスを停止
try {
  const { exec } = await import('child_process');
  exec('pkill -f "tsx watch src/index.ts"', (error, stdout, stderr) => {
    if (!error) {
      console.log('✅ バックアップ停止処理完了');
    }
  });
} catch (error) {
  // 無視
}