import { pgTable, serial, text, timestamp, jsonb, index, varchar, numeric, integer, customType, vector } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';

// Source documents table - stores original full documents
export const sourceDocuments = pgTable('source_documents', {
  id: serial('id').primaryKey(),
  url: varchar('url', { length: 500 }).notNull(),
  title: text('title'),
  fullContent: text('full_content').notNull(),
  metadata: jsonb('metadata').default({}),
  messageId: varchar('message_id', { length: 20 }),
  channelId: varchar('channel_id', { length: 20 }),
  authorId: varchar('author_id', { length: 20 }),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  urlIdx: index('source_documents_url_idx').on(table.url),
  messageIdIdx: index('source_documents_message_id_idx').on(table.messageId),
  createdAtIdx: index('source_documents_created_at_idx').on(table.createdAt),
}));

// Document chunks table - stores chunked pieces of source documents
export const documentChunks = pgTable('document_chunks', {
  id: serial('id').primaryKey(),
  sourceDocumentId: serial('source_document_id').references(() => sourceDocuments.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  startPosition: integer('start_position'),
  endPosition: integer('end_position'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceDocumentIdIdx: index('document_chunks_source_document_id_idx').on(table.sourceDocumentId),
  chunkIndexIdx: index('document_chunks_chunk_index_idx').on(table.chunkIndex),
  sourceDocChunkIdx: index('document_chunks_source_doc_chunk_idx').on(table.sourceDocumentId, table.chunkIndex),
}));

// Legacy documents table (for backward compatibility during migration)
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
  chunkId: serial('chunk_id').references(() => documentChunks.id, { onDelete: 'cascade' }).notNull(),
  embedding: vector('embedding',{dimensions: 1536}), // OpenAI text-embedding-3-small dimension
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  chunkIdIdx: index('embeddings_chunk_id_idx').on(table.chunkId),
  // HNSW index for vector similarity search
  embeddingIdx: sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS embedding_hnsw_idx ON ${table} USING hnsw (embedding vector_cosine_ops)`,
}));

// Legacy embeddings table (for backward compatibility during migration)
export const legacyEmbeddings = pgTable('legacy_embeddings', {
  id: serial('id').primaryKey(),
  documentId: serial('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  embedding: vector('embedding',{dimensions: 1536}), // OpenAI text-embedding-3-small dimension
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index('legacy_embeddings_document_id_idx').on(table.documentId),
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
  ragUserIdIdx: index('rag_user_id_idx').on(table.userId),
  ragGuildIdIdx: index('rag_guild_id_idx').on(table.guildId),
  ragCreatedAtIdx: index('rag_created_at_idx').on(table.createdAt),
}));

// Keywords table for semantic search
export const keywords = pgTable('keywords', {
  id: serial('id').primaryKey(),
  chunkId: serial('chunk_id').references(() => documentChunks.id, { onDelete: 'cascade' }).notNull(),
  keyword: varchar('keyword', { length: 100 }).notNull(),
  bm25Score: numeric('bm25_score', { precision: 10, scale: 6 }).notNull(),
  termFrequency: integer('term_frequency').notNull(),
  documentFrequency: integer('document_frequency').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI text-embedding-3-small dimension
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  chunkIdIdx: index('keywords_chunk_id_idx').on(table.chunkId),
  keywordIdx: index('keywords_keyword_idx').on(table.keyword),
  bm25ScoreIdx: index('keywords_bm25_score_idx').on(table.bm25Score),
  // HNSW index for keyword vector similarity search
  keywordEmbeddingIdx: sql`CREATE INDEX CONCURRENTLY IF NOT EXISTS keywords_embedding_hnsw_idx ON ${table} USING hnsw (embedding vector_cosine_ops)`,
}));

// Legacy keywords table (for backward compatibility during migration)
export const legacyKeywords = pgTable('legacy_keywords', {
  id: serial('id').primaryKey(),
  documentId: serial('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  keyword: varchar('keyword', { length: 100 }).notNull(),
  bm25Score: numeric('bm25_score', { precision: 10, scale: 6 }).notNull(),
  termFrequency: integer('term_frequency').notNull(),
  documentFrequency: integer('document_frequency').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI text-embedding-3-small dimension
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  documentIdIdx: index('legacy_keywords_document_id_idx').on(table.documentId),
  keywordIdx: index('legacy_keywords_keyword_idx').on(table.keyword),
  bm25ScoreIdx: index('legacy_keywords_bm25_score_idx').on(table.bm25Score),
}));

// DB initialization jobs table
export const initJobs = pgTable('init_jobs', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  categoryId: varchar('category_id', { length: 20 }).notNull(),
  categoryName: varchar('category_name', { length: 100 }).notNull(),
  initiatedBy: varchar('initiated_by', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, running, completed, failed
  totalChannels: integer('total_channels').default(0),
  processedChannels: integer('processed_channels').default(0),
  totalMessages: integer('total_messages').default(0),
  processedMessages: integer('processed_messages').default(0),
  linksFound: integer('links_found').default(0),
  documentsCreated: integer('documents_created').default(0),
  keywordsExtracted: integer('keywords_extracted').default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildIdIdx: index('init_jobs_guild_id_idx').on(table.guildId),
  statusIdx: index('init_jobs_status_idx').on(table.status),
  createdAtIdx: index('init_jobs_created_at_idx').on(table.createdAt),
}));

// New schema types
export type DbSourceDocument = InferSelectModel<typeof sourceDocuments>;
export type NewDbSourceDocument = InferInsertModel<typeof sourceDocuments>;
export type DbDocumentChunk = InferSelectModel<typeof documentChunks>;
export type NewDbDocumentChunk = InferInsertModel<typeof documentChunks>;
export type DbEmbedding = InferSelectModel<typeof embeddings>;
export type NewDbEmbedding = InferInsertModel<typeof embeddings>;
export type DbKeyword = InferSelectModel<typeof keywords>;
export type NewDbKeyword = InferInsertModel<typeof keywords>;

// Legacy schema types (for backward compatibility)
export type DbDocument = InferSelectModel<typeof documents>;
export type NewDbDocument = InferInsertModel<typeof documents>;
export type DbLegacyEmbedding = InferSelectModel<typeof legacyEmbeddings>;
export type NewDbLegacyEmbedding = InferInsertModel<typeof legacyEmbeddings>;
export type DbLegacyKeyword = InferSelectModel<typeof legacyKeywords>;
export type NewDbLegacyKeyword = InferInsertModel<typeof legacyKeywords>;

// Other types
export type DbDiscordMessage = InferSelectModel<typeof discordMessages>;
export type NewDbDiscordMessage = InferInsertModel<typeof discordMessages>;
export type DbRagQuery = InferSelectModel<typeof ragQueries>;
export type NewDbRagQuery = InferInsertModel<typeof ragQueries>;
export type DbInitJob = InferSelectModel<typeof initJobs>;
export type NewDbInitJob = InferInsertModel<typeof initJobs>;
