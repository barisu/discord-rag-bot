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

// Legacy schema types (for backward compatibility)
export type DbDocument = InferSelectModel<typeof documents>;
export type NewDbDocument = InferInsertModel<typeof documents>;

// Other types
export type DbDiscordMessage = InferSelectModel<typeof discordMessages>;
export type NewDbDiscordMessage = InferInsertModel<typeof discordMessages>;
export type DbRagQuery = InferSelectModel<typeof ragQueries>;
export type NewDbRagQuery = InferInsertModel<typeof ragQueries>;
export type DbInitJob = InferSelectModel<typeof initJobs>;
export type NewDbInitJob = InferInsertModel<typeof initJobs>;
