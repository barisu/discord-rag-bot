import type { Config } from './config';

/**
 * ログレベル
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * ログメタデータ
 */
export interface LogMetadata {
  [key: string]: any;
}

/**
 * ロガーインターフェース
 */
export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, error?: Error, metadata?: LogMetadata): void;
  setLevel(level: LogLevel): void;
  child(defaultMetadata: LogMetadata): Logger;
}

/**
 * ログレベルの優先度
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * シンプルなコンソールロガー実装
 */
export class ConsoleLogger implements Logger {
  private level: LogLevel;
  private defaultMetadata: LogMetadata;

  constructor(level: LogLevel = 'info', defaultMetadata: LogMetadata = {}) {
    this.level = level;
    this.defaultMetadata = defaultMetadata;
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: LogMetadata): void {
    const enrichedMetadata = {
      ...metadata,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };
    this.log('error', message, enrichedMetadata);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  child(defaultMetadata: LogMetadata): Logger {
    return new ConsoleLogger(this.level, {
      ...this.defaultMetadata,
      ...defaultMetadata,
    });
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const combinedMetadata = {
      ...this.defaultMetadata,
      ...metadata,
    };

    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(Object.keys(combinedMetadata).length > 0 && { metadata: combinedMetadata }),
    };

    const output = JSON.stringify(logEntry, null, 2);

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }
}

/**
 * 設定に基づいてロガーを作成
 */
export function createLogger(config: Config, defaultMetadata: LogMetadata = {}): Logger {
  return new ConsoleLogger(config.LOG_LEVEL, {
    environment: config.NODE_ENV,
    ...defaultMetadata,
  });
}

/**
 * 特定のコンテキスト用のロガーを作成するヘルパー
 */
export function createContextLogger(
  baseLogger: Logger,
  context: string,
  metadata: LogMetadata = {}
): Logger {
  return baseLogger.child({
    context,
    ...metadata,
  });
}