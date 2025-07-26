/**
 * アプリケーション固有のエラークラス
 */

/**
 * ベースエラークラス
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date;
  readonly context?: Record<string, any>;

  constructor(message: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    
    // Error.captureStackTrace が利用可能な場合（Node.js環境）
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * エラーの詳細情報を取得
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * 設定エラー
 */
export class ConfigurationError extends AppError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;

  constructor(message: string, context?: Record<string, any>) {
    super(`Configuration error: ${message}`, context);
  }
}

/**
 * データベースエラー
 */
export class DatabaseError extends AppError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;

  constructor(message: string, originalError?: Error, context?: Record<string, any>) {
    super(`Database error: ${message}`, {
      ...context,
      originalError: originalError ? {
        name: originalError.name,
        message: originalError.message,
        stack: originalError.stack,
      } : undefined,
    });
  }
}

/**
 * Discord API エラー
 */
export class DiscordError extends AppError {
  readonly code = 'DISCORD_ERROR';
  readonly statusCode = 502;

  constructor(message: string, context?: Record<string, any>) {
    super(`Discord API error: ${message}`, context);
  }
}

/**
 * 外部API エラー
 */
export class ExternalApiError extends AppError {
  readonly code = 'EXTERNAL_API_ERROR';
  readonly statusCode = 502;

  constructor(service: string, message: string, context?: Record<string, any>) {
    super(`${service} API error: ${message}`, context);
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, context?: Record<string, any>) {
    super(`Validation error: ${message}`, context);
  }
}

/**
 * 権限エラー
 */
export class PermissionError extends AppError {
  readonly code = 'PERMISSION_ERROR';
  readonly statusCode = 403;

  constructor(message: string, context?: Record<string, any>) {
    super(`Permission error: ${message}`, context);
  }
}

/**
 * リソースが見つからないエラー
 */
export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND_ERROR';
  readonly statusCode = 404;

  constructor(resource: string, identifier?: string, context?: Record<string, any>) {
    const message = identifier 
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;
    super(message, context);
  }
}

/**
 * 処理タイムアウトエラー
 */
export class TimeoutError extends AppError {
  readonly code = 'TIMEOUT_ERROR';
  readonly statusCode = 408;

  constructor(operation: string, timeoutMs: number, context?: Record<string, any>) {
    super(`Operation timeout: ${operation} (${timeoutMs}ms)`, context);
  }
}

/**
 * レート制限エラー
 */
export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMIT_ERROR';
  readonly statusCode = 429;

  constructor(service: string, retryAfter?: number, context?: Record<string, any>) {
    const message = retryAfter 
      ? `Rate limit exceeded for ${service}. Retry after ${retryAfter} seconds.`
      : `Rate limit exceeded for ${service}`;
    super(message, {
      ...context,
      retryAfter,
    });
  }
}

/**
 * エラーをAppErrorにラップするヘルパー
 */
export function wrapError(error: unknown, fallbackMessage = 'Unknown error occurred'): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof Error) {
    // 具象エラークラスを作成
    class GenericAppError extends AppError {
      readonly code = 'GENERIC_ERROR';
      readonly statusCode = 500;
    }
    return new GenericAppError(error.message);
  }
  
  // 具象エラークラスを作成
  class GenericAppError extends AppError {
    readonly code = 'GENERIC_ERROR';
    readonly statusCode = 500;
  }
  return new GenericAppError(fallbackMessage);
}

/**
 * エラーハンドリングのユーティリティ
 */
export class ErrorHandler {
  /**
   * エラーを安全にログ出力する
   */
  static logError(error: unknown, logger: { error: (msg: string, err?: Error, meta?: any) => void }): void {
    if (error instanceof AppError) {
      logger.error(error.message, error, error.context);
    } else if (error instanceof Error) {
      logger.error(error.message, error);
    } else {
      logger.error('Unknown error occurred', undefined, { error });
    }
  }

  /**
   * ユーザー向けのエラーメッセージを生成
   */
  static getUserMessage(error: unknown): string {
    if (error instanceof AppError) {
      switch (error.code) {
        case 'VALIDATION_ERROR':
        case 'PERMISSION_ERROR':
        case 'NOT_FOUND_ERROR':
          return error.message;
        
        case 'RATE_LIMIT_ERROR':
          return 'サービスが一時的に利用できません。しばらく時間をおいて再試行してください。';
        
        case 'TIMEOUT_ERROR':
          return '処理がタイムアウトしました。再試行してください。';
        
        default:
          return 'システムエラーが発生しました。管理者にお問い合わせください。';
      }
    }
    
    return '予期しないエラーが発生しました。管理者にお問い合わせください。';
  }

  /**
   * エラーが再試行可能かどうかを判定
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof AppError) {
      return ['TIMEOUT_ERROR', 'RATE_LIMIT_ERROR', 'EXTERNAL_API_ERROR'].includes(error.code);
    }
    return false;
  }
}

/**
 * 非同期処理のエラーを安全にキャッチするヘルパー
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorHandler?: (error: unknown) => T | Promise<T>
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (errorHandler) {
      return await errorHandler(error);
    }
    return null;
  }
}

/**
 * 複数の非同期処理を並列実行し、エラーを収集
 */
export async function safeParallel<T>(
  operations: (() => Promise<T>)[],
  options: {
    maxConcurrency?: number;
    continueOnError?: boolean;
  } = {}
): Promise<{
  results: (T | null)[];
  errors: unknown[];
}> {
  const { maxConcurrency = Infinity, continueOnError = true } = options;
  const results: (T | null)[] = [];
  const errors: unknown[] = [];

  // セマフォを使った並行制御
  let activeCount = 0;
  let index = 0;

  const executeNext = async (): Promise<void> => {
    while (index < operations.length && activeCount < maxConcurrency) {
      const currentIndex = index++;
      const operation = operations[currentIndex];
      activeCount++;

      try {
        const result = await operation();
        results[currentIndex] = result;
      } catch (error) {
        errors.push(error);
        results[currentIndex] = null;
        
        if (!continueOnError) {
          throw error;
        }
      } finally {
        activeCount--;
        
        // 次の処理があれば実行
        if (index < operations.length) {
          await executeNext();
        }
      }
    }
  };

  await executeNext();

  return { results, errors };
}