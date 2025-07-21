import { PostgreSqlContainer,StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle,PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

let testContainer: StartedPostgreSqlContainer | null = null;
let testDb: PostgresJsDatabase | null = null;
let testClient: postgres.Sql | null = null;

export async function getTestDatabase() {
  if (testDb) {
    return testDb;
  }

  console.log('🐳 Starting PostgreSQL test container...');
  
  testContainer = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();

  const connectionString = testContainer.getConnectionUri();
  console.log('📦 Test database container started');
  
  // PostgreSQL接続クライアント作成
  testClient = postgres(connectionString, {
    max: 1, // テスト用なので接続数を制限
  });

  testDb = drizzle(testClient);

  // pgvector拡張を有効化
  await testClient`CREATE EXTENSION IF NOT EXISTS vector`;

  // マイグレーション実行
  await migrate(testDb,{migrationsFolder: '../../../drizzle'})
  
  console.log('✅ Test database setup completed');
  return testDb;
}


export async function cleanupTestDatabase() {
  try {
    if (testClient) {
      await testClient.end();
      testClient = null;
    }
    
    if (testContainer) {
      await testContainer.stop();
      testContainer = null;
    }
    
    testDb = null;
    console.log('🗑️  Test database cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up test database:', error);
  }
}

export async function clearTestData() {
  if (!testClient) throw new Error('Test client not initialized');

  // テストデータをクリア（外部キー制約を考慮した順序で削除）
  await testClient`DELETE FROM embeddings`;
  await testClient`DELETE FROM rag_queries`;
  await testClient`DELETE FROM init_jobs`;
  await testClient`DELETE FROM documents`;
  await testClient`DELETE FROM discord_messages`;
  
  console.log('🧹 Test data cleared');
}

export function getTestConnectionString(): string {
  if (!testContainer) {
    throw new Error('Test container not started');
  }
  return testContainer.getConnectionUri();
}