/**
 * 結合テスト用環境設定
 */

export interface IntegrationConfig {
  /** テスト用Discord Botトークン */
  DISCORD_TOKEN: string;
  /** テスト用データベースURL */
  DATABASE_URL: string;
  /** テスト用Discord サーバーID */
  TEST_GUILD_ID: string;
  /** テスト用カテゴリID */
  TEST_CATEGORY_ID: string;
  /** テスト用管理者ユーザーID */
  TEST_ADMIN_USER_ID: string;
  /** テスト用一般ユーザーID */
  TEST_REGULAR_USER_ID: string;
  /** テストタイムアウト（ミリ秒） */
  TEST_TIMEOUT: number;
  /** API ポート */
  API_PORT: number;
}

/**
 * 結合テスト設定を取得
 * 環境変数から必要な設定を読み込み、バリデーションを行います
 */
export function getIntegrationConfig(): IntegrationConfig {
  const requiredEnvVars = [
    'INTEGRATION_DISCORD_TOKEN',
    'TEST_GUILD_ID',
    'TEST_CATEGORY_ID', 
    'TEST_ADMIN_USER_ID',
    'TEST_REGULAR_USER_ID',
  ];

  // 必須環境変数のチェック
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(
      `結合テストに必要な環境変数が不足しています: ${missingVars.join(', ')}\n` +
      '.env.integration ファイルを作成し、必要な値を設定してください。'
    );
  }

  return {
    DISCORD_TOKEN: process.env.INTEGRATION_DISCORD_TOKEN!,
    DATABASE_URL: process.env.INTEGRATION_DATABASE_URL || 'postgres://test:test@localhost:5433/discord_rag_bot_test',
    TEST_GUILD_ID: process.env.TEST_GUILD_ID!,
    TEST_CATEGORY_ID: process.env.TEST_CATEGORY_ID!,
    TEST_ADMIN_USER_ID: process.env.TEST_ADMIN_USER_ID!,
    TEST_REGULAR_USER_ID: process.env.TEST_REGULAR_USER_ID!,
    TEST_TIMEOUT: parseInt(process.env.TEST_TIMEOUT || '30000'),
    API_PORT: parseInt(process.env.INTEGRATION_API_PORT || '3002'),
  };
}

/**
 * テスト用データベース設定
 */
export const TEST_DATABASE_CONFIG = {
  host: 'localhost',
  port: 5433,
  database: 'discord_rag_bot_test',
  username: 'test',
  password: 'test',
} as const;

/**
 * 結合テストで使用するテスト用URL
 * 実際のWebサイトに負荷をかけないよう、テスト用の既知のURLを使用
 */
export const TEST_URLS = {
  VALID_LINK: 'https://httpbin.org/html', // HTMLレスポンスを返すテスト用URL
  INVALID_LINK: 'https://httpbin.org/status/404', // 404エラーを返すURL
  SLOW_LINK: 'https://httpbin.org/delay/2', // 2秒遅延するURL
} as const;

/**
 * Discord テスト用メッセージ定型文
 */
export const TEST_MESSAGES = {
  INIT_DB_COMMAND: '!init-db',
  PING_COMMAND: '!ping',
  WITH_LINKS: `テストメッセージです。こちらのリンクをチェック: ${TEST_URLS.VALID_LINK}`,
  WITH_MULTIPLE_LINKS: `複数リンクテスト: ${TEST_URLS.VALID_LINK} and ${TEST_URLS.INVALID_LINK}`,
} as const;