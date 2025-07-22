import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '@shared/database/schema';
import { getIntegrationConfig } from '../config/integration.env.js';

/**
 * 結合テスト用データベースセットアップクラス
 */
export class IntegrationDatabaseSetup {
  private static client: postgres.Sql | null = null;
  private static db: ReturnType<typeof drizzle> | null = null;
  private static config = getIntegrationConfig();

  /**
   * テスト用データベース接続を作成
   */
  static async createTestDatabase() {
    if (this.db) {
      return this.db;
    }

    console.log('🐳 結合テスト用PostgreSQL接続を開始...');

    try {
      this.client = postgres(this.config.DATABASE_URL, {
        max: 5, // 結合テスト用の接続数制限
        idle_timeout: 20,
        connect_timeout: 10,
      });

      this.db = drizzle(this.client, { schema });

      // 接続テスト
      await this.client`SELECT 1`;
      console.log('✅ データベース接続成功');

      // pgvector拡張確認（pgvectorコンテナでは既に有効）
      const extensions = await this.client`
        SELECT extname FROM pg_extension WHERE extname = 'vector'
      `;
      if (extensions.length > 0) {
        console.log('✅ pgvector拡張確認完了');
      } else {
        // フォールバック: 拡張が無い場合は有効化
        await this.client`CREATE EXTENSION IF NOT EXISTS vector`;
        console.log('✅ pgvector拡張有効化完了');
      }

      // テーブル存在確認
      try {
        await this.client`SELECT 1 FROM discord_messages LIMIT 1`;
        console.log('✅ テーブルが既に存在します（マイグレーション不要）');
      } catch (error) {
        // テーブルが存在しない場合のみマイグレーション実行
        console.log('📄 マイグレーション適用中...');
        await migrate(this.db, { migrationsFolder: '../../../drizzle' });
        console.log('✅ マイグレーション適用完了');
      }

      return this.db;

    } catch (error) {
      console.error('❌ データベース接続エラー:', error);
      throw new Error(
        `結合テスト用データベースに接続できません。\n` +
        `データベースURL: ${this.config.DATABASE_URL}\n` +
        `エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * テストデータをクリーンアップ
   * 全テーブルのデータを削除（外部キー制約を考慮した順序）
   */
  static async cleanDatabase() {
    if (!this.client) {
      throw new Error('データベース接続が初期化されていません');
    }

    console.log('🧹 テストデータクリーンアップ開始...');

    try {
      // 外部キー制約を考慮した削除順序
      await this.client`DELETE FROM embeddings`;
      await this.client`DELETE FROM rag_queries`;
      await this.client`DELETE FROM init_jobs`;
      await this.client`DELETE FROM documents`;
      await this.client`DELETE FROM discord_messages`;

      console.log('✅ テストデータクリーンアップ完了');

    } catch (error) {
      console.error('❌ データクリーンアップエラー:', error);
      throw error;
    }
  }

  /**
   * データベース接続を取得
   */
  static getDatabaseConnection() {
    if (!this.db) {
      throw new Error('データベース接続が初期化されていません。createTestDatabase()を先に呼び出してください。');
    }
    return this.db;
  }

  /**
   * 生のPostgreSQLクライアントを取得
   */
  static getPostgresClient() {
    if (!this.client) {
      throw new Error('PostgreSQLクライアントが初期化されていません。');
    }
    return this.client;
  }

  /**
   * データベース統計情報を取得
   */
  static async getDatabaseStats() {
    if (!this.client) {
      throw new Error('データベース接続が初期化されていません');
    }

    const stats = await this.client`
      SELECT 
        'discord_messages' as table_name,
        COUNT(*) as record_count
      FROM discord_messages
      UNION ALL
      SELECT 
        'documents' as table_name,
        COUNT(*) as record_count  
      FROM documents
      UNION ALL
      SELECT 
        'init_jobs' as table_name,
        COUNT(*) as record_count
      FROM init_jobs
      ORDER BY table_name
    `;

    return stats.reduce((acc, row) => {
      acc[row.table_name as string] = parseInt(row.record_count as string);
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * テーブルの存在確認
   */
  static async verifyTables() {
    if (!this.client) {
      throw new Error('データベース接続が初期化されていません');
    }

    const expectedTables = [
      'discord_messages',
      'documents', 
      'embeddings',
      'rag_queries',
      'init_jobs'
    ];

    const existingTables = await this.client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = ANY(${expectedTables})
    `;

    const existingTableNames = existingTables.map(row => row.table_name as string);
    const missingTables = expectedTables.filter(table => !existingTableNames.includes(table));

    if (missingTables.length > 0) {
      throw new Error(`必要なテーブルが不足しています: ${missingTables.join(', ')}`);
    }

    console.log('✅ 必要なテーブルがすべて存在します');
    return true;
  }

  /**
   * データベース接続をクリーンアップ
   */
  static async cleanup() {
    console.log('🔄 データベース接続クリーンアップ開始...');

    try {
      if (this.client) {
        await this.client.end();
        this.client = null;
        this.db = null;
        console.log('✅ データベース接続クリーンアップ完了');
      }
    } catch (error) {
      console.error('❌ データベースクリーンアップエラー:', error);
      throw error;
    }
  }

  /**
   * テスト用の初期データを投入
   * 基本的なテストケースで使用する最小限のデータ
   */
  static async seedTestData() {
    if (!this.db) {
      throw new Error('データベース接続が初期化されていません');
    }

    console.log('🌱 テスト用初期データ投入開始...');

    try {
      // テスト用Discordメッセージの投入
      const testMessage = {
        messageId: 'test-message-123',
        channelId: this.config.TEST_CATEGORY_ID,
        channelName: 'test-channel',
        guildId: this.config.TEST_GUILD_ID,
        authorId: this.config.TEST_ADMIN_USER_ID,
        authorName: 'TestUser',
        content: 'テスト用メッセージです',
        createdAt: new Date(),
        links: [],
      };

      await this.db.insert(schema.discordMessages).values(testMessage);

      console.log('✅ テスト用初期データ投入完了');

    } catch (error) {
      console.error('❌ テストデータ投入エラー:', error);
      throw error;
    }
  }
}