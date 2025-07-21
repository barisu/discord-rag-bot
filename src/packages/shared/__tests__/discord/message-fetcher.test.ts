import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { MessageFetcher, type MessageData, type FetchProgress } from '../../src/discord/message-fetcher';
import { Client, ChannelType, CategoryChannel, TextChannel, Collection, Message, User } from 'discord.js';

// Discord.jsのモック
vi.mock('discord.js', async () => {
  const actual = await vi.importActual('discord.js');
  return {
    ...actual,
    Client: vi.fn(),
    ChannelType: {
      GuildCategory: 4,
      GuildText: 0,
    },
  };
});

describe('MessageFetcher', () => {
  let messageFetcher: MessageFetcher;
  let mockClient: {
    channels: {
      fetch: Mock;
    };
  };

  beforeEach(() => {
    mockClient = {
      channels: {
        fetch: vi.fn(),
      },
    };
    messageFetcher = new MessageFetcher(mockClient as any);
  });

  describe('fetchCategoryMessages', () => {
    it('カテゴリが見つからない場合はエラーを投げる', async () => {
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(
        messageFetcher.fetchCategoryMessages('invalid-category-id')
      ).rejects.toThrow('Category not found or invalid: invalid-category-id');
    });

    it('カテゴリタイプが正しくない場合はエラーを投げる', async () => {
      const mockChannel = {
        type: ChannelType.GuildText, // カテゴリではない
      };
      mockClient.channels.fetch.mockResolvedValue(mockChannel);

      await expect(
        messageFetcher.fetchCategoryMessages('wrong-type-id')
      ).rejects.toThrow('Category not found or invalid: wrong-type-id');
    });

    it('空のカテゴリからは空の配列を返す', async () => {
      const mockCategory = createMockCategory('test-category', []);
      mockClient.channels.fetch.mockResolvedValue(mockCategory);

      const result = await messageFetcher.fetchCategoryMessages('test-category-id');

      expect(result).toEqual([]);
    });

    it('テキストチャンネルからメッセージを取得する', async () => {
      const mockMessages = [
        createMockMessage('msg1', 'Hello world', 'user1', 'channel1'),
        createMockMessage('msg2', 'Check this link: https://example.com', 'user2', 'channel1'),
      ];

      const mockChannel = createMockTextChannel('general', mockMessages);
      const mockCategory = createMockCategory('test-category', [mockChannel]);
      
      mockClient.channels.fetch.mockResolvedValue(mockCategory);

      const result = await messageFetcher.fetchCategoryMessages('test-category-id');

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Hello world');
      expect(result[1].content).toBe('Check this link: https://example.com');
      expect(result[1].links).toEqual(['https://example.com']);
    });

    it('進捗コールバックが正しく呼ばれる', async () => {
      const mockChannel = createMockTextChannel('general', [
        createMockMessage('msg1', 'Hello', 'user1', 'channel1'),
      ]);
      const mockCategory = createMockCategory('test-category', [mockChannel]);
      
      mockClient.channels.fetch.mockResolvedValue(mockCategory);

      const progressCallback = vi.fn();
      await messageFetcher.fetchCategoryMessages('test-category-id', progressCallback);

      // 最初の呼び出し（処理開始時）
      expect(progressCallback).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          totalChannels: 1,
          currentChannel: 'general',
        })
      );

      // 2回目の呼び出し（処理完了時）
      expect(progressCallback).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          totalChannels: 1,
          processedChannels: 1,
          totalMessages: 1,
          processedMessages: 1,
        })
      );
    });

    it('複数チャンネルからメッセージを取得する', async () => {
      const channel1Messages = [createMockMessage('msg1', 'Channel 1', 'user1', 'channel1')];
      const channel2Messages = [createMockMessage('msg2', 'Channel 2', 'user2', 'channel2')];

      const mockChannel1 = createMockTextChannel('general', channel1Messages);
      const mockChannel2 = createMockTextChannel('random', channel2Messages);
      const mockCategory = createMockCategory('test-category', [mockChannel1, mockChannel2]);
      
      mockClient.channels.fetch.mockResolvedValue(mockCategory);

      const result = await messageFetcher.fetchCategoryMessages('test-category-id');

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Channel 1');
      expect(result[1].content).toBe('Channel 2');
    });
  });

  describe('validateCategoryAccess', () => {
    it('有効なカテゴリの場合はtrueを返す', async () => {
      const mockCategory = createMockCategory('test-category', []);
      mockCategory.guildId = 'test-guild-id';
      mockClient.channels.fetch.mockResolvedValue(mockCategory);

      const result = await messageFetcher.validateCategoryAccess('category-id', 'test-guild-id');

      expect(result).toBe(true);
    });

    it('無効なカテゴリの場合はfalseを返す', async () => {
      mockClient.channels.fetch.mockResolvedValue(null);

      const result = await messageFetcher.validateCategoryAccess('invalid-id', 'guild-id');

      expect(result).toBe(false);
    });

    it('異なるギルドのカテゴリの場合はfalseを返す', async () => {
      const mockCategory = createMockCategory('test-category', []);
      mockCategory.guildId = 'different-guild-id';
      mockClient.channels.fetch.mockResolvedValue(mockCategory);

      const result = await messageFetcher.validateCategoryAccess('category-id', 'test-guild-id');

      expect(result).toBe(false);
    });

    it('APIエラーの場合はfalseを返す', async () => {
      mockClient.channels.fetch.mockRejectedValue(new Error('API Error'));

      const result = await messageFetcher.validateCategoryAccess('category-id', 'guild-id');

      expect(result).toBe(false);
    });
  });

  describe('getCategoryName', () => {
    it('有効なカテゴリの名前を返す', async () => {
      const mockCategory = createMockCategory('test-category', []);
      mockClient.channels.fetch.mockResolvedValue(mockCategory);

      const result = await messageFetcher.getCategoryName('category-id');

      expect(result).toBe('test-category');
    });

    it('無効なカテゴリの場合はnullを返す', async () => {
      mockClient.channels.fetch.mockResolvedValue(null);

      const result = await messageFetcher.getCategoryName('invalid-id');

      expect(result).toBe(null);
    });

    it('APIエラーの場合はnullを返す', async () => {
      mockClient.channels.fetch.mockRejectedValue(new Error('API Error'));

      const result = await messageFetcher.getCategoryName('category-id');

      expect(result).toBe(null);
    });
  });

  describe('リンク抽出機能', () => {
    it('HTTPSリンクを正しく抽出する', async () => {
      const mockMessage = createMockMessage(
        'msg1', 
        'Check this out: https://example.com and also https://github.com/user/repo',
        'user1',
        'channel1'
      );
      const mockChannel = createMockTextChannel('general', [mockMessage]);
      const mockCategory = createMockCategory('test-category', [mockChannel]);
      
      mockClient.channels.fetch.mockResolvedValue(mockCategory);

      const result = await messageFetcher.fetchCategoryMessages('test-category-id');

      expect(result[0].links).toEqual([
        'https://example.com',
        'https://github.com/user/repo'
      ]);
    });

    it('HTTPリンクも抽出する', async () => {
      const mockMessage = createMockMessage(
        'msg1',
        'Visit http://old-site.com for legacy content',
        'user1',
        'channel1'
      );
      const mockChannel = createMockTextChannel('general', [mockMessage]);
      const mockCategory = createMockCategory('test-category', [mockChannel]);
      
      mockClient.channels.fetch.mockResolvedValue(mockCategory);

      const result = await messageFetcher.fetchCategoryMessages('test-category-id');

      expect(result[0].links).toEqual(['http://old-site.com']);
    });

    it('リンクがない場合は空配列を返す', async () => {
      const mockMessage = createMockMessage('msg1', 'Just plain text', 'user1', 'channel1');
      const mockChannel = createMockTextChannel('general', [mockMessage]);
      const mockCategory = createMockCategory('test-category', [mockChannel]);
      
      mockClient.channels.fetch.mockResolvedValue(mockCategory);

      const result = await messageFetcher.fetchCategoryMessages('test-category-id');

      expect(result[0].links).toEqual([]);
    });
  });
});

