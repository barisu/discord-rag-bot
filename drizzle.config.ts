import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/packages/shared/src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/discord_rag_bot',
  },
  verbose: true,
  strict: true,
});