import type { TextChunk } from '@shared/core';

interface ChunkingResponse {
  chunks: Array<{
    content: string;
    index: number;
  }>;
}

export function parseChunkingResponse(response: string): TextChunk[] {
  try {
    // JSONブロックを抽出（```json で囲まれている場合を考慮）
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                     response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonText) as ChunkingResponse;

    if (!parsed.chunks || !Array.isArray(parsed.chunks)) {
      throw new Error('Invalid response format: chunks array not found');
    }

    // インデックスの正規化とバリデーション
    return parsed.chunks
      .filter(chunk => chunk.content && chunk.content.trim().length > 0)
      .map((chunk, index) => ({
        content: chunk.content.trim(),
        index,
      }));
  } catch (error) {
    throw new Error(`Failed to parse chunking response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}