// テストヘルパー関数
function createMockMessage(id: string, content: string, authorId: string, channelId: string): Message {
  const mockUser = {
    id: authorId,
    username: `user-${authorId}`,
  } as User;

  return {
    id,
    content,
    channelId,
    guildId: 'test-guild-id',
    author: mockUser,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    channel: {
      name: `channel-${channelId}`,
    } as TextChannel,
  } as Message;
}

function createMockTextChannel(name: string, messages: Message[]): TextChannel {
  const messageCollection = new Collection<string, Message>();
  messages.forEach(msg => messageCollection.set(msg.id, msg));

  return {
    name,
    type: ChannelType.GuildText,
    messages: {
      fetch: vi.fn().mockImplementation(({ limit, before }) => {
        if (before) {
          // 'before'指定時は空のCollectionを返す（簡単なモック）
          return Promise.resolve(new Collection());
        }
        
        // limitに応じてメッセージを返す（逆順で）
        const limitedMessages = new Collection<string, Message>();
        const messagesToReturn = messages.slice(0, limit || messages.length).reverse();
        messagesToReturn.forEach(msg => limitedMessages.set(msg.id, msg));
        
        // lastメッセージを正しく設定
        const collection = limitedMessages;
        collection.last = () => messagesToReturn[messagesToReturn.length - 1];
        
        return Promise.resolve(collection);
      }),
    },
  } as any;
}

function createMockCategory(name: string, channels: TextChannel[]): CategoryChannel {
  const channelCollection = new Collection<string, TextChannel>();
  channels.forEach((channel, index) => {
    channelCollection.set(`channel-${index}`, channel);
  });

  return {
    name,
    type: ChannelType.GuildCategory,
    guildId: 'test-guild-id',
    children: {
      cache: channelCollection,
    },
  } as any;
}