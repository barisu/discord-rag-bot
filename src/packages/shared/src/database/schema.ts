import { pgTable, serial, text, timestamp, jsonb, index, varchar, numeric, integer, customType, vector } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';

// Documents table for RAG
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').default({}),
  source: varchar('source', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index('source_idx').on(table.source),
  createdAtIdx: index('created_at_idx').on(table.createdAt),
}));

// Vector embeddings table
export const embeddings = pgTable('embeddings', {
  id: serial('id').primaryKey(),
  documentId: serial('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  embedding: vector('embedding',{dimensions: 1534}), // OpenAI embedding dimension
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index('document_id_idx').on(table.documentId),
  // HNSW index for vector similarity search
  embeddingIdx: sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS embedding_hnsw_idx ON ${table} USING hnsw (embedding vector_cosine_ops)`,
}));

// Discord messages table (for context storage)
export const discordMessages = pgTable('discord_messages', {
  id: serial('id').primaryKey(),
  messageId: varchar('message_id', { length: 20 }).unique().notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  guildId: varchar('guild_id', { length: 20 }),
  authorId: varchar('author_id', { length: 20 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  messageIdIdx: index('message_id_idx').on(table.messageId),
  channelIdIdx: index('channel_id_idx').on(table.channelId),
  guildIdIdx: index('guild_id_idx').on(table.guildId),
  authorIdIdx: index('author_id_idx').on(table.authorId),
}));

// RAG queries log table
export const ragQueries = pgTable('rag_queries', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  guildId: varchar('guild_id', { length: 20 }),
  query: text('query').notNull(),
  response: text('response').notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }),
  processingTime: integer('processing_time'), // milliseconds
  sourcesUsed: jsonb('sources_used').default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_id_idx').on(table.userId),
  guildIdIdx: index('guild_id_idx').on(table.guildId),
  createdAtIdx: index('created_at_idx').on(table.createdAt),
}));

export type DbDocument = InferSelectModel<typeof documents>;
export type NewDbDocument = InferInsertModel<typeof documents>;
export type DbEmbedding = InferInsertModel<typeof embeddings>;
export type NewDbEmbedding = InferSelectModel<typeof embeddings>;
export type DbDiscordMessage = InferSelectModel<typeof discordMessages>;
export type NewDbDiscordMessage = InferInsertModel<typeof discordMessages>;
export type DbRagQuery = InferSelectModel<typeof ragQueries>;
export type NewDbRagQuery = InferInsertModel<typeof ragQueries>;
