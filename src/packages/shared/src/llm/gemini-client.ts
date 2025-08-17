import { GoogleGenAI } from '@google/genai';
import type { LLMClient, LLMOptions } from './llm-client';
import { LLMError } from './llm-client';

export class GeminiClient implements LLMClient {
  private client: GoogleGenAI;
  private defaultModel = 'gemini-2.5-flash';

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateText(prompt: string, options?: LLMOptions): Promise<string> {
    try {
      const result = await this.client.models.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        model: this.defaultModel
      });

      if (result.text == undefined)
          throw new Error("reponse not found");
      return result.text;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (error.message?.includes('API key')) {
      return new LLMError('Invalid API key', 'INVALID_API_KEY', 401);
    }
    if (error.message?.includes('quota')) {
      return new LLMError('API quota exceeded', 'QUOTA_EXCEEDED', 429);
    }
    if (error.message?.includes('timeout')) {
      return new LLMError('Request timeout', 'TIMEOUT', 408);
    }
    
    return new LLMError(
      error.message || 'Unknown LLM error',
      'UNKNOWN_ERROR',
      error.status || 500
    );
  }
}