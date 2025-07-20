import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let client: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function createDatabaseConnection(connectionString: string) {
  if (!client) {
    client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: true,
    });
    
    db = drizzle(client, { schema });
  }
  
  return db;
}

export function getDatabaseConnection() {
  if (!db) {
    throw new Error('Database connection not initialized. Call createDatabaseConnection() first.');
  }
  return db;
}

export async function closeDatabaseConnection() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

export { schema };