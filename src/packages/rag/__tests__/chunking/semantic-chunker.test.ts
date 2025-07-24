import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SemanticChunker } from '../../src/chunking/semantic-chunker';
import type { LLMClient } from '@shared/core';

describe('SemanticChunker', () => {
  let mockLLMClient: LLMClient;
  let chunker: SemanticChunker;

  beforeEach(() => {
    mockLLMClient = {
      generateText: vi.fn(),
    };
    chunker = new SemanticChunker(mockLLMClient);
  });

  describe('chunk', () => {
    it('LLMを使用してテキストをチャンク化する', async () => {
      const mockResponseText = JSON.stringify({
        chunks: [
          { content: '第1チャンクの内容', index: 0 },
          { content: '第2チャンクの内容', index: 1 },
        ],
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const text = 'これは複数の部分にチャンク化されるべき長いテキストです。';
      const result = await chunker.chunk(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ content: '第1チャンクの内容', index: 0 });
      expect(result[1]).toEqual({ content: '第2チャンクの内容', index: 1 });
      expect(mockLLMClient.generateText).toHaveBeenCalledWith(
        expect.stringContaining('以下のテキストを意味的に自然な境界で分割してください'),
        expect.objectContaining({
          temperature: 0.1,
          maxTokens: 4000,
        })
      );
    });

    it('空のチャンクをフィルタリングする', async () => {
      const mockResponseText = JSON.stringify({
        chunks: [
          { content: '有効なチャンク', index: 0 },
          { content: '', index: 1 },
          { content: '   ', index: 2 },
          { content: 'もう一つの有効なチャンク', index: 3 },
        ],
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const result = await chunker.chunk('テストテキスト');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ content: '有効なチャンク', index: 0 });
      expect(result[1]).toEqual({ content: 'もう一つの有効なチャンク', index: 1 });
    });

    it('LLMが失敗した時に段落分割にフォールバックする', async () => {
      vi.mocked(mockLLMClient.generateText).mockRejectedValue(new Error('APIエラー'));

      const text = '第1段落。\n\n第2段落。\n\n第3段落。';
      const result = await chunker.chunk(text);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ content: '第1段落。', index: 0 });
      expect(result[1]).toEqual({ content: '第2段落。', index: 1 });
      expect(result[2]).toEqual({ content: '第3段落。', index: 2 });
    });

    it('フォールバック時に段落がないテキストを処理する', async () => {
      vi.mocked(mockLLMClient.generateText).mockRejectedValue(new Error('APIエラー'));

      const text = '段落のない単一行テキスト';
      const result = await chunker.chunk(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ content: '段落のない単一行テキスト', index: 0 });
    });

    it('カスタムオプションを使用する', async () => {
      const mockResponseText = JSON.stringify({
        chunks: [{ content: 'チャンク', index: 0 }],
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const options = {
        maxChunkSize: 500,
        language: '英語',
      };

      await chunker.chunk('テストテキスト', options);

      expect(mockLLMClient.generateText).toHaveBeenCalledWith(
        expect.stringContaining('英語の文章構造を考慮する'),
        expect.any(Object)
      );
      expect(mockLLMClient.generateText).toHaveBeenCalledWith(
        expect.stringContaining('概ね500文字以下にする'),
        expect.any(Object)
      );
    });
  });
});