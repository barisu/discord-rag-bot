import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTestDatabase, clearTestData } from '../helpers/database';
import { discordMessages, documents, initJobs, embeddings } from '../../src/database/schema';
import { eq, and } from 'drizzle-orm';

describe('Database Schema', () => {
  let db: any;

  beforeEach(async () => {
    db = await getTestDatabase();
    await clearTestData();
  });

  afterEach(async () => {
    await clearTestData();
  });

  describe('discord_messages テーブル', () => {
    it('メッセージを正常に挿入できる', async () => {
      const messageData = {
        messageId: 'test-message-123',
        channelId: 'test-channel-456',
        guildId: 'test-guild-789',
        authorId: 'test-author-101',
        content: 'テストメッセージです',
        createdAt: new Date('2024-01-01T12:00:00Z'),
      };

      const result = await db.insert(discordMessages).values(messageData).returning();

      expect(result).toHaveLength(1);
      expect(result[0].messageId).toBe('test-message-123');
      expect(result[0].content).toBe('テストメッセージです');
    });

    it('重複したmessage_idは挿入できない', async () => {
      const messageData = {
        messageId: 'duplicate-message-id',
        channelId: 'channel1',
        guildId: 'guild1',
        authorId: 'author1',
        content: 'First message',
        createdAt: new Date(),
      };

      await db.insert(discordMessages).values(messageData);

      // 同じmessage_idで再度挿入を試行
      const duplicateData = {
        ...messageData,
        content: 'Second message',
      };

      await expect(
        db.insert(discordMessages).values(duplicateData)
      ).rejects.toThrow();
    });

    it('onConflictDoNothingで重複を無視できる', async () => {
      const messageData = {
        messageId: 'conflict-test-id',
        channelId: 'channel1',
        guildId: 'guild1',
        authorId: 'author1',
        content: 'Original message',
        createdAt: new Date(),
      };

      await db.insert(discordMessages).values(messageData);

      // 重複挿入をonConflictDoNothingで実行
      const duplicateData = {
        ...messageData,
        content: 'Duplicate message',
      };

      await db.insert(discordMessages).values(duplicateData).onConflictDoNothing();

      // 元のデータが保持されているか確認
      const result = await db
        .select()
        .from(discordMessages)
        .where(eq(discordMessages.messageId, 'conflict-test-id'));

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Original message');
    });

    it('メッセージを検索できる', async () => {
      const messagesData = [
        {
          messageId: 'msg1',
          channelId: 'channel1',
          guildId: 'guild1',
          authorId: 'author1',
          content: 'Hello world',
          createdAt: new Date('2024-01-01T12:00:00Z'),
        },
        {
          messageId: 'msg2',
          channelId: 'channel2',
          guildId: 'guild1',
          authorId: 'author2',
          content: 'Another message',
          createdAt: new Date('2024-01-01T13:00:00Z'),
        },
      ];

      for (const data of messagesData) {
        await db.insert(discordMessages).values(data);
      }

      // ギルドIDで検索
      const guildMessages = await db
        .select()
        .from(discordMessages)
        .where(eq(discordMessages.guildId, 'guild1'));

      expect(guildMessages).toHaveLength(2);

      // チャンネルIDで検索
      const channelMessages = await db
        .select()
        .from(discordMessages)
        .where(eq(discordMessages.channelId, 'channel1'));

      expect(channelMessages).toHaveLength(1);
      expect(channelMessages[0].content).toBe('Hello world');
    });
  });

  describe('documents テーブル', () => {
    it('ドキュメントを正常に挿入できる', async () => {
      const documentData = {
        content: 'これはテストドキュメントの内容です。',
        source: 'https://example.com/article',
        metadata: {
          title: 'テスト記事',
          description: 'テスト用の記事です',
          domain: 'example.com',
          messageId: 'msg-123',
          channelId: 'channel-456',
          authorId: 'author-789',
          processedAt: new Date().toISOString(),
        },
      };

      const result = await db.insert(documents).values(documentData).returning();

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('これはテストドキュメントの内容です。');
      expect(result[0].source).toBe('https://example.com/article');
      expect(result[0].metadata.title).toBe('テスト記事');
    });

    it('ベクトル埋め込みを保存できる', async () => {
      // まずドキュメントを作成
      const documentData = {
        content: 'ベクトル埋め込みテスト',
        source: 'https://test.com',
        metadata: { title: 'Vector Test' },
      };

      const docResult = await db.insert(documents).values(documentData).returning();
      expect(docResult).toHaveLength(1);

      // 次に埋め込みを作成
      const embeddingData = {
        documentId: docResult[0].id,
        embedding: Array(1534).fill(0.1), // 正しい次元数を使用
      };

      const embeddingResult = await db.insert(embeddings).values(embeddingData).returning();

      expect(embeddingResult).toHaveLength(1);
      expect(embeddingResult[0].embedding).toBeDefined();
      expect(embeddingResult[0].documentId).toBe(docResult[0].id);
    });

    it('複数のドキュメントを検索できる', async () => {
      const documentsData = [
        {
          content: 'TypeScriptに関する記事',
          source: 'https://typescript.example.com',
          metadata: { title: 'TypeScript Guide', domain: 'typescript.example.com' },
        },
        {
          content: 'Reactに関する記事',
          source: 'https://react.example.com',
          metadata: { title: 'React Tutorial', domain: 'react.example.com' },
        },
      ];

      for (const data of documentsData) {
        await db.insert(documents).values(data);
      }

      const allDocs = await db.select().from(documents);
      expect(allDocs).toHaveLength(2);

      // メタデータで検索（JSON検索）
      const typescriptDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.metadata, { title: 'TypeScript Guide', domain: 'typescript.example.com' }));

      expect(typescriptDocs).toHaveLength(1);
      expect(typescriptDocs[0].content).toBe('TypeScriptに関する記事');
    });
  });

  describe('init_jobs テーブル', () => {
    it('初期化ジョブを正常に作成できる', async () => {
      const jobData = {
        guildId: 'test-guild-id',
        categoryId: 'test-category-id',
        categoryName: 'テストカテゴリ',
        initiatedBy: 'test-user-id',
        status: 'pending' as const,
      };

      const result = await db.insert(initJobs).values(jobData).returning();

      expect(result).toHaveLength(1);
      expect(result[0].guildId).toBe('test-guild-id');
      expect(result[0].status).toBe('pending');
      expect(result[0].id).toBeDefined();
    });

    it('ジョブのステータスを更新できる', async () => {
      const jobData = {
        guildId: 'guild-123',
        categoryId: 'category-456',
        categoryName: 'General',
        initiatedBy: 'user-789',
        status: 'pending' as const,
      };

      const [job] = await db.insert(initJobs).values(jobData).returning();

      // ステータスを running に更新
      await db
        .update(initJobs)
        .set({
          status: 'running',
          startedAt: new Date(),
          totalChannels: 5,
          processedChannels: 0,
        })
        .where(eq(initJobs.id, job.id));

      const updatedJob = await db
        .select()
        .from(initJobs)
        .where(eq(initJobs.id, job.id));

      expect(updatedJob[0].status).toBe('running');
      expect(updatedJob[0].startedAt).toBeInstanceOf(Date);
      expect(updatedJob[0].totalChannels).toBe(5);
    });

    it('実行中のジョブを検索できる', async () => {
      const jobsData = [
        {
          guildId: 'guild-1',
          categoryId: 'cat-1',
          categoryName: 'Category 1',
          initiatedBy: 'user-1',
          status: 'running' as const,
        },
        {
          guildId: 'guild-1',
          categoryId: 'cat-2',
          categoryName: 'Category 2',
          initiatedBy: 'user-1',
          status: 'completed' as const,
        },
        {
          guildId: 'guild-2',
          categoryId: 'cat-3',
          categoryName: 'Category 3',
          initiatedBy: 'user-2',
          status: 'running' as const,
        },
      ];

      for (const data of jobsData) {
        await db.insert(initJobs).values(data);
      }

      // 特定ギルドの実行中ジョブを検索
      const runningJobs = await db
        .select()
        .from(initJobs)
        .where(
          and(
            eq(initJobs.guildId, 'guild-1'),
            eq(initJobs.status, 'running')
          )
        );

      expect(runningJobs).toHaveLength(1);
      expect(runningJobs[0].categoryName).toBe('Category 1');
    });

    it('ジョブ完了時に統計情報を記録できる', async () => {
      const jobData = {
        guildId: 'guild-stat-test',
        categoryId: 'category-stat-test',
        categoryName: 'Statistics Test',
        initiatedBy: 'user-stat-test',
        status: 'pending' as const,
      };

      const [job] = await db.insert(initJobs).values(jobData).returning();

      // 完了時の統計情報を更新
      await db
        .update(initJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          totalChannels: 3,
          processedChannels: 3,
          totalMessages: 150,
          processedMessages: 150,
          documentsCreated: 25,
          linksFound: 30,
        })
        .where(eq(initJobs.id, job.id));

      const completedJob = await db
        .select()
        .from(initJobs)
        .where(eq(initJobs.id, job.id));

      expect(completedJob[0].status).toBe('completed');
      expect(completedJob[0].documentsCreated).toBe(25);
      expect(completedJob[0].linksFound).toBe(30);
      expect(completedJob[0].totalMessages).toBe(150);
    });

    it('エラー発生時にエラーメッセージを記録できる', async () => {
      const jobData = {
        guildId: 'guild-error-test',
        categoryId: 'category-error-test',
        categoryName: 'Error Test',
        initiatedBy: 'user-error-test',
        status: 'running' as const,
      };

      const [job] = await db.insert(initJobs).values(jobData).returning();

      // エラー発生時の情報を更新
      await db
        .update(initJobs)
        .set({
          status: 'failed',
          errorMessage: 'Discord API rate limit exceeded',
          completedAt: new Date(),
        })
        .where(eq(initJobs.id, job.id));

      const failedJob = await db
        .select()
        .from(initJobs)
        .where(eq(initJobs.id, job.id));

      expect(failedJob[0].status).toBe('failed');
      expect(failedJob[0].errorMessage).toBe('Discord API rate limit exceeded');
    });
  });

  describe('テーブル間の関係性', () => {
    it('メッセージとドキュメントを関連付けできる', async () => {
      // Discord メッセージを作成
      const messageData = {
        messageId: 'link-msg-123',
        channelId: 'channel-456',
        guildId: 'guild-789',
        authorId: 'author-101',
        content: 'Check this article: https://example.com/article',
        createdAt: new Date(),
      };

      await db.insert(discordMessages).values(messageData);

      // そのメッセージから抽出したドキュメントを作成
      const documentData = {
        content: 'Article content extracted from the link',
        source: 'https://example.com/article',
        metadata: {
          title: 'Example Article',
          domain: 'example.com',
          messageId: 'link-msg-123',
          channelId: 'channel-456',
          authorId: 'author-101',
        },
      };

      await db.insert(documents).values(documentData);

      // メッセージIDで関連ドキュメントを検索
      const relatedDocs = await db
        .select()
        .from(documents)
        // JSON path query を使用してmetadata内のmessageIdで検索
        .where(eq(documents.metadata, documentData.metadata));

      expect(relatedDocs).toHaveLength(1);
      expect(relatedDocs[0].metadata.messageId).toBe('link-msg-123');
    });
  });
});