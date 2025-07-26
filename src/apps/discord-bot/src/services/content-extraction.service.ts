import type { 
  LinkProcessor, 
  ProcessedContent, 
  MessageData,
  Logger,
  ProgressTracker 
} from '@shared/core';
import { 
  getDatabaseConnection, 
  sourceDocuments,
  ExternalApiError,
  safeParallel 
} from '@shared/core';

/**
 * コンテンツ抽出サービス
 * リンクからコンテンツを抽出してデータベースに保存
 */
export class ContentExtractionService {
  constructor(
    private readonly linkProcessor: LinkProcessor,
    private readonly logger: Logger
  ) {}

  /**
   * メッセージのリンクからコンテンツを抽出して保存
   */
  async extractAndSaveContent(
    messagesWithLinks: MessageData[],
    progressTracker: ProgressTracker
  ): Promise<Array<{
    sourceDocId: number;
    content: ProcessedContent;
    messageId: string;
  }>> {
    const db = getDatabaseConnection();
    const results: Array<{
      sourceDocId: number;
      content: ProcessedContent;
      messageId: string;
    }> = [];

    this.logger.info('Starting content extraction', {
      messageCount: messagesWithLinks.length,
      totalLinks: messagesWithLinks.reduce((sum, msg) => sum + msg.links.length, 0),
    });

    // 並列処理の設定
    const maxConcurrency = 5; // 外部APIの負荷を考慮

    for (let i = 0; i < messagesWithLinks.length; i++) {
      const message = messagesWithLinks[i];
      
      await progressTracker.update({
        currentStep: `リンク処理中: ${i + 1}/${messagesWithLinks.length}`,
        metadata: {
          currentMessage: i + 1,
          totalMessages: messagesWithLinks.length,
          messageId: message.id,
        },
      });

      try {
        // リンクを並列処理
        const linkResults = await this.processLinksInParallel(
          message.links,
          maxConcurrency
        );

        // 成功したコンテンツのみ処理
        for (const content of linkResults.filter(Boolean)) {
          if (content) {
            const sourceDocId = await this.saveSourceDocument(content, message);
            results.push({
              sourceDocId,
              content,
              messageId: message.id,
            });
          }
        }

      } catch (error) {
        this.logger.warn('Failed to process message links', error instanceof Error ? error : undefined, {
          messageId: message.id,
          linkCount: message.links.length,
        });
        // エラーがあっても続行
      }

      // 定期的な進捗更新（10件ごと）
      if (i % 10 === 0) {
        await progressTracker.update({
          metadata: {
            documentsCreated: results.length,
            messagesProcessed: i + 1,
          },
        });
      }
    }

    this.logger.info('Content extraction completed', {
      messagesProcessed: messagesWithLinks.length,
      documentsCreated: results.length,
    });

    return results;
  }

  /**
   * リンクを並列処理
   */
  private async processLinksInParallel(
    links: string[],
    maxConcurrency: number
  ): Promise<(ProcessedContent | null)[]> {
    const operations = links.map(link => async () => {
      try {
        const results = await this.linkProcessor.processLinks([link]);
        return results[0] || null;
      } catch (error) {
        this.logger.debug('Failed to process link', error instanceof Error ? error : undefined, { link });
        return null;
      }
    });

    const { results } = await safeParallel(operations, {
      maxConcurrency,
      continueOnError: true,
    });

    return results;
  }

  /**
   * ソースドキュメントをデータベースに保存
   */
  private async saveSourceDocument(
    content: ProcessedContent,
    message: MessageData
  ): Promise<number> {
    const db = getDatabaseConnection();

    try {
      const [sourceDoc] = await db
        .insert(sourceDocuments)
        .values({
          url: content.originalUrl,
          title: content.title,
          fullContent: content.content,
          metadata: {
            description: content.metadata.description,
            domain: content.metadata.domain,
            extractionMethod: content.metadata.extractionMethod,
            contentLength: content.content.length,
          },
          messageId: message.id,
          channelId: message.channelId,
          authorId: message.authorId,
          processedAt: content.metadata.processedAt,
        })
        .returning();

      this.logger.debug('Source document saved', {
        sourceDocId: sourceDoc.id,
        url: content.originalUrl,
        contentLength: content.content.length,
      });

      return sourceDoc.id;

    } catch (error) {
      this.logger.error('Failed to save source document', error instanceof Error ? error : undefined, {
        url: content.originalUrl,
        messageId: message.id,
      });
      throw new ExternalApiError('Database', 'Failed to save source document');
    }
  }

  /**
   * コンテンツ抽出の統計を取得
   */
  getExtractionStats(results: Array<{ content: ProcessedContent }>): {
    totalDocuments: number;
    totalContentLength: number;
    averageContentLength: number;
    extractionMethods: Record<string, number>;
    domains: Record<string, number>;
  } {
    const totalDocuments = results.length;
    const totalContentLength = results.reduce((sum, r) => sum + r.content.content.length, 0);
    const averageContentLength = totalDocuments > 0 ? totalContentLength / totalDocuments : 0;

    const extractionMethods: Record<string, number> = {};
    const domains: Record<string, number> = {};

    for (const result of results) {
      const method = result.content.metadata.extractionMethod;
      const domain = result.content.metadata.domain;

      extractionMethods[method] = (extractionMethods[method] || 0) + 1;
      domains[domain] = (domains[domain] || 0) + 1;
    }

    return {
      totalDocuments,
      totalContentLength,
      averageContentLength: Math.round(averageContentLength),
      extractionMethods,
      domains,
    };
  }
}