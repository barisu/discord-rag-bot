import type { RagQuery, RagResponse, Source } from '@shared/core';
import type { EmbeddingProvider } from '../embeddings';
import type { VectorStore } from '../vectorstore';

export class RagRetriever {
  constructor(
    private embeddingProvider: EmbeddingProvider,
    private vectorStore: VectorStore
  ) {}

  async query(request: RagQuery): Promise<RagResponse> {
    const startTime = Date.now();

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingProvider.embed(request.query);

      // Search for relevant documents
      const sources = await this.vectorStore.search(
        queryEmbedding,
        request.contextLimit || 5
      );

      // Generate answer using retrieved context
      const answer = await this.generateAnswer(request.query, sources);

      const processingTime = Date.now() - startTime;

      return {
        answer,
        sources,
        confidence: this.calculateConfidence(sources),
        processingTime,
      };
    } catch (error) {
      console.error('RAG query failed:', error);
      
      return {
        answer: 'Sorry, I encountered an error while processing your query.',
        sources: [],
        confidence: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  private async generateAnswer(query: string, sources: Source[]): Promise<string> {
    if (sources.length === 0) {
      return "関連する情報が見つかりませんでした。別のキーワードで検索してみてください。";
    }

    // 関連度の高い上位3つのソースから回答を生成
    const topSources = sources.slice(0, 3);
    const context = topSources.map((source, index) => {
      const metadata = source.metadata;
      const title = metadata?.title || 'タイトル不明';
      const domain = metadata?.domain || '不明なソース';
      
      return `**ソース${index + 1}** (${domain})\n` +
             `タイトル: ${title}\n` +
             `内容: ${source.content.length > 300 ? source.content.substring(0, 300) + '...' : source.content}`;
    }).join('\n\n');

    return `検索結果に基づいて関連する情報をお示しします：\n\n${context}`;
  }

  private calculateConfidence(sources: Source[]): number {
    if (sources.length === 0) return 0;
    
    const avgSimilarity = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;
    return Math.min(avgSimilarity * 100, 100);
  }
}