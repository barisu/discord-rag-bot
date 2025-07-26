import type { ServiceContainer } from './container';
import { SERVICES, SimpleContainer } from './container';
import { createConfig, type Config } from './config';
import { createLogger, type Logger } from './logger';
import { createDatabaseConnection } from '../database/connection';
import { GeminiClient } from '../llm/gemini-client';
import { MessageFetcher } from '../discord/message-fetcher';
import { LinkProcessor } from '../content/link-processor';
import { KeywordExtractor } from '../keywords/keyword-extractor';
import { BM25Calculator } from '../keywords/bm25-calculator';

/**
 * ブートストラップオプション
 */
export interface BootstrapOptions {
  container?: ServiceContainer;
  discordClient?: any; // Discord.jsのClient型
  skipDatabaseConnection?: boolean;
}

/**
 * 共通サービスを登録する
 */
export function registerCoreServices(container: ServiceContainer, options: BootstrapOptions = {}): void {
  // 設定を登録（シングルトン）
  container.registerSingleton(SERVICES.CONFIG, () => {
    return createConfig();
  });

  // ロガーを登録（シングルトン）
  container.registerSingleton(SERVICES.LOGGER, (container) => {
    const config = container.get<Config>(SERVICES.CONFIG);
    return createLogger(config, { service: 'discord-rag-bot' });
  });

  // データベース接続を登録（シングルトン）
  if (!options.skipDatabaseConnection) {
    container.registerSingleton(SERVICES.DATABASE_CONNECTION, (container) => {
      const config = container.get<Config>(SERVICES.CONFIG);
      const logger = container.get<Logger>(SERVICES.LOGGER);
      
      try {
        return createDatabaseConnection(config.DATABASE_URL);
      } catch (error) {
        logger.error('Failed to create database connection', error instanceof Error ? error : undefined);
        throw error;
      }
    });
  }

  // Geminiクライアントを登録（シングルトン）
  container.registerSingleton(SERVICES.GEMINI_CLIENT, (container) => {
    const config = container.get<Config>(SERVICES.CONFIG);
    const logger = container.get<Logger>(SERVICES.LOGGER);
    
    logger.debug('Creating Gemini client');
    return new GeminiClient(config.GEMINI_API_KEY);
  });

  // BM25計算器を登録（シングルトン）
  container.registerSingleton(SERVICES.BM25_CALCULATOR, () => {
    return new BM25Calculator();
  });

  // キーワード抽出器を登録（シングルトン）
  container.registerSingleton(SERVICES.KEYWORD_EXTRACTOR, (container) => {
    const config = container.get<Config>(SERVICES.CONFIG);
    const geminiClient = container.get<GeminiClient>(SERVICES.GEMINI_CLIENT);
    const bm25Calculator = container.get<BM25Calculator>(SERVICES.BM25_CALCULATOR);
    
    return new KeywordExtractor(geminiClient, bm25Calculator, {
      maxKeywords: parseInt(config.MAX_KEYWORDS, 10),
      minConfidence: parseFloat(config.MIN_CONFIDENCE),
      minBm25Score: parseFloat(config.MIN_BM25_SCORE),
    });
  });

  // リンクプロセッサを登録（シングルトン）
  container.registerSingleton(SERVICES.LINK_PROCESSOR, (container) => {
    const logger = container.get<Logger>(SERVICES.LOGGER);
    logger.debug('Creating link processor');
    return new LinkProcessor();
  });

  // メッセージフェッチャーを登録（条件付き）
  if (options.discordClient) {
    container.registerSingleton(SERVICES.MESSAGE_FETCHER, (container) => {
      const logger = container.get<Logger>(SERVICES.LOGGER);
      logger.debug('Creating message fetcher');
      return new MessageFetcher(options.discordClient);
    });
  }
}

/**
 * アプリケーション初期化のブートストラップ
 */
export function bootstrap(options: BootstrapOptions = {}): {
  container: ServiceContainer;
  config: Config;
  logger: Logger;
} {
  const container = options.container || new SimpleContainer();
  
  // コアサービスを登録
  registerCoreServices(container, options);
  
  // 基本的なサービスを取得
  const config = container.get<Config>(SERVICES.CONFIG);
  const logger = container.get<Logger>(SERVICES.LOGGER);
  
  logger.info('Application bootstrap completed', {
    nodeEnv: config.NODE_ENV,
    logLevel: config.LOG_LEVEL,
  });

  return {
    container,
    config,
    logger,
  };
}

/**
 * アプリケーション設定の検証
 */
export function validateConfiguration(config: Config): void {
  const requiredKeys: (keyof Config)[] = [
    'DISCORD_TOKEN',
    'DATABASE_URL',
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
  ];

  const missingKeys = requiredKeys.filter(key => !config[key]);
  
  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required configuration: ${missingKeys.join(', ')}\n` +
      'Please check your .env file.'
    );
  }
}

/**
 * 設定値をテスト環境用にオーバーライドするヘルパー
 */
export function createTestConfig(overrides: Partial<Config> = {}): Config {
  return {
    DISCORD_TOKEN: 'test-token',
    DATABASE_URL: 'postgres://test:test@localhost:5433/test',
    GEMINI_API_KEY: 'test-gemini-key',
    OPENAI_API_KEY: 'test-openai-key',
    API_PORT: '3001',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error', // テスト時はエラーのみログ出力
    CHUNK_SIZE: '1000',
    CHUNK_OVERLAP: '200',
    MAX_CHUNKS_PER_QUERY: '5',
    MAX_KEYWORDS: '8',
    MIN_CONFIDENCE: '0.6',
    MIN_BM25_SCORE: '0.1',
    ...overrides,
  };
}