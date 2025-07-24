import { describe, it, expect } from 'vitest';
import { parseChunkingResponse } from '../../src/chunking/response-parser';

describe('parseChunkingResponse', () => {
  it('should parse valid JSON response', () => {
    const response = JSON.stringify({
      chunks: [
        { content: 'First chunk', index: 0 },
        { content: 'Second chunk', index: 1 },
      ],
    });

    const result = parseChunkingResponse(response);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ content: 'First chunk', index: 0 });
    expect(result[1]).toEqual({ content: 'Second chunk', index: 1 });
  });

  it('should parse JSON wrapped in code blocks', () => {
    const response = `
Some text before

\`\`\`json
{
  "chunks": [
    { "content": "Wrapped chunk", "index": 0 }
  ]
}
\`\`\`

Some text after
    `;

    const result = parseChunkingResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ content: 'Wrapped chunk', index: 0 });
  });

  it('should filter empty chunks', () => {
    const response = JSON.stringify({
      chunks: [
        { content: 'Valid chunk', index: 0 },
        { content: '', index: 1 },
        { content: '   ', index: 2 },
        { content: 'Another valid chunk', index: 3 },
      ],
    });

    const result = parseChunkingResponse(response);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ content: 'Valid chunk', index: 0 });
    expect(result[1]).toEqual({ content: 'Another valid chunk', index: 1 });
  });

  it('should normalize indices', () => {
    const response = JSON.stringify({
      chunks: [
        { content: 'First', index: 5 },
        { content: 'Second', index: 10 },
        { content: 'Third', index: 15 },
      ],
    });

    const result = parseChunkingResponse(response);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ content: 'First', index: 0 });
    expect(result[1]).toEqual({ content: 'Second', index: 1 });
    expect(result[2]).toEqual({ content: 'Third', index: 2 });
  });

  it('should throw error for invalid JSON', () => {
    const response = 'This is not valid JSON';

    expect(() => parseChunkingResponse(response)).toThrow('Failed to parse chunking response');
  });

  it('should throw error for missing chunks array', () => {
    const response = JSON.stringify({
      data: [{ content: 'Wrong format', index: 0 }],
    });

    expect(() => parseChunkingResponse(response)).toThrow('Invalid response format: chunks array not found');
  });

  it('should handle JSON object without code blocks', () => {
    const response = `
Some text before
{
  "chunks": [
    { "content": "Direct JSON", "index": 0 }
  ]
}
Some text after
    `;

    const result = parseChunkingResponse(response);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ content: 'Direct JSON', index: 0 });
  });
});