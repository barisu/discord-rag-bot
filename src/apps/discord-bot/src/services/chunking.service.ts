import type {
  ProcessedContent,
  Logger,
  ProgressTracker,
  Config
} from '@shared/core';
import {
  getDatabaseConnection,
  documentChunks,
  getNumberConfig,
  ExternalApiError,
  safeAsync
} from '@shared/core';

export interface ChunkResult {
  chunkId: number;
  content: string;
  index: number;
  sourceDocId: number;
}

/**
 * チャンキングサービス
 * コンテンツを意味的なチャンクに分割してデータベースに保存
 */
export class ChunkingService {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(
    private readonly chunker: any,
    private readonly config: Config,
    private readonly logger: Logger
  ) {
    this.chunkSize = getNumberConfig(config, 'CHUNK_SIZE');
    this.chunkOverlap = getNumberConfig(config, 'CHUNK_OVERLAP');
  }

  /**
   * コンテンツをチャンク化してデータベースに保存
   */
  async processChunks(
    extractedContents: Array<{
      sourceDocId: number;
      content: ProcessedContent;
      messageId: string;
    }>,
    progressTracker: ProgressTracker
  ): Promise<ChunkResult[]> {
    const results: ChunkResult[] = [];

    this.logger.info('Starting content chunking', {
      documentCount: extractedContents.length,
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });

    for (let i = 0; i < extractedContents.length; i++) {
      const { sourceDocId, content } = extractedContents[i];

      await progressTracker.update({
        currentStep: `チャンク化中: ${i + 1}/${extractedContents.length}`,
        metadata: {
          currentDocument: i + 1,
          totalDocuments: extractedContents.length,
          sourceDocId,
          contentLength: content.content.length,
        },
      });

      try {
        const chunks = await this.chunkContent(content.content, sourceDocId);
        results.push(...chunks);

        this.logger.debug('Document chunked successfully', {
          sourceDocId,
          chunkCount: chunks.length,
          contentLength: content.content.length,
        });

      } catch (error) {
        this.logger.warn('Failed to chunk document', {
          sourceDocId,
          contentLength: content.content.length,
        });
        // エラーがあっても続行
      }

      // 進捗更新
      await progressTracker.update({
        metadata: {
          chunksCreated: results.length,
          documentsProcessed: i + 1,
        },
      });
    }

    this.logger.info('Content chunking completed', {
      documentsProcessed: extractedContents.length,
      totalChunks: results.length,
    });

    return results;
  }

  /**
   * 単一のコンテンツをチャンク化
   */
  private async chunkContent(content: string, sourceDocId: number): Promise<ChunkResult[]> {
    const db = getDatabaseConnection();

    try {
      // セマンティックチャンカーを使用
      const chunks = await this.chunker.chunk(content);
      const results: ChunkResult[] = [];

      // チャンクをデータベースに保存
      for (const chunk of chunks) {
        const result = await safeAsync(async () => {
          const [chunkDoc] = await db
            .insert(documentChunks)
            .values({
              sourceDocumentId: sourceDocId,
              content: chunk.content,
              chunkIndex: chunk.index,
              startPosition: null, // 将来的に実装可能
              endPosition: null,   // 将来的に実装可能
              metadata: {
                chunkLength: chunk.content.length,
                totalChunks: chunks.length,
                chunkingMethod: 'semantic',
              },
            })
            .returning();

          return chunkDoc;
        });

        if (result) {
          results.push({
            chunkId: result.id,
            content: chunk.content,
            index: chunk.index,
            sourceDocId,
          });
        } else {
          this.logger.warn('Failed to save chunk', {
            sourceDocId,
            chunkIndex: chunk.index,
          });
        }
      }

      return results;

    } catch (error) {
      this.logger.error('Chunking failed', error instanceof Error ? error : undefined, {
        sourceDocId,
        contentLength: content.length,
      });
      throw new ExternalApiError('Chunking', 'Failed to chunk content');
    }
  }

  /**
   * フォールバック: シンプルなテキスト分割
   */
  private async fallbackChunking(content: string, sourceDocId: number): Promise<ChunkResult[]> {
    const db = getDatabaseConnection();
    const results: ChunkResult[] = [];

    this.logger.info('Using fallback chunking method', { sourceDocId });

    // シンプルな段落分割
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // チャンクサイズを超える場合は保存
      if (currentChunk.length + paragraph.length > this.chunkSize && currentChunk.length > 0) {
        const result = await this.saveFallbackChunk(currentChunk, sourceDocId, chunkIndex);
        if (result) {
          results.push(result);
        }
        
        currentChunk = paragraph;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    // 最後のチャンクを保存
    if (currentChunk.length > 0) {
      const result = await this.saveFallbackChunk(currentChunk, sourceDocId, chunkIndex);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * フォールバックチャンクの保存
   */
  private async saveFallbackChunk(
    content: string,
    sourceDocId: number,
    index: number
  ): Promise<ChunkResult | null> {
    const db = getDatabaseConnection();

    const result = await safeAsync(async () => {
      const [chunkDoc] = await db
        .insert(documentChunks)
        .values({
          sourceDocumentId: sourceDocId,
          content,
          chunkIndex: index,
          startPosition: null,
          endPosition: null,
          metadata: {
            chunkLength: content.length,
            chunkingMethod: 'fallback',
          },
        })
        .returning();

      return chunkDoc;
    });

    return result ? {
      chunkId: result.id,
      content,
      index,
      sourceDocId,
    } : null;
  }

  /**
   * チャンキング統計を取得
   */
  getChunkingStats(chunks: ChunkResult[]): {
    totalChunks: number;
    averageChunkLength: number;
    minChunkLength: number;
    maxChunkLength: number;
    documentsChunked: number;
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        averageChunkLength: 0,
        minChunkLength: 0,
        maxChunkLength: 0,
        documentsChunked: 0,
      };
    }

    const lengths = chunks.map(chunk => chunk.content.length);
    const totalLength = lengths.reduce((sum, len) => sum + len, 0);
    const uniqueDocuments = new Set(chunks.map(chunk => chunk.sourceDocId)).size;

    return {
      totalChunks: chunks.length,
      averageChunkLength: Math.round(totalLength / chunks.length),
      minChunkLength: Math.min(...lengths),
      maxChunkLength: Math.max(...lengths),
      documentsChunked: uniqueDocuments,
    };
  }
}