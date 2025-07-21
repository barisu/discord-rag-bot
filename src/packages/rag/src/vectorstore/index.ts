import type { Source } from '@shared/core';

export interface VectorStore {
  addDocument(content: string, metadata: Record<string, any>, embedding?: number[]): Promise<string>;
  search(embedding: number[], limit?: number): Promise<Source[]>;
  deleteDocument(id: string): Promise<void>;
}

export class InMemoryVectorStore implements VectorStore {
  private documents: Map<string, { content: string; embedding: number[]; metadata: Record<string, any> }> = new Map();

  async addDocument(content: string, metadata: Record<string, any>, embedding: number[] = []): Promise<string> {
    const id = Math.random().toString(36).substr(2, 9);
    
    this.documents.set(id, {
      content,
      embedding,
      metadata,
    });

    return id;
  }

  async search(queryEmbedding: number[], limit = 5): Promise<Source[]> {
    const results: Source[] = [];

    for (const [id, doc] of this.documents) {
      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
      
      results.push({
        id,
        content: doc.content,
        metadata: doc.metadata,
        similarity,
      });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export * from './postgres-vectorstore';