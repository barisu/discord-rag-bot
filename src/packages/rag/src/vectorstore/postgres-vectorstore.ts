import { eq, sql, desc, cosineDistance, and } from 'drizzle-orm';
import type { VectorStore } from './index';
import type { Source } from '@shared/core';
import { getDatabaseConnection, sourceDocuments, documentChunks, embeddings, keywords } from '@shared/core';

export class PostgresVectorStore implements VectorStore {
  private get db() {
    return getDatabaseConnection();
  }

  async addDocument(content: string, metadata: Record<string, any>, embedding: number[]): Promise<string> {
    // NOTE: This method is deprecated. Use the new flow:
    // 1. Insert to sourceDocuments
    // 2. Insert to documentChunks
    // 3. Insert embeddings with chunkId
    throw new Error('addDocument is deprecated. Use the new source_documents -> document_chunks flow.');
  }

  async search(queryEmbedding: number[], limit = 5, threshold = 0.7): Promise<Source[]> {
    const results = await this.db
      .select({
        chunkId: documentChunks.id,
        chunkContent: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        chunkMetadata: documentChunks.metadata,
        sourceDocId: sourceDocuments.id,
        sourceUrl: sourceDocuments.url,
        sourceTitle: sourceDocuments.title,
        sourceMetadata: sourceDocuments.metadata,
        messageId: sourceDocuments.messageId,
        channelId: sourceDocuments.channelId,
        authorId: sourceDocuments.authorId,
        similarity: sql<number>`1 - (${cosineDistance(embeddings.embedding, queryEmbedding)})`,
      })
      .from(documentChunks)
      .innerJoin(embeddings, eq(documentChunks.id, embeddings.chunkId))
      .innerJoin(sourceDocuments, eq(documentChunks.sourceDocumentId, sourceDocuments.id))
      .where(sql`1 - (${cosineDistance(embeddings.embedding, queryEmbedding)}) > ${threshold}`)
      .orderBy(desc(sql`1 - (${cosineDistance(embeddings.embedding, queryEmbedding)})`))
      .limit(limit);

    return results.map(row => ({
      id: row.chunkId.toString(),
      content: row.chunkContent,
      metadata: {
        // チャンク情報
        chunkIndex: row.chunkIndex,
        chunkMetadata: row.chunkMetadata,
        // 元ドキュメント情報
        sourceDocument: {
          id: row.sourceDocId,
          url: row.sourceUrl,
          title: row.sourceTitle,
          metadata: row.sourceMetadata,
        },
        // Discord情報
        messageId: row.messageId,
        channelId: row.channelId,
        authorId: row.authorId,
        // 検索情報
        searchMethod: 'rag',
      },
      similarity: row.similarity,
    }));
  }

  async deleteDocument(id: string): Promise<void> {
    // Delete chunk (cascade will handle embeddings and keywords)
    await this.db.delete(documentChunks).where(eq(documentChunks.id, parseInt(id)));
  }

  async similaritySearch(
    queryEmbedding: number[],
    limit = 5,
    threshold = 0.7
  ): Promise<Array<{ id: string; similarity: number }>> {
    const results = await this.db
      .select({
        id: documentChunks.id,
        similarity: sql<number>`1 - (${cosineDistance(embeddings.embedding, queryEmbedding)})`,
      })
      .from(documentChunks)
      .innerJoin(embeddings, eq(documentChunks.id, embeddings.chunkId))
      .where(sql`1 - (${cosineDistance(embeddings.embedding, queryEmbedding)}) > ${threshold}`)
      .orderBy(desc(sql`1 - (${cosineDistance(embeddings.embedding, queryEmbedding)})`))
      .limit(limit);

    return results.map(row => ({
      id: row.id.toString(),
      similarity: row.similarity,
    }));
  }

  async getDocumentCount(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(documentChunks);
    
    return result[0].count;
  }

