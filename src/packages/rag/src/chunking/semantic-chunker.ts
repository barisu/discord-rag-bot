import type { LLMClient, TextChunk, ChunkingOptions } from '@shared/core';
import { parseChunkingResponse } from './response-parser';

export class SemanticChunker {
  constructor(private llmClient: LLMClient) {}

  async chunk(text: string, options?: ChunkingOptions): Promise<TextChunk[]> {
    const prompt = this.buildChunkingPrompt(text, options);
    
    try {
      const response = await this.llmClient.generateText(prompt, {
        temperature: 0.1, // 一貫性のため低い温度設定
        maxTokens: 4000,
      });

      return parseChunkingResponse(response);
    } catch (error) {
      // フォールバック: シンプルな段落分割
      console.warn('LLM chunking failed, falling back to simple paragraph splitting:', error);
      return this.fallbackChunk(text);
    }
  }

  private buildChunkingPrompt(text: string, options?: ChunkingOptions): string {
    const language = options?.language || '日本語';
    const maxChunkSize = options?.maxChunkSize || 1000;

    return `以下のテキストを意味的に自然な境界で分割してください。

要件:
- 各チャンクは文脈的に完結している
- トピックや主題の変化点で分割する
- 検索での関連性を最大化するように分割する
- ${language}の文章構造を考慮する
- 各チャンクは概ね${maxChunkSize}文字以下にする
- 空のチャンクは作成しない

以下のJSON形式で返してください：
{
  "chunks": [
    {"content": "チャンク1の内容", "index": 0},
    {"content": "チャンク2の内容", "index": 1}
  ]
}

テキスト:
${text}`;
  }

  private fallbackChunk(text: string): TextChunk[] {
    // シンプルな段落分割をフォールバックとして使用
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (paragraphs.length === 0) {
      return [{ content: text.trim(), index: 0 }];
    }

    return paragraphs.map((content, index) => ({
      content,
      index,
    }));
  }
}