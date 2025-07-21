import { eq, sql, desc } from 'drizzle-orm';
import type { VectorStore } from './index';
import type { Source } from '@shared/core';
import { getDatabaseConnection, documents, embeddings } from '@shared/database';

export class PostgresVectorStore implements VectorStore {
  private db = getDatabaseConnection();

  async addDocument(content: string, metadata: Record<string, any>, embedding: number[]): Promise<string> {
    const result = await this.db.transaction(async (tx) => {
      // Insert document
      const [document] = await tx
        .insert(documents)
        .values({
          content,
          metadata,
          source: metadata.source || 'unknown',
        })
        .returning({ id: documents.id });

      // Insert embedding
      await tx
        .insert(embeddings)
        .values({
          documentId: document.id,
          embedding,
        });

      return document.id.toString();
    });

    return result;
  }

  async search(queryEmbedding: number[], limit = 5, threshold = 0.7): Promise<Source[]> {
    const results = await this.db
      .select({
        id: documents.id,
        content: documents.content,
        metadata: documents.metadata,
        similarity: sql<number>`1 - (${embeddings.embedding} <=> ${queryEmbedding}::vector)`,
      })
      .from(documents)
      .innerJoin(embeddings, eq(documents.id, embeddings.documentId))
      .where(sql`1 - (${embeddings.embedding} <=> ${queryEmbedding}::vector) > ${threshold}`)
      .orderBy(desc(sql`1 - (${embeddings.embedding} <=> ${queryEmbedding}::vector)`))
      .limit(limit);

    return results.map(row => ({
      id: row.id.toString(),
      content: row.content,
      metadata: row.metadata as Record<string, any>,
      similarity: row.similarity,
    }));
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.delete(documents).where(eq(documents.id, parseInt(id)));
  }

  async similaritySearch(
    queryEmbedding: number[],
    limit = 5,
    threshold = 0.7
  ): Promise<Array<{ id: string; similarity: number }>> {
    const results = await this.db
      .select({
        id: documents.id,
        similarity: sql<number>`1 - (${embeddings.embedding} <=> ${queryEmbedding}::vector)`,
      })
      .from(documents)
      .innerJoin(embeddings, eq(documents.id, embeddings.documentId))
      .where(sql`1 - (${embeddings.embedding} <=> ${queryEmbedding}::vector) > ${threshold}`)
      .orderBy(desc(sql`1 - (${embeddings.embedding} <=> ${queryEmbedding}::vector)`))
      .limit(limit);

    return results.map(row => ({
      id: row.id.toString(),
      similarity: row.similarity,
    }));
  }

  async getDocumentCount(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(documents);
    
    return result[0].count;
  }

  async getDocumentById(id: string): Promise<Source | null> {
    const result = await this.db
      .select({
        id: documents.id,
        content: documents.content,
        metadata: documents.metadata,
      })
      .from(documents)
      .where(eq(documents.id, parseInt(id)))
      .limit(1);

    if (result.length === 0) return null;

    return {
      id: result[0].id.toString(),
      content: result[0].content,
      metadata: result[0].metadata as Record<string, any>,
      similarity: 1,
    };
  }
}