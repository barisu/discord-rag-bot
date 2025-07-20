import type { DatabaseConfig, ApiConfig } from '../types';

export function getDatabaseConfig(): DatabaseConfig {
  return {
    url: process.env.DATABASE_URL || 'sqlite:./data.db',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    ssl: process.env.DB_SSL === 'true',
  };
}

export function getApiConfig(): ApiConfig {
  return {
    port: parseInt(process.env.PORT || '3000'),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  };
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
} as const;