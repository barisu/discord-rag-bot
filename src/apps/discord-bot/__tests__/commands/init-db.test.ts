import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InitDbCommand } from '../../src/commands/init-db';
import { MessageFetcher, type MessageData } from '@shared/core';
import { LinkProcessor, type ProcessedContent } from '@shared/core';
import { getTestDatabase, clearTestData } from '../../../../packages/shared/__tests__/helpers/database';
import { Message, GuildMember, PermissionsBitField } from 'discord.js';
import { getDatabaseConnection } from '@shared/core';

// モジュールモック
vi.mock('@shared/core', async () => {
  const actual = await vi.importActual('@shared/core');
  return {
    ...actual,
    MessageFetcher: vi.fn(),
    LinkProcessor: vi.fn(),
  };
});
vi.mock('@rag/core', async () => {
  const actual = await vi.importActual('@rag/core');
  return {
    ...actual,
    SemanticChunker: vi.fn(),
    OpenAIEmbeddings: vi.fn(),
    PostgresVectorStore: vi.fn(),
  };
});

describe('InitDbCommand', () => {
  let initDbCommand: InitDbCommand;
  let mockClient: any;
  let mockMessage: Partial<Message>;
  let mockMember: Partial<GuildMember>;
  let mockMessageFetcher: any;
  let mockLinkProcessor: any;

  beforeEach(async () => {
    // テストデータベースの準備
    const testDb = await getTestDatabase();
    await clearTestData();

    // データベースモックの設定
    vi.mocked(getDatabaseConnection).mockReturnValue(testDb);

    // モックの準備
    mockClient = {};
    
    const mockPermissions = new PermissionsBitField();
    vi.spyOn(mockPermissions, 'has').mockReturnValue(true);

    mockMember = {
      permissions: mockPermissions,
    } as Partial<GuildMember>;

    mockMessage = {
      member: mockMember as GuildMember,
      guildId: 'test-guild-id',
      author: {
        id: 'test-user-id',
      } as any,
      reply: vi.fn().mockResolvedValue({
        edit: vi.fn().mockResolvedValue(undefined),
      }),
    } as any;

    // MessageFetcherのモック
    mockMessageFetcher = {
      validateCategoryAccess: vi.fn().mockResolvedValue(true),
      getCategoryName: vi.fn().mockResolvedValue('テストカテゴリ'),
      fetchCategoryMessages: vi.fn().mockResolvedValue([]),
    };

    // LinkProcessorのモック
    mockLinkProcessor = {
      processLinks: vi.fn().mockResolvedValue([]),
    };

    // モックインスタンスの設定
    (MessageFetcher as any).mockImplementation(() => mockMessageFetcher);
    (LinkProcessor as any).mockImplementation(() => mockLinkProcessor);

    initDbCommand = new InitDbCommand(mockClient);
  });

  afterEach(async () => {
    await clearTestData();
    vi.clearAllMocks();
  });

  describe('権限チェック', () => {
    it('管理者権限がない場合はエラーを返す', async () => {
      vi.spyOn(mockMember!.permissions as PermissionsBitField, 'has').mockReturnValue(false);

      await initDbCommand.execute(mockMessage as Message, ['category-id']);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ このコマンドは管理者のみが実行できます。'
      );
    });

    it('DMで実行された場合はエラーを返す', async () => {
      mockMessage.guildId = null;

      await initDbCommand.execute(mockMessage as Message, ['category-id']);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ このコマンドはサーバー内でのみ実行できます。'
      );
    });

    it('引数が不足している場合はエラーを返す', async () => {
      await initDbCommand.execute(mockMessage as Message, []);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ カテゴリIDを指定してください。\n使用方法: `!init-db <カテゴリID>`'
      );
    });
  });

  describe('カテゴリ検証', () => {
    it('無効なカテゴリの場合はエラーを返す', async () => {
      mockMessageFetcher.validateCategoryAccess.mockResolvedValue(false);

      await initDbCommand.execute(mockMessage as Message, ['invalid-category']);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ 指定されたカテゴリが見つからないか、アクセスできません。'
      );
    });

    it('カテゴリ名が取得できない場合はエラーを返す', async () => {
      mockMessageFetcher.getCategoryName.mockResolvedValue(null);

      await initDbCommand.execute(mockMessage as Message, ['category-id']);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ カテゴリ名を取得できませんでした。'
      );
    });
  });

  describe('重複実行防止', () => {
    it('既に実行中のジョブがある場合はエラーを返す', async () => {
      const db = await getTestDatabase();
      
      // 実行中のジョブを作成
      await db.execute(`
        INSERT INTO init_jobs (guild_id, category_id, category_name, initiated_by, status)
        VALUES ('test-guild-id', 'category-id', 'Test Category', 'user-id', 'running')
      `);

      await initDbCommand.execute(mockMessage as Message, ['category-id']);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ 既に初期化処理が実行中です。完了まで待機してください。'
      );
    });
  });

  describe('正常な実行', () => {
    it('ジョブを作成して処理を開始する', async () => {
      const mockReplyMessage = {
        edit: vi.fn().mockResolvedValue(undefined),
      };
      mockMessage.reply = vi.fn().mockResolvedValue(mockReplyMessage);

      // テストメッセージデータ
      const mockMessages: MessageData[] = [
        {
          id: 'msg1',
          channelId: 'channel1',
          channelName: 'general',
          guildId: 'test-guild-id',
          authorId: 'user1',
          authorName: 'TestUser1',
          content: 'Check this out: https://example.com',
          createdAt: new Date(),
          links: ['https://example.com'],
        },
      ];

      mockMessageFetcher.fetchCategoryMessages.mockResolvedValue(mockMessages);

      // テスト用の処理済みコンテンツ
      const mockProcessedContent: ProcessedContent[] = [
        {
          originalUrl: 'https://example.com',
          title: 'Test Article',
          content: 'This is test content',
          metadata: {
            description: 'Test description',
            domain: 'example.com',
            processedAt: new Date(),
            statusCode: 200,
          },
        },
      ];

      mockLinkProcessor.processLinks.mockResolvedValue(mockProcessedContent);

      await initDbCommand.execute(mockMessage as Message, ['category-id']);

      // ジョブ作成の確認
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('🔄 **データベース初期化を開始します**')
      );

      // しばらく待って処理完了を確認
      await new Promise(resolve => setTimeout(resolve, 100));

      // データベースにレコードが作成されているか確認
      const db = await getTestDatabase();
      const jobs = await db.execute('SELECT * FROM init_jobs WHERE guild_id = \'test-guild-id\'');
      expect(jobs.length).toBeGreaterThan(0);

      const messages = await db.execute('SELECT * FROM discord_messages');
      expect(messages.length).toBeGreaterThan(0);

      const documents = await db.execute('SELECT * FROM documents');
      expect(documents.length).toBeGreaterThan(0);
    });

    it('進捗コールバックが正しく動作する', async () => {
      const mockReplyMessage = {
        edit: vi.fn().mockResolvedValue(undefined),
      };
      mockMessage.reply = vi.fn().mockResolvedValue(mockReplyMessage);

      // 進捗コールバックをテスト
      let progressCallback: ((progress: any) => void) | undefined;
      mockMessageFetcher.fetchCategoryMessages.mockImplementation(
        async (_categoryId: string, onProgress?: (progress: any) => void) => {
          progressCallback = onProgress;
          
          // 進捗を模擬
          if (progressCallback) {
            progressCallback({
              totalChannels: 2,
              processedChannels: 0,
              totalMessages: 0,
              processedMessages: 0,
              currentChannel: 'general',
            });

            progressCallback({
              totalChannels: 2,
              processedChannels: 1,
              totalMessages: 5,
              processedMessages: 5,
            });
          }

          return [];
        }
      );

      await initDbCommand.execute(mockMessage as Message, ['category-id']);

      // 進捗更新メッセージの確認
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockReplyMessage.edit).toHaveBeenCalledWith(
        expect.stringContaining('🔄 **初期化処理中...**')
      );
    });
  });

  describe('エラーハンドリング', () => {
    it('メッセージ取得でエラーが発生した場合は適切に処理する', async () => {
      const mockReplyMessage = {
        edit: vi.fn().mockResolvedValue(undefined),
      };
      mockMessage.reply = vi.fn().mockResolvedValue(mockReplyMessage);

      mockMessageFetcher.fetchCategoryMessages.mockRejectedValue(
        new Error('Discord API Error')
      );

      await initDbCommand.execute(mockMessage as Message, ['category-id']);

      // エラー処理の確認
      await new Promise(resolve => setTimeout(resolve, 100));

      const db = await getTestDatabase();
      const jobs = await db.execute(
        'SELECT status, error_message FROM init_jobs WHERE guild_id = \'test-guild-id\''
      );

      expect(jobs[0]?.status).toBe('failed');
      expect(jobs[0]?.error_message).toContain('Discord API Error');
    });

    it('リンク処理でエラーが発生しても処理を継続する', async () => {
      const mockReplyMessage = {
        edit: vi.fn().mockResolvedValue(undefined),
      };
      mockMessage.reply = vi.fn().mockResolvedValue(mockReplyMessage);

      const mockMessages: MessageData[] = [
        {
          id: 'msg1',
          channelId: 'channel1',
          channelName: 'general', 
          guildId: 'test-guild-id',
          authorId: 'user1',
          authorName: 'TestUser1',
          content: 'Error link: https://error.example.com',
          createdAt: new Date(),
          links: ['https://error.example.com'],
        },
      ];

      mockMessageFetcher.fetchCategoryMessages.mockResolvedValue(mockMessages);
      mockLinkProcessor.processLinks.mockRejectedValue(new Error('Link processing error'));

      await initDbCommand.execute(mockMessage as Message, ['category-id']);

      // 処理完了まで待機
      await new Promise(resolve => setTimeout(resolve, 100));

      // メッセージは保存されているが、ドキュメントは作成されていない
      const db = await getTestDatabase();
      const messages = await db.execute('SELECT * FROM discord_messages');
      expect(messages.length).toBeGreaterThan(0);

      const documents = await db.execute('SELECT * FROM documents');
      expect(documents.length).toBe(0); // リンク処理失敗のため
    });
  });

  describe('引数の処理', () => {
    it('Discord ID記号を正しく除去する', async () => {
      const mockReplyMessage = {
        edit: vi.fn().mockResolvedValue(undefined),
      };
      mockMessage.reply = vi.fn().mockResolvedValue(mockReplyMessage);

      await initDbCommand.execute(mockMessage as Message, ['<#123456789>']);

      expect(mockMessageFetcher.validateCategoryAccess).toHaveBeenCalledWith(
        '123456789',
        'test-guild-id'
      );
    });
  });
});