import type { TextChunk } from '@shared/core';

interface ChunkingResponse {
  chunks: Array<{
    content: string;
    index: number;
  }>;
}

export function parseChunkingResponse(response: string): TextChunk[] {
  try {
    // 段階的にJSONを抽出・パース
    const parsedData = tryParseJSON(response);
    
    if (!parsedData || !parsedData.chunks || !Array.isArray(parsedData.chunks)) {
      throw new Error('Invalid response format: chunks array not found');
    }

    // インデックスの正規化とバリデーション
    return parsedData.chunks
      .filter(chunk => chunk && chunk.content && chunk.content.trim().length > 0)
      .map((chunk, index) => ({
        content: chunk.content.trim(),
        index,
      }));
  } catch (error) {
    throw new Error(`Failed to parse chunking response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 複数の方法でJSONパースを試行
 */
function tryParseJSON(response: string): ChunkingResponse | null {
  const strategies = [
    // 戦略1: ```json ブロック抽出
    () => {
      const match = response.match(/```json\s*([\s\S]*?)\s*```/);
      return match ? JSON.parse(match[1]) : null;
    },
    
    // 戦略2: {} ブロック抽出
    () => {
      const match = response.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    },
    
    // 戦略3: レスポンス全体をJSONとしてパース
    () => {
      return JSON.parse(response.trim());
    },
    
    // 戦略4: 不正なJSON修復を試行
    () => {
      const cleaned = cleanupJSON(response);
      return cleaned ? JSON.parse(cleaned) : null;
    }
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy();
      if (result && result.chunks && Array.isArray(result.chunks)) {
        return result;
      }
    } catch (error) {
      // 次の戦略を試行
      continue;
    }
  }

  return null;
}

/**
 * 一般的なJSON構文エラーを修復
 */
function cleanupJSON(text: string): string | null {
  try {
    // JSONブロックを抽出
    let jsonStr = text;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                     text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      jsonStr = jsonMatch[1] || jsonMatch[0];
    }

    // 一般的な修復
    jsonStr = jsonStr
      .replace(/,\s*}/g, '}')     // 末尾のコンマ除去
      .replace(/,\s*]/g, ']')     // 配列末尾のコンマ除去
      .replace(/'/g, '"')         // シングルクォートをダブルクォートに
      .replace(/(\w+):/g, '"$1":') // プロパティ名をクォート
      .replace(/:\s*(\w+)([,}])/g, ': "$1"$2') // 値をクォート（数値以外）
      .replace(/:\s*"(\d+)"([,}])/g, ': $1$2') // 数値のクォート除去
      .replace(/:\s*"(true|false|null)"([,}])/g, ': $1$2'); // boolean/null のクォート除去

    return jsonStr;
  } catch (error) {
    return null;
  }
}