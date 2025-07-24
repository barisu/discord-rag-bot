import type { Source } from '@shared/core';

export interface VectorStore {
  addDocument(content: string, metadata: Record<string, any>, embedding?: number[]): Promise<string>;
  search(embedding: number[], limit?: number): Promise<Source[]>;
  deleteDocument(id: string): Promise<void>;
}

export * from './postgres-vectorstore';