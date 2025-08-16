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

export interface DocumentSearchResult {
  id: number;
  title: string | null;
  content: string;
  url: string;
  metadata: Record<string, any> | null;
  messageId: string | null;
  channelId: string | null;
  authorId: string | null;
  createdAt: Date;
}

export interface DocumentSearchResponse {
  results: DocumentSearchResult[];
  total: number;
  query: string;
  processingTime: number;
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