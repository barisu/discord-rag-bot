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
    it('should chunk text using LLM', async () => {
      const mockResponseText = JSON.stringify({
        chunks: [
          { content: 'First chunk content', index: 0 },
          { content: 'Second chunk content', index: 1 },
        ],
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const text = 'This is a long text that should be chunked into multiple parts.';
      const result = await chunker.chunk(text);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ content: 'First chunk content', index: 0 });
      expect(result[1]).toEqual({ content: 'Second chunk content', index: 1 });
      expect(mockLLMClient.generateText).toHaveBeenCalledWith(
        expect.stringContaining('以下のテキストを意味的に自然な境界で分割してください'),
        expect.objectContaining({
          temperature: 0.1,
          maxTokens: 4000,
        })
      );
    });

    it('should filter empty chunks', async () => {
      const mockResponseText = JSON.stringify({
        chunks: [
          { content: 'Valid chunk', index: 0 },
          { content: '', index: 1 },
          { content: '   ', index: 2 },
          { content: 'Another valid chunk', index: 3 },
        ],
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const result = await chunker.chunk('Test text');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ content: 'Valid chunk', index: 0 });
      expect(result[1]).toEqual({ content: 'Another valid chunk', index: 1 });
    });

    it('should fall back to paragraph splitting when LLM fails', async () => {
      vi.mocked(mockLLMClient.generateText).mockRejectedValue(new Error('API Error'));

      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const result = await chunker.chunk(text);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ content: 'First paragraph.', index: 0 });
      expect(result[1]).toEqual({ content: 'Second paragraph.', index: 1 });
      expect(result[2]).toEqual({ content: 'Third paragraph.', index: 2 });
    });

    it('should handle text without paragraphs in fallback', async () => {
      vi.mocked(mockLLMClient.generateText).mockRejectedValue(new Error('API Error'));

      const text = 'Single line text without paragraphs';
      const result = await chunker.chunk(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ content: 'Single line text without paragraphs', index: 0 });
    });

    it('should use custom options', async () => {
      const mockResponseText = JSON.stringify({
        chunks: [{ content: 'Chunk', index: 0 }],
      });

      vi.mocked(mockLLMClient.generateText).mockResolvedValue(mockResponseText);

      const options = {
        maxChunkSize: 500,
        language: '英語',
      };

      await chunker.chunk('Test text', options);

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