import type {
  OpenAIEmbeddings,
  Logger,
  ProgressTracker,
} from '@shared/core';
import {
  getDatabaseConnection,
  embeddings,
  ExternalApiError,
  RateLimitError,
  safeAsync,
  safeParallel
} from '@shared/core';
import type { ChunkResult } from './chunking.service';

export interface EmbeddingResult {
  chunkId: number;
  embedding: number[];
  success: boolean;
}

/**
 * 埋め込み生成サービス
 * チャンクのベクトル埋め込みを生成してデータベースに保存
 */
export class EmbeddingService {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 1000;
  private static readonly BATCH_SIZE = 10;

  constructor(
    private readonly embeddings: OpenAIEmbeddings,
    private readonly logger: Logger
  ) {}

  /**
   * チャンクの埋め込みを生成して保存
   */
  async generateEmbeddings(
    chunks: ChunkResult[],
    progressTracker: ProgressTracker
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    this.logger.info('Starting embedding generation', {
      chunkCount: chunks.length,
      batchSize: EmbeddingService.BATCH_SIZE,
    });

    // バッチ処理
    for (let i = 0; i < chunks.length; i += EmbeddingService.BATCH_SIZE) {
      const batch = chunks.slice(i, i + EmbeddingService.BATCH_SIZE);
      
      await progressTracker.update({
        currentStep: `埋め込み生成中: ${i + batch.length}/${chunks.length}`,
        metadata: {
          currentBatch: Math.floor(i / EmbeddingService.BATCH_SIZE) + 1,
          totalBatches: Math.ceil(chunks.length / EmbeddingService.BATCH_SIZE),
          processedChunks: i + batch.length,
          totalChunks: chunks.length,
        },
      });

      try {
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);

      } catch (error) {
        this.logger.warn('Batch embedding generation failed', error instanceof Error ? error : undefined, {
          batchStart: i,
          batchSize: batch.length,
        });

        // 失敗したバッチは個別処理にフォールバック
        const fallbackResults = await this.processBatchIndividually(batch);
        results.push(...fallbackResults);
      }

      // レート制限を避けるための遅延
      if (i + EmbeddingService.BATCH_SIZE < chunks.length) {
        await this.delay(500);
      }
    }

    this.logger.info('Embedding generation completed', {
      totalChunks: chunks.length,
      successfulEmbeddings: results.filter(r => r.success).length,
      failedEmbeddings: results.filter(r => !r.success).length,
    });

    return results;
  }

  /**
   * バッチで埋め込みを処理
   */
  private async processBatch(chunks: ChunkResult[]): Promise<EmbeddingResult[]> {
    const contents = chunks.map(chunk => chunk.content);
    
    try {
      // バッチで埋め込み生成
      const embeddingVectors = await this.embeddings.embedBatch(contents);
      
      // データベースに保存
      const results: EmbeddingResult[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddingVectors[i];
        
        const success = await this.saveEmbedding(chunk.chunkId, embedding);
        results.push({
          chunkId: chunk.chunkId,
          embedding,
          success,
        });
      }

      return results;

    } catch (error) {
      this.logger.error('Batch embedding failed', error instanceof Error ? error : undefined, {
        chunkCount: chunks.length,
      });
      throw error;
    }
  }

  /**
   * バッチ処理に失敗した場合の個別処理
   */
  private async processBatchIndividually(chunks: ChunkResult[]): Promise<EmbeddingResult[]> {
    this.logger.info('Processing chunks individually', { chunkCount: chunks.length });
    
    const operations = chunks.map(chunk => async () => {
      return await this.processChunkWithRetry(chunk);
    });

    const { results } = await safeParallel(operations, {
      maxConcurrency: 3, // 個別処理時は並行度を下げる
      continueOnError: true,
    });

    return results.filter(Boolean) as EmbeddingResult[];
  }

  /**
   * 単一チャンクの埋め込みをリトライ付きで処理
   */
  private async processChunkWithRetry(chunk: ChunkResult): Promise<EmbeddingResult | null> {
    for (let attempt = 1; attempt <= EmbeddingService.MAX_RETRIES; attempt++) {
      try {
        const embedding = await this.embeddings.embed(chunk.content);
        const success = await this.saveEmbedding(chunk.chunkId, embedding);
        
        return {
          chunkId: chunk.chunkId,
          embedding,
          success,
        };

      } catch (error) {
        this.logger.warn(`Embedding attempt ${attempt} failed`, error instanceof Error ? error : undefined, {
          chunkId: chunk.chunkId,
          attempt,
          maxRetries: EmbeddingService.MAX_RETRIES,
        });

        if (attempt < EmbeddingService.MAX_RETRIES) {
          // レート制限エラーの場合は長めに待機
          const delay = error instanceof RateLimitError ? 5000 : EmbeddingService.RETRY_DELAY_MS * attempt;
          await this.delay(delay);
        }
      }
    }

    this.logger.error('Failed to generate embedding after all retries', undefined, {
      chunkId: chunk.chunkId,
      maxRetries: EmbeddingService.MAX_RETRIES,
    });

    return {
      chunkId: chunk.chunkId,
      embedding: [],
      success: false,
    };
  }

  /**
   * 埋め込みをデータベースに保存
   */
  private async saveEmbedding(chunkId: number, embedding: number[]): Promise<boolean> {
    const db = getDatabaseConnection();

    const result = await safeAsync(async () => {
      await db
        .insert(embeddings)
        .values({
          chunkId,
          embedding,
        });
      return true;
    });

    if (result === null) {
      this.logger.warn('Failed to save embedding to database', { chunkId });
      return false;
    }

    return true;
  }

  /**
   * 指定時間待機
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 埋め込み生成の統計を取得
   */
  getEmbeddingStats(results: EmbeddingResult[]): {
    totalProcessed: number;
    successful: number;
    failed: number;
    successRate: number;
    averageEmbeddingDimensions: number;
  } {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const averageEmbeddingDimensions = successful.length > 0
      ? successful.reduce((sum, r) => sum + r.embedding.length, 0) / successful.length
      : 0;

    return {
      totalProcessed: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0,
      averageEmbeddingDimensions: Math.round(averageEmbeddingDimensions),
    };
  }
}