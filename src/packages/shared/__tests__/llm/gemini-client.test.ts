import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiClient } from '../../src/llm/gemini-client';

// GoogleGenAI のモック
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

describe('GeminiClient', () => {
  let client: GeminiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GeminiClient('test-api-key');
  });

  describe('generateText', () => {
    it('should generate text successfully', async () => {
      const mockResponse = {
        text: 'Generated text response',
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await client.generateText('Test prompt');

      expect(result).toBe('Generated text response');
      expect(mockGenerateContent).toHaveBeenCalledWith({
        contents: [{ role: 'user', parts: [{ text: 'Test prompt' }] }],
        model: 'gemini-2.5-flash',
      });
    });

    it('should use custom options', async () => {
      const mockResponse = {
        text: 'Generated text',
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await client.generateText('Test prompt', {
        temperature: 0.5,
        maxTokens: 1000,
        model: 'custom-model',
      });

      expect(mockGenerateContent).toHaveBeenCalledWith({
        contents: [{ role: 'user', parts: [{ text: 'Test prompt' }] }],
        model: 'gemini-2.5-flash',
      });
    });
  });

  describe('error handling', () => {
    it('should handle API key errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API key invalid'));

      await expect(client.generateText('test')).rejects.toThrow('Invalid API key');
    });

    it('should handle quota errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('quota exceeded'));

      await expect(client.generateText('test')).rejects.toThrow('API quota exceeded');
    });

    it('should handle timeout errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Request timeout'));

      await expect(client.generateText('test')).rejects.toThrow('Request timeout');
    });

    it('should handle unknown errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Unknown error'));

      await expect(client.generateText('test')).rejects.toThrow('Unknown error');
    });
  });
});
