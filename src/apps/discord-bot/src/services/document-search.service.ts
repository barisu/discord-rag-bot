import { ilike, or, desc, sql } from 'drizzle-orm';
import { getDatabaseConnection, schema } from '@shared/core';
import type { DocumentSearchResult, DocumentSearchResponse } from '@shared/core';

/**
 * ドキュメント検索サービス
 * sourceDocumentsテーブルから部分一致検索を行う
 */
export class DocumentSearchService {
  private db = getDatabaseConnection();

  /**
   * キーワードによる部分一致検索を実行
   * @param query 検索クエリ
   * @returns 検索結果（上位5件）
   */
  async searchDocuments(query: string): Promise<DocumentSearchResponse> {
    const startTime = Date.now();
    
    // クエリを空白で分割して複数キーワードに対応
    const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);
    
    if (keywords.length === 0) {
      return {
        results: [],
        total: 0,
        query,
        processingTime: Date.now() - startTime,
      };
    }

    try {
      // 検索条件を構築
      const searchConditions = keywords.map(keyword => 
        or(
          ilike(schema.sourceDocuments.title, `%${keyword}%`),
          ilike(schema.sourceDocuments.fullContent, `%${keyword}%`)
        )
      );

      // 全ての検索条件にマッチするドキュメントを取得
      const results = await this.db
        .select({
          id: schema.sourceDocuments.id,
          title: schema.sourceDocuments.title,
          content: schema.sourceDocuments.fullContent,
          url: schema.sourceDocuments.url,
          metadata: schema.sourceDocuments.metadata,
          messageId: schema.sourceDocuments.messageId,
          channelId: schema.sourceDocuments.channelId,
          authorId: schema.sourceDocuments.authorId,
          createdAt: schema.sourceDocuments.createdAt,
          // タイトルマッチの優先順位を付けるためのカラムを追加
          titleMatchScore: sql<number>`
            CASE 
              WHEN ${schema.sourceDocuments.title} IS NOT NULL AND ${this.createTitleMatchCondition(keywords)} THEN 1
              ELSE 0
            END AS title_match_score
          `,
        })
        .from(schema.sourceDocuments)
        .where(
          // 全てのキーワードがタイトルまたはコンテンツにマッチする条件
          sql`${searchConditions.reduce((acc, condition) => 
            acc ? sql`${acc} AND (${condition})` : condition
          )}`
        )
        .orderBy(
          desc(sql`title_match_score`), // タイトルマッチを優先
          desc(schema.sourceDocuments.createdAt) // 新しい順
        )
        .limit(5);

      // 結果をDocumentSearchResultに変換
      const searchResults: DocumentSearchResult[] = results.map(row => ({
        id: row.id,
        title: row.title,
        content: this.truncateContent(row.content),
        url: row.url,
        metadata: row.metadata || {},
        messageId: row.messageId,
        channelId: row.channelId,
        authorId: row.authorId,
        createdAt: row.createdAt,
      }));

      return {
        results: searchResults,
        total: searchResults.length,
        query,
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      console.error('Document search error:', error);
      return {
        results: [],
        total: 0,
        query,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * データベース内のドキュメント総数を取得
   */
  async getDocumentCount(): Promise<number> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.sourceDocuments);
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting document count:', error);
      return 0;
    }
  }

  /**
   * タイトルマッチ条件を作成
   */
  private createTitleMatchCondition(keywords: string[]) {
    const conditions = keywords.map(keyword => 
      ilike(schema.sourceDocuments.title, `%${keyword}%`)
    );
    
    return conditions.reduce((acc, condition) => 
      acc ? sql`${acc} AND ${condition}` : condition
    );
  }

  /**
   * コンテンツを表示用に短縮
   */
  private truncateContent(content: string, maxLength: number = 300): string {
    if (content.length <= maxLength) {
      return content;
    }
    
    return content.substring(0, maxLength).trim() + '...';
  }
}