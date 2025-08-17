import { z } from 'zod';

/**
 * 環境変数の型定義とバリデーション
 */
const ConfigSchema = z.object({
  // Discord設定
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  
  // データベース設定
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // AI API設定
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  OPENAI_API_KEY: z.string().optional(), // オプショナル（RAG機能で使用、基本機能では不要）
  
  // オプション設定
  API_PORT: z.string().regex(/^\d+$/, 'API_PORT must be a number').default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // RAG設定
  CHUNK_SIZE: z.string().regex(/^\d+$/, 'CHUNK_SIZE must be a number').default('1000'),
  CHUNK_OVERLAP: z.string().regex(/^\d+$/, 'CHUNK_OVERLAP must be a number').default('200'),
  MAX_CHUNKS_PER_QUERY: z.string().regex(/^\d+$/, 'MAX_CHUNKS_PER_QUERY must be a number').default('5'),
  
  // キーワード抽出設定
  MAX_KEYWORDS: z.string().regex(/^\d+$/, 'MAX_KEYWORDS must be a number').default('8'),
  MIN_CONFIDENCE: z.string().regex(/^0?\.\d+$|^1$/, 'MIN_CONFIDENCE must be between 0 and 1').default('0.6'),
  MIN_BM25_SCORE: z.string().regex(/^0?\.\d+$|^1$/, 'MIN_BM25_SCORE must be between 0 and 1').default('0.1'),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * 環境変数をパースして設定オブジェクトを作成
 */
export function createConfig(): Config {
  try {
    return ConfigSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingFields = error.errors.map(err => err.path.join('.')).join(', ');
      throw new Error(
        `Environment configuration error: ${missingFields}\n` +
        'Please check your .env file and ensure all required variables are set.'
      );
    }
    throw error;
  }
}

/**
 * 設定値を数値に変換するヘルパー
 */
export function getNumberConfig(config: Config, key: keyof Config): number {
  const value = config[key] as string;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Configuration ${key} must be a valid number, got: ${value}`);
  }
  return parsed;
}

/**
 * 設定値を浮動小数点数に変換するヘルパー
 */
export function getFloatConfig(config: Config, key: keyof Config): number {
  const value = config[key] as string;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Configuration ${key} must be a valid number, got: ${value}`);
  }
  return parsed;
}

/**
 * デフォルト設定インスタンス（シングルトン）
 */
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = createConfig();
  }
  return configInstance;
}

/**
 * テスト用の設定リセット
 */
export function resetConfig(): void {
  configInstance = null;
}