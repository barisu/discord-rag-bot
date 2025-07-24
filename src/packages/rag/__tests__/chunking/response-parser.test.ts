import { describe, it, expect } from 'vitest';
import { parseChunkingResponse } from '../../src/chunking/response-parser';

describe('parseChunkingResponse', () => {
  it('有効なJSONレスポンスをパースする', () => {
    const response = JSON.stringify({
      chunks: [
        { content: '第1チャンク', index: 0 },
        { content: '第2チャンク', index: 1 },
      ],
    });

    const result = parseChunkingResponse(response);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ content: '第1チャンク', index: 0 });
    expect(result[1]).toEqual({ content: '第2チャンク', index: 1 });
  });

  it('コードブロックで囲まれたJSONをパースする', () => {
    const response = `
前のテキスト

\`\`\`json
{
  "chunks": [
    { "content": "ラップされたチャンク", "index": 0 }
  ]
}
\`\`\`

後のテキスト
    `;

    const result = parseChunkingResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ content: 'ラップされたチャンク', index: 0 });
  });

  it('空のチャンクをフィルタリングする', () => {
    const response = JSON.stringify({
      chunks: [
        { content: '有効なチャンク', index: 0 },
        { content: '', index: 1 },
        { content: '   ', index: 2 },
        { content: 'もう一つの有効なチャンク', index: 3 },
      ],
    });

    const result = parseChunkingResponse(response);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ content: '有効なチャンク', index: 0 });
    expect(result[1]).toEqual({ content: 'もう一つの有効なチャンク', index: 1 });
  });

  it('インデックスを正規化する', () => {
    const response = JSON.stringify({
      chunks: [
        { content: '第1', index: 5 },
        { content: '第2', index: 10 },
        { content: '第3', index: 15 },
      ],
    });

    const result = parseChunkingResponse(response);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ content: '第1', index: 0 });
    expect(result[1]).toEqual({ content: '第2', index: 1 });
    expect(result[2]).toEqual({ content: '第3', index: 2 });
  });

  it('無効なJSONに対してエラーをスローする', () => {
    const response = 'これは有効なJSONではありません';

    expect(() => parseChunkingResponse(response)).toThrow('Failed to parse chunking response');
  });

  it('chunks配列がない場合にエラーをスローする', () => {
    const response = JSON.stringify({
      data: [{ content: '間違ったフォーマット', index: 0 }],
    });

    expect(() => parseChunkingResponse(response)).toThrow('Invalid response format: chunks array not found');
  });

  it('コードブロックなしのJSONオブジェクトを処理する', () => {
    const response = `
前のテキスト
{
  "chunks": [
    { "content": "直接JSON", "index": 0 }
  ]
}
後のテキスト
    `;

    const result = parseChunkingResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ content: '直接JSON', index: 0 });
  });
});