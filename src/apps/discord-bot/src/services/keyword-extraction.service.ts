import type {
  KeywordExtractor,
  Logger,
  ProgressTracker,
} from '@shared/core';
import {
  ExternalApiError,
  safeAsync,
  safeParallel
} from '@shared/core';
import type { ChunkResult } from './chunking.service';

export interface KeywordResult {
  chunkId: number;
  keywords: Array<{
    keyword: string;
    bm25Score: number;
    termFrequency: number;
    documentFrequency: number;
    embedding: number[];
  }>;
  success: boolean;
}

/**
 * キーワード抽出サービス
 * チャンクからキーワードを抽出して埋め込みと共にデータベースに保存
 */
export class KeywordExtractionService {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 2000;

  constructor(
    private readonly keywordExtractor: KeywordExtractor,
    private readonly embeddings: any,
    private readonly vectorStore: any,
    private readonly logger: Logger
  ) {}

  /**
   * チャンクからキーワードを抽出して保存
   */
  async extractKeywords(
    chunks: ChunkResult[],
    progressTracker: ProgressTracker
  ): Promise<KeywordResult[]> {
    const results: KeywordResult[] = [];

    this.logger.info('Starting keyword extraction', {
      chunkCount: chunks.length,
    });

    // BM25統計を取得（一度だけ）
    const documentStats = await this.getDocumentStats();

    // 並列処理の設定
    const maxConcurrency = 3; // LLMとembedding APIの負荷を考慮

    const operations = chunks.map((chunk, index) => async () => {
      await progressTracker.update({
        currentStep: `キーワード抽出中: ${index + 1}/${chunks.length}`,
        metadata: {
          currentChunk: index + 1,
          totalChunks: chunks.length,
          chunkId: chunk.chunkId,
        },
      });

      return await this.processChunkKeywords(chunk, documentStats);
    });

    const { results: chunkResults } = await safeParallel(operations, {
      maxConcurrency,
      continueOnError: true,
    });

    results.push(...chunkResults.filter(Boolean) as KeywordResult[]);

    this.logger.info('Keyword extraction completed', {
      totalChunks: chunks.length,
      successfulExtractions: results.filter(r => r.success).length,
      failedExtractions: results.filter(r => !r.success).length,
      totalKeywords: results.reduce((sum, r) => sum + r.keywords.length, 0),
    });

    return results;
  }

  /**
   * 単一チャンクのキーワードを処理
   */
  private async processChunkKeywords(
    chunk: ChunkResult,
    documentStats: any
  ): Promise<KeywordResult> {
    for (let attempt = 1; attempt <= KeywordExtractionService.MAX_RETRIES; attempt++) {
      try {
        // キーワード抽出
        const extractedKeywords = await this.keywordExtractor.extractKeywords(
          chunk.content,
          documentStats
        );

        if (extractedKeywords.length === 0) {
          this.logger.debug('No keywords extracted for chunk', { chunkId: chunk.chunkId });
          return {
            chunkId: chunk.chunkId,
            keywords: [],
            success: true,
          };
        }

        // キーワードの埋め込みを生成
        const keywordData = await this.generateKeywordEmbeddings(extractedKeywords);

        // データベースに保存
        if (keywordData.length > 0) {
          await this.vectorStore.addKeywords(chunk.chunkId, keywordData);
        }

        this.logger.debug('Keywords processed successfully', {
          chunkId: chunk.chunkId,
          keywordCount: keywordData.length,
        });

        return {
          chunkId: chunk.chunkId,
          keywords: keywordData,
          success: true,
        };

      } catch (error) {
        this.logger.warn(`Keyword extraction attempt ${attempt} failed`, {
          chunkId: chunk.chunkId,
          attempt,
          maxRetries: KeywordExtractionService.MAX_RETRIES,
        });

        if (attempt < KeywordExtractionService.MAX_RETRIES) {
          await this.delay(KeywordExtractionService.RETRY_DELAY_MS * attempt);
        }
      }
    }

    this.logger.error('Failed to extract keywords after all retries', undefined, {
      chunkId: chunk.chunkId,
      maxRetries: KeywordExtractionService.MAX_RETRIES,
    });

    return {
      chunkId: chunk.chunkId,
      keywords: [],
      success: false,
    };
  }

  /**
   * キーワードの埋め込みを生成
   */
  private async generateKeywordEmbeddings(
    extractedKeywords: Array<{
      keyword: string;
      bm25Score: number;
      termFrequency: number;
      documentFrequency: number;
    }>
  ): Promise<Array<{
    keyword: string;
    bm25Score: number;
    termFrequency: number;
    documentFrequency: number;
    embedding: number[];
  }>> {
    const results: Array<{
      keyword: string;
      bm25Score: number;
      termFrequency: number;
      documentFrequency: number;
      embedding: number[];
    }> = [];

    // キーワードの埋め込みを並列生成
    const keywords = extractedKeywords.map(k => k.keyword);
    
    try {
      const embeddings = await this.embeddings.embedBatch(keywords);
      
      for (let i = 0; i < extractedKeywords.length; i++) {
        const keyword = extractedKeywords[i];
        const embedding = embeddings[i];
        
        if (embedding && embedding.length > 0) {
          results.push({
            keyword: keyword.keyword,
            bm25Score: keyword.bm25Score,
            termFrequency: keyword.termFrequency,
            documentFrequency: keyword.documentFrequency,
            embedding,
          });
        }
      }

    } catch (error) {
      this.logger.warn('Batch keyword embedding failed, using individual processing', error instanceof Error ? error : undefined);
      
      // フォールバック: 個別処理
      for (const keyword of extractedKeywords) {
        const result = await safeAsync(async () => {
          const embedding = await this.embeddings.embed(keyword.keyword);
          return {
            keyword: keyword.keyword,
            bm25Score: keyword.bm25Score,
            termFrequency: keyword.termFrequency,
            documentFrequency: keyword.documentFrequency,
            embedding,
          };
        });

        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * ドキュメント統計を取得
   */
  private async getDocumentStats(): Promise<any> {
    try {
      return await this.vectorStore.getKeywordStats();
    } catch (error) {
      this.logger.warn('Failed to get document stats, using defaults', error instanceof Error ? error : undefined);
      
      // フォールバック: デフォルト統計
      return {
        totalDocuments: 1,
        averageDocumentLength: 100,
        termDocumentFrequency: new Map(),
      };
    }
  }

  /**
   * 指定時間待機
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * キーワード抽出の統計を取得
   */
  getKeywordStats(results: KeywordResult[]): {
    totalChunksProcessed: number;
    successfulExtractions: number;
    failedExtractions: number;
    totalKeywords: number;
    averageKeywordsPerChunk: number;
    topKeywords: Array<{ keyword: string; frequency: number }>;
    successRate: number;
  } {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalKeywords = results.reduce((sum, r) => sum + r.keywords.length, 0);
    
    // キーワードの頻度計算
    const keywordFrequency = new Map<string, number>();
    for (const result of results) {
      for (const keyword of result.keywords) {
        keywordFrequency.set(
          keyword.keyword,
          (keywordFrequency.get(keyword.keyword) || 0) + 1
        );
      }
    }

    // 上位キーワード
    const topKeywords = Array.from(keywordFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, frequency]) => ({ keyword, frequency }));

    return {
      totalChunksProcessed: results.length,
      successfulExtractions: successful.length,
      failedExtractions: failed.length,
      totalKeywords,
      averageKeywordsPerChunk: results.length > 0 ? totalKeywords / results.length : 0,
      topKeywords,
      successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0,
    };
  }
}