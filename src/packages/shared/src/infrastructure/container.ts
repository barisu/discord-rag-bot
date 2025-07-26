import type { Config } from './config';

/**
 * 依存性注入のためのサービス識別子
 */
export const SERVICES = {
  // 設定
  CONFIG: Symbol('Config'),
  
  // データベース
  DATABASE_CONNECTION: Symbol('DatabaseConnection'),
  
  // AI/LLM サービス
  GEMINI_CLIENT: Symbol('GeminiClient'),
  OPENAI_EMBEDDINGS: Symbol('OpenAIEmbeddings'),
  
  // コンテンツ処理
  MESSAGE_FETCHER: Symbol('MessageFetcher'),
  LINK_PROCESSOR: Symbol('LinkProcessor'),
  
  // RAG コンポーネント
  SEMANTIC_CHUNKER: Symbol('SemanticChunker'),
  KEYWORD_EXTRACTOR: Symbol('KeywordExtractor'),
  BM25_CALCULATOR: Symbol('BM25Calculator'),
  VECTOR_STORE: Symbol('VectorStore'),
  
  // ロガー
  LOGGER: Symbol('Logger'),
} as const;

/**
 * サービスコンテナのインターフェース
 */
export interface ServiceContainer {
  register<T>(token: symbol, factory: ServiceFactory<T>): void;
  registerSingleton<T>(token: symbol, factory: ServiceFactory<T>): void;
  get<T>(token: symbol): T;
  has(token: symbol): boolean;
  clear(): void;
}

/**
 * サービスファクトリー関数の型
 */
export type ServiceFactory<T> = (container: ServiceContainer) => T;

/**
 * サービス登録の情報
 */
interface ServiceRegistration<T = any> {
  factory: ServiceFactory<T>;
  singleton: boolean;
  instance?: T;
}

/**
 * シンプルな依存性注入コンテナの実装
 */
export class SimpleContainer implements ServiceContainer {
  private services = new Map<symbol, ServiceRegistration>();
  private resolving = new Set<symbol>();

  /**
   * 一時的なサービスを登録（毎回新しいインスタンスを作成）
   */
  register<T>(token: symbol, factory: ServiceFactory<T>): void {
    this.services.set(token, {
      factory,
      singleton: false,
    });
  }

  /**
   * シングルトンサービスを登録（初回のみインスタンス作成）
   */
  registerSingleton<T>(token: symbol, factory: ServiceFactory<T>): void {
    this.services.set(token, {
      factory,
      singleton: true,
    });
  }

  /**
   * サービスを取得
   */
  get<T>(token: symbol): T {
    const registration = this.services.get(token);
    if (!registration) {
      throw new Error(`Service not registered: ${token.toString()}`);
    }

    // 循環依存チェック
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected: ${token.toString()}`);
    }

    // シングルトンで既にインスタンス化済みの場合
    if (registration.singleton && registration.instance) {
      return registration.instance;
    }

    // インスタンス作成
    this.resolving.add(token);
    try {
      const instance = registration.factory(this);
      
      // シングルトンの場合はインスタンスを保存
      if (registration.singleton) {
        registration.instance = instance;
      }
      
      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }

  /**
   * サービスが登録されているかチェック
   */
  has(token: symbol): boolean {
    return this.services.has(token);
  }

  /**
   * 全サービスをクリア（主にテスト用）
   */
  clear(): void {
    this.services.clear();
    this.resolving.clear();
  }
}

/**
 * グローバルコンテナインスタンス
 */
let containerInstance: ServiceContainer | null = null;

/**
 * グローバルコンテナを取得
 */
export function getContainer(): ServiceContainer {
  if (!containerInstance) {
    containerInstance = new SimpleContainer();
  }
  return containerInstance;
}

/**
 * グローバルコンテナを設定
 */
export function setContainer(container: ServiceContainer): void {
  containerInstance = container;
}

/**
 * グローバルコンテナをリセット（主にテスト用）
 */
export function resetContainer(): void {
  containerInstance = null;
}

/**
 * コンテナから安全にサービスを取得するヘルパー
 */
export function resolveService<T>(token: symbol): T {
  return getContainer().get<T>(token);
}

/**
 * オプションでサービスを取得するヘルパー
 */
export function tryResolveService<T>(token: symbol): T | null {
  const container = getContainer();
  return container.has(token) ? container.get<T>(token) : null;
}