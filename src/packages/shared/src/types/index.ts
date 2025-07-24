export interface RagQuery {
  query: string;
  userId?: string;
  guildId?: string;
  contextLimit?: number;
}

export interface RagResponse {
  answer: string;
  sources: Source[];
  confidence: number;
  processingTime: number;
}

export interface Source {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

export interface DiscordMessage {
  id: string;
  content: string;
  authorId: string;
  guildId?: string;
  channelId: string;
  timestamp: Date;
}

export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  ssl?: boolean;
}

export interface ApiConfig {
  port: number;
  corsOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
}

export interface TextChunk {
  content: string;
  index: number;
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  language?: string;
}