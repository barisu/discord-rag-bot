import { Message } from 'discord.js';
import { 
  resolveService, 
  SERVICES,
  type MessageFetcher,
  type LinkProcessor,
  type KeywordExtractor,
  type Logger,
  type Config
} from '@shared/core';
import { InitDbCommandHandler } from './handlers/init-db.handler';

/**
 * リファクタリングされたInitDbCommand
 * 依存性注入を使用し、実際の処理はハンドラーに委譲
 */
export class InitDbCommand {
  private readonly handler: InitDbCommandHandler;

  constructor() {
    // サービスコンテナから依存関係を解決
    const messageFetcher = resolveService<MessageFetcher>(SERVICES.MESSAGE_FETCHER);
    const linkProcessor = resolveService<LinkProcessor>(SERVICES.LINK_PROCESSOR);
    const embeddings = resolveService(SERVICES.OPENAI_EMBEDDINGS);
    const chunker = resolveService(SERVICES.SEMANTIC_CHUNKER);
    const keywordExtractor = resolveService<KeywordExtractor>(SERVICES.KEYWORD_EXTRACTOR);
    const vectorStore = resolveService(SERVICES.VECTOR_STORE);
    const config = resolveService<Config>(SERVICES.CONFIG);
    const logger = resolveService<Logger>(SERVICES.LOGGER);

    // ハンドラーを初期化
    this.handler = new InitDbCommandHandler(
      messageFetcher,
      linkProcessor,
      embeddings,
      chunker,
      keywordExtractor,
      vectorStore,
      config,
      logger
    );
  }

  /**
   * コマンド実行
   */
  async execute(message: Message, args: string[]): Promise<void> {
    return this.handler.execute(message, args);
  }
}

/**
 * ファクトリー関数
 */
export function createInitDbCommand(): InitDbCommand {
  return new InitDbCommand();
}