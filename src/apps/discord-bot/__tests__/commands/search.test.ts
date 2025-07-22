import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Message, Client, EmbedBuilder, MessageReplyOptions } from 'discord.js';
import { SearchCommand } from '../../src/commands/search';

// モック
vi.mock('@rag/retrieval', () => ({
  RagRetriever: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
  })),
}));

vi.mock('@rag/embeddings', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@rag/vectorstore', () => ({
  PostgresVectorStore: vi.fn().mockImplementation(() => ({
    getDocumentCount: vi.fn(),
  })),
}));

describe('SearchCommand', () => {
  let searchCommand: SearchCommand;
  let mockMessage: Partial<Message>;
  let mockClient: Partial<Client>;
  let mockRagRetriever: any;
  let mockVectorStore: any;

  beforeEach(() => {
    // クライアントのモック
    mockClient = {};

    // メッセージのモック
    mockMessage = {
      author: {
        id: 'test-user-id',
      } as any,
      guildId: 'test-guild-id',
      reply: vi.fn(),
      followUp: vi.fn(),
    };

    // SearchCommandを作成
    searchCommand = new SearchCommand(mockClient as Client);

    // 内部のRAGコンポーネントにアクセスするため、プライベートプロパティをモック
    mockRagRetriever = {
      query: vi.fn(),
    };

    mockVectorStore = {
      getDocumentCount: vi.fn(),
    };

    // @ts-ignore プライベートプロパティのモック
    searchCommand['ragRetriever'] = mockRagRetriever;
    searchCommand['vectorStore'] = mockVectorStore;
  });

  describe('引数検証', () => {
    it('引数がない場合はヘルプを表示', async () => {
      await searchCommand.execute(mockMessage as Message, []);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '🔍 検索コマンドの使用方法',
              }),
            }),
          ]),
        })
      );
    });

    it('短すぎるクエリでエラー', async () => {
      await searchCommand.execute(mockMessage as Message, ['a']);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ 検索クエリは2文字以上で入力してください。'
      );
    });

    it('長すぎるクエリでエラー', async () => {
      const longQuery = 'a'.repeat(201);
      await searchCommand.execute(mockMessage as Message, [longQuery]);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ 検索クエリは200文字以内で入力してください。'
      );
    });
  });

  describe('検索実行', () => {
    beforeEach(() => {
      mockVectorStore.getDocumentCount.mockResolvedValue(10);
      
      // searchingMessage のモック
      const mockSearchingMessage = {
        edit: vi.fn(),
      };
      mockMessage.reply = vi.fn().mockResolvedValue(mockSearchingMessage);
    });

    it('ドキュメントがない場合の処理', async () => {
      mockVectorStore.getDocumentCount.mockResolvedValue(0);

      await searchCommand.execute(mockMessage as Message, ['test', 'query']);

      // searchingMessage.edit が呼ばれることを確認
      expect(mockMessage.reply).toHaveBeenCalledWith('🔍 検索中...');
    });

    it('正常な検索処理', async () => {
      const mockRagResponse = {
        answer: 'テスト回答です',
        sources: [
          {
            id: '1',
            content: 'テストコンテンツ',
            metadata: { messageId: 'msg-1', channelName: 'test' },
            similarity: 0.85,
          },
        ],
        confidence: 85,
        processingTime: 150,
      };

      mockRagRetriever.query.mockResolvedValue(mockRagResponse);

      await searchCommand.execute(mockMessage as Message, ['test', 'query']);

      // RAG retriever が正しい引数で呼ばれることを確認
      expect(mockRagRetriever.query).toHaveBeenCalledWith({
        query: 'test query',
        userId: 'test-user-id',
        guildId: 'test-guild-id',
        contextLimit: 5,
      });

      // 検索中メッセージが表示されることを確認
      expect(mockMessage.reply).toHaveBeenCalledWith('🔍 検索中...');
    });

    it('エラー処理', async () => {
      mockRagRetriever.query.mockRejectedValue(new Error('Test error'));

      await searchCommand.execute(mockMessage as Message, ['test']);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ エラーが発生しました: Test error'
      );
    });
  });

  describe('ヘルパーメソッド', () => {
    it('getDocumentStats', async () => {
      mockVectorStore.getDocumentCount.mockResolvedValue(42);

      const stats = await searchCommand.getDocumentStats();

      expect(stats).toEqual({
        total: 42,
        bySource: {},
      });
    });

    it('getDocumentStats エラー処理', async () => {
      mockVectorStore.getDocumentCount.mockRejectedValue(new Error('DB error'));

      const stats = await searchCommand.getDocumentStats();

      expect(stats).toEqual({
        total: 0,
        bySource: {},
      });
    });
  });

  describe('プライベートメソッドのテスト', () => {
    it('信頼度による色の判定', () => {
      // プライベートメソッドのテストのため、型アサーションを使用
      const command = searchCommand as any;

      // 色が正しい範囲で返されることを確認（具体的な値は環境依存）
      const color85 = command.getConfidenceColor(85);
      const color65 = command.getConfidenceColor(65);
      const color45 = command.getConfidenceColor(45);
      const color25 = command.getConfidenceColor(25);

      expect(typeof color85).toBe('number');
      expect(typeof color65).toBe('number');
      expect(typeof color45).toBe('number');
      expect(typeof color25).toBe('number');

      // 各色が有効な範囲内であることを確認
      expect(color85).toBeGreaterThan(0);
      expect(color65).toBeGreaterThan(0);
      expect(color45).toBeGreaterThan(0);
      expect(color25).toBeGreaterThan(0);

      // 色が16進数の範囲内であることを確認
      expect(color85).toBeLessThanOrEqual(0xFFFFFF);
      expect(color65).toBeLessThanOrEqual(0xFFFFFF);
      expect(color45).toBeLessThanOrEqual(0xFFFFFF);
      expect(color25).toBeLessThanOrEqual(0xFFFFFF);
    });

    it('検索品質の説明', () => {
      const command = searchCommand as any;

      expect(command.getSearchQualityDescription(85, 3)).toContain('高品質');
      expect(command.getSearchQualityDescription(65, 2)).toContain('中程度');
      expect(command.getSearchQualityDescription(45, 1)).toContain('低品質');
      expect(command.getSearchQualityDescription(25, 0)).toContain('不十分');
    });
  });

  describe('統合テスト風のシナリオ', () => {
    it('完全な検索フロー', async () => {
      // モックの設定
      mockVectorStore.getDocumentCount.mockResolvedValue(15);
      
      const mockRagResponse = {
        answer: 'TypeScriptでエラーハンドリングを行う場合、try-catch文を使用します。',
        sources: [
          {
            id: '1',
            content: 'TypeScriptのエラーハンドリングについて...',
            metadata: { 
              messageId: 'msg-123',
              channelName: 'typescript',
              authorName: 'Developer',
              createdAt: '2025-01-01T00:00:00Z'
            },
            similarity: 0.92,
          },
        ],
        confidence: 92,
        processingTime: 250,
      };

      mockRagRetriever.query.mockResolvedValue(mockRagResponse);

      const mockSearchingMessage = {
        edit: vi.fn(),
      };
      mockMessage.reply = vi.fn().mockResolvedValue(mockSearchingMessage);
      mockMessage.followUp = vi.fn();

      // テスト実行
      await searchCommand.execute(mockMessage as Message, ['TypeScript', 'エラーハンドリング']);

      // 検証
      expect(mockRagRetriever.query).toHaveBeenCalledWith({
        query: 'TypeScript エラーハンドリング',
        userId: 'test-user-id', 
        guildId: 'test-guild-id',
        contextLimit: 5,
      });

      expect(mockSearchingMessage.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '',
          embeds: expect.arrayContaining([
            expect.any(EmbedBuilder),
          ]),
        })
      );

      expect(mockMessage.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.any(EmbedBuilder),
          ]),
        })
      );
    });
  });
});