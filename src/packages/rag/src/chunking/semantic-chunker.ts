import type { LLMClient, TextChunk, ChunkingOptions } from '@shared/core';
import { parseChunkingResponse } from './response-parser';

export class SemanticChunker {
  constructor(private llmClient: LLMClient) {}

  async chunk(text: string, options?: ChunkingOptions): Promise<TextChunk[]> {
    const prompt = this.buildChunkingPrompt(text, options);
    
    // 複数回リトライしてからフォールバック
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[SemanticChunker] Attempt ${attempt}/2 for text length: ${text.length}`);
        
        const response = await this.llmClient.generateText(prompt, {
          temperature: 0.1, // 一貫性のため低い温度設定
          maxTokens: 4000,
        });

        console.log(`[SemanticChunker] Raw response length: ${response.length}`);
        console.log(`[SemanticChunker] Response preview: ${response.substring(0, 200)}...`);

        const chunks = parseChunkingResponse(response);
        console.log(`[SemanticChunker] Successfully parsed ${chunks.length} chunks`);
        
        return chunks;
        
      } catch (error) {
        console.warn(`[SemanticChunker] Attempt ${attempt} failed:`, error);
        
        if (attempt === 2) {
          // 最後の試行でも失敗した場合、詳細なログを出力
          console.error('[SemanticChunker] All attempts failed, using fallback chunking');
          console.error('[SemanticChunker] Original text length:', text.length);
          console.error('[SemanticChunker] Prompt used:', prompt.substring(0, 500) + '...');
          
          return this.fallbackChunk(text);
        }
        
        // 次の試行前に少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // この行には到達しないはずだが、TypeScriptの完全性チェックのため
    return this.fallbackChunk(text);
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

IMPORTANT: 以下の正確なJSON形式でのみ返してください。他の説明やテキストは一切含めないでください：

\`\`\`json
{
  "chunks": [
    {"content": "チャンク1の内容", "index": 0},
    {"content": "チャンク2の内容", "index": 1}
  ]
}
\`\`\`

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