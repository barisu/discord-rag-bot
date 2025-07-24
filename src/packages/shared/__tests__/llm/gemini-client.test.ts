import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiClient } from '../../src/llm/gemini-client';

// GoogleGenerativeAI のモック
vi.mock('@google/genai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn(),
    })),
  })),
}));

describe('GeminiClient', () => {
  let client: GeminiClient;
  let mockModel: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockModel = {
      generateContent: vi.fn(),
    };

    const mockGoogleAI = {
      getGenerativeModel: vi.fn(() => mockModel),
    };

    vi.mocked(require('@google/genai').GoogleGenerativeAI).mockImplementation(() => mockGoogleAI);
    
    client = new GeminiClient('test-api-key');
  });

  describe('generateText', () => {
    it('should generate text successfully', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated text response',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await client.generateText('Test prompt');

      expect(result).toBe('Generated text response');
      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: [{ role: 'user', parts: [{ text: 'Test prompt' }] }],
        generationConfig: {
          temperature: undefined,
          maxOutputTokens: undefined,
        },
      });
    });

    it('should use custom options', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated text',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await client.generateText('Test prompt', {
        temperature: 0.5,
        maxTokens: 1000,
        model: 'custom-model',
      });

      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: [{ role: 'user', parts: [{ text: 'Test prompt' }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 1000,
        },
      });
    });
  });

  describe('generateJSON', () => {
    it('should generate and parse JSON successfully', async () => {
      const mockResponse = {
        response: {
          text: () => '{"result": "success", "data": [1, 2, 3]}',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await client.generateJSON('Test prompt');

      expect(result).toEqual({ result: 'success', data: [1, 2, 3] });
      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: [{ role: 'user', parts: [{ text: 'Test prompt' }] }],
        generationConfig: {
          temperature: undefined,
          maxOutputTokens: undefined,
          responseMimeType: 'application/json',
        },
      });
    });

    it('should throw LLMError for invalid JSON', async () => {
      const mockResponse = {
        response: {
          text: () => 'Invalid JSON response',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await expect(client.generateJSON('Test prompt')).rejects.toThrow('Failed to parse JSON response from LLM');
    });
  });

  describe('error handling', () => {
    it('should handle API key errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API key invalid'));

      await expect(client.generateText('test')).rejects.toThrow('Invalid API key');
    });

    it('should handle quota errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('quota exceeded'));

      await expect(client.generateText('test')).rejects.toThrow('API quota exceeded');
    });

    it('should handle timeout errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Request timeout'));

      await expect(client.generateText('test')).rejects.toThrow('Request timeout');
    });

    it('should handle unknown errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Unknown error'));

      await expect(client.generateText('test')).rejects.toThrow('Unknown error');
    });
  });
});