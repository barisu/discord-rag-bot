/**
 * 結合テスト用セットアップファイル
 * 各テストファイル実行前に読み込まれます
 */

import { config } from 'dotenv';
import path from 'path';

// 結合テスト用環境変数ファイルを読み込み
const envPath = path.resolve(__dirname, '../../.env.integration');
config({ path: envPath });

// タイムゾーン設定
process.env.TZ = 'Asia/Tokyo';

// Node.js警告を抑制
process.env.NODE_NO_WARNINGS = '1';

// Discord.js警告を抑制（テスト用）
process.env.NODE_OPTIONS = '--no-deprecation';

console.log('🔧 結合テスト用セットアップ完了');
console.log(`📁 環境変数ファイル: ${envPath}`);
console.log(`🕐 タイムゾーン: ${process.env.TZ}`);

// 必要な環境変数の存在確認（早期エラー検出）
const requiredEnvVars = [
  'INTEGRATION_DISCORD_TOKEN',
  'TEST_GUILD_ID',
  'TEST_CATEGORY_ID', 
  'TEST_ADMIN_USER_ID',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ 結合テストに必要な環境変数が不足しています:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n.env.integration ファイルを作成し、必要な値を設定してください。');
  process.exit(1);
}

console.log('✅ 必要な環境変数が設定されています');