  async getDocumentById(id: string): Promise<Source | null> {
    const result = await this.db
      .select({
        chunkId: documentChunks.id,
        chunkContent: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        chunkMetadata: documentChunks.metadata,
        sourceDocId: sourceDocuments.id,
        sourceUrl: sourceDocuments.url,
        sourceTitle: sourceDocuments.title,
        sourceMetadata: sourceDocuments.metadata,
        messageId: sourceDocuments.messageId,
        channelId: sourceDocuments.channelId,
        authorId: sourceDocuments.authorId,
      })
      .from(documentChunks)
      .innerJoin(sourceDocuments, eq(documentChunks.sourceDocumentId, sourceDocuments.id))
      .where(eq(documentChunks.id, parseInt(id)))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    return {
      id: row.chunkId.toString(),
      content: row.chunkContent,
      metadata: {
        chunkIndex: row.chunkIndex,
        chunkMetadata: row.chunkMetadata,
        sourceDocument: {
          id: row.sourceDocId,
          url: row.sourceUrl,
          title: row.sourceTitle,
          metadata: row.sourceMetadata,
        },
        messageId: row.messageId,
        channelId: row.channelId,
        authorId: row.authorId,
      },
      similarity: 1,
    };
  }

  /**
   * キーワードベクトル類似度検索
   */
  async searchByKeywords(
    queryEmbedding: number[],
    limit = 5,
    threshold = 0.7,
    bm25Threshold = 0.1
  ): Promise<Source[]> {
    const results = await this.db
      .select({
        chunkId: documentChunks.id,
        chunkContent: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        chunkMetadata: documentChunks.metadata,
        sourceDocId: sourceDocuments.id,
        sourceUrl: sourceDocuments.url,
        sourceTitle: sourceDocuments.title,
        sourceMetadata: sourceDocuments.metadata,
        messageId: sourceDocuments.messageId,
        channelId: sourceDocuments.channelId,
        authorId: sourceDocuments.authorId,
        // 複合スコア = ベクトル類似度 × BM25スコア
        combinedScore: sql<number>`
          (1 - (${cosineDistance(keywords.embedding, queryEmbedding)})) * 
          ${keywords.bm25Score}
        `,
        vectorSimilarity: sql<number>`1 - (${cosineDistance(keywords.embedding, queryEmbedding)})`,
        bm25Score: keywords.bm25Score,
        keyword: keywords.keyword,
      })
      .from(documentChunks)
      .innerJoin(keywords, eq(documentChunks.id, keywords.chunkId))
      .innerJoin(sourceDocuments, eq(documentChunks.sourceDocumentId, sourceDocuments.id))
      .where(
        and(
          sql`1 - (${cosineDistance(keywords.embedding, queryEmbedding)}) > ${threshold}`,
          sql`${keywords.bm25Score} > ${bm25Threshold}`
        )
      )
      .orderBy(desc(sql`
        (1 - (${cosineDistance(keywords.embedding, queryEmbedding)})) * 
        ${keywords.bm25Score}
      `))
      .limit(limit);

    return results.map(row => ({
      id: row.chunkId.toString(),
      content: row.chunkContent,
      metadata: {
        // チャンク情報
        chunkIndex: row.chunkIndex,
        chunkMetadata: row.chunkMetadata,
        // 元ドキュメント情報
        sourceDocument: {
          id: row.sourceDocId,
          url: row.sourceUrl,
          title: row.sourceTitle,
          metadata: row.sourceMetadata,
        },
        // Discord情報
        messageId: row.messageId,
        channelId: row.channelId,
        authorId: row.authorId,
        // 検索情報
        searchMethod: 'keyword',
        matchedKeyword: row.keyword,
        vectorSimilarity: row.vectorSimilarity,
        bm25Score: row.bm25Score,
        combinedScore: row.combinedScore,
      },
      similarity: row.combinedScore,
    }));
  }

  /**
   * キーワードを保存
   */
  async addKeyword(
    chunkId: number,
    keyword: string,
    bm25Score: number,
    termFrequency: number,
    documentFrequency: number,
    embedding: number[]
  ): Promise<void> {
    await this.db
      .insert(keywords)
      .values({
        chunkId,
        keyword,
        bm25Score: bm25Score.toString(),
        termFrequency,
        documentFrequency,
        embedding,
      });
  }

  /**
   * ドキュメントのキーワードを一括保存
   */
  async addKeywords(
    chunkId: number,
    keywordData: Array<{
      keyword: string;
      bm25Score: number;
      termFrequency: number;
      documentFrequency: number;
      embedding: number[];
    }>
  ): Promise<void> {
    if (keywordData.length === 0) return;

    const keywordValues = keywordData.map(kw => ({
      chunkId,
      keyword: kw.keyword,
      bm25Score: kw.bm25Score.toString(),
      termFrequency: kw.termFrequency,
      documentFrequency: kw.documentFrequency,
      embedding: kw.embedding,
    }));

    await this.db.insert(keywords).values(keywordValues);
  }

  /**
   * キーワード統計を取得（BM25計算用）
   */
  async getKeywordStats(): Promise<{
    totalDocuments: number;
    averageDocumentLength: number;
    termDocumentFrequency: Map<string, number>;
  }> {
    // 総チャンク数（≈ドキュメント数）
    const totalDocsResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(documentChunks);
    
    const totalDocuments = totalDocsResult[0].count;

    // 平均チャンク長（単語数ベース、概算）
    const avgLengthResult = await this.db
      .select({ 
        avgLength: sql<number>`avg(length(content) / 5)` // 概算：5文字/単語
      })
      .from(documentChunks);
    
    const averageDocumentLength = avgLengthResult[0].avgLength || 100;

    // 用語別チャンク頻度
    const termFreqResult = await this.db
      .select({
        keyword: keywords.keyword,
        docCount: sql<number>`count(distinct ${keywords.chunkId})`,
      })
      .from(keywords)
      .groupBy(keywords.keyword);

    const termDocumentFrequency = new Map<string, number>();
    for (const row of termFreqResult) {
      termDocumentFrequency.set(row.keyword, row.docCount);
    }

    return {
      totalDocuments,
      averageDocumentLength,
      termDocumentFrequency,
    };
  }

  /**
   * 文書のキーワード数を取得
   */
  async getKeywordCount(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(keywords);
    
    return result[0].count;
  }

  /**
   * 重複検索（通常のRAG + キーワード検索）
   */
  async hybridSearch(
    queryEmbedding: number[],
    limit = 5,
    threshold = 0.7,
    keywordWeight = 0.7
  ): Promise<Source[]> {
    // 通常のRAG検索
    const ragResults = await this.search(queryEmbedding, limit, threshold);
    
    // キーワード検索
    const keywordResults = await this.searchByKeywords(
      queryEmbedding, 
      limit, 
      threshold * 0.8 // キーワード検索は少し緩める
    );

    // 結果をマージして重複除去
    const allResults = new Map<string, Source>();
    
    // RAG結果を追加
    for (const result of ragResults) {
      allResults.set(result.id, {
        ...result,
        metadata: {
          ...result.metadata,
          searchMethod: 'rag',
        },
        similarity: result.similarity * (1 - keywordWeight),
      });
    }
    
    // キーワード結果を追加/更新
    for (const result of keywordResults) {
      const existing = allResults.get(result.id);
      if (existing) {
        // 既存の結果がある場合、スコアを組み合わせ
        allResults.set(result.id, {
          ...existing,
          metadata: {
            ...existing.metadata,
            searchMethod: 'hybrid',
            keywordData: result.metadata,
          },
          similarity: existing.similarity + (result.similarity * keywordWeight),
        });
      } else {
        // 新しい結果を追加
        allResults.set(result.id, {
          ...result,
          similarity: result.similarity * keywordWeight,
        });
      }
    }

    // スコア順でソートして返却
    return Array.from(allResults.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}