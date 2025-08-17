import type { Message } from 'discord.js';
import { 
  MessageFetcher, 
  type MessageData,
  type Logger,
  ProgressTracker,
  DiscordProgressReporter,
  DatabaseError,
  safeAsync
} from '@shared/core';
import { getDatabaseConnection, discordMessages } from '@shared/core';

/**
 * メッセージ処理サービス
 * Discordからのメッセージ取得とデータベース保存を担当
 */
export class MessageProcessingService {
  constructor(
    public readonly messageFetcher: MessageFetcher,
    private readonly logger: Logger
  ) {}

  /**
   * カテゴリのメッセージを取得してデータベースに保存
   */
  async processMessages(
    categoryId: string,
    statusMessage: Message,
    progressTracker: ProgressTracker
  ): Promise<{
    messages: MessageData[];
    totalLinks: number;
  }> {
    const db = getDatabaseConnection();
    
    // 進捗レポーターを設定
    const progressReporter = new DiscordProgressReporter(statusMessage);
    progressTracker.addCallback(progressReporter.createCallback());

    try {
      // メッセージ取得の進捗コールバック
      const onProgress = async (progress: any) => {
        await progressTracker.update({
          currentStep: `チャンネル処理中: ${progress.processedChannels}/${progress.totalChannels}`,
          metadata: {
            processedChannels: progress.processedChannels,
            totalChannels: progress.totalChannels,
            totalMessages: progress.totalMessages,
            processedMessages: progress.processedMessages,
          },
        });
      };

      this.logger.info('Starting message fetch', { categoryId });

      // メッセージ履歴を取得
      const messages = await this.messageFetcher.fetchCategoryMessages(categoryId, onProgress);
      
      this.logger.info('Messages fetched successfully', {
        categoryId,
        messageCount: messages.length,
      });

      // リンクを含むメッセージを計算
      const totalLinks = messages.reduce((sum, msg) => sum + msg.links.length, 0);

      // メッセージをデータベースに保存
      await this.saveMessagesToDatabase(messages);

      return { messages, totalLinks };

    } catch (error) {
      this.logger.error('Failed to process messages', error instanceof Error ? error : undefined, {
        categoryId,
      });
      throw new DatabaseError('Failed to process Discord messages', error instanceof Error ? error : undefined);
    }
  }

  /**
   * メッセージをデータベースに一括保存
   */
  private async saveMessagesToDatabase(messages: MessageData[]): Promise<void> {
    const db = getDatabaseConnection();
    
    this.logger.debug('Saving messages to database', { messageCount: messages.length });

    const batchSize = 100;
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const result = await safeAsync(async () => {
        await db
          .insert(discordMessages)
          .values(batch.map(message => ({
            messageId: message.id,
            channelId: message.channelId,
            guildId: message.guildId,
            authorId: message.authorId,
            content: message.content,
            createdAt: message.createdAt,
          })))
          .onConflictDoNothing();
      });

      if (result === null) {
        this.logger.warn('Failed to save message batch', {
          batchStart: i,
          batchSize: batch.length,
        });
      }
    }

    this.logger.info('Messages saved to database successfully', {
      messageCount: messages.length,
    });
  }

  /**
   * リンク付きメッセージをフィルタリング
   */
  filterMessagesWithLinks(messages: MessageData[]): MessageData[] {
    const filtered = messages.filter(msg => msg.links.length > 0);
    
    this.logger.debug('Filtered messages with links', {
      totalMessages: messages.length,
      messagesWithLinks: filtered.length,
    });

    return filtered;
  }

  /**
   * メッセージ統計を取得
   */
  getMessageStats(messages: MessageData[]): {
    totalMessages: number;
    messagesWithLinks: number;
    totalLinks: number;
    uniqueChannels: number;
    uniqueAuthors: number;
  } {
    const messagesWithLinks = messages.filter(msg => msg.links.length > 0);
    const totalLinks = messages.reduce((sum, msg) => sum + msg.links.length, 0);
    const uniqueChannels = new Set(messages.map(msg => msg.channelId)).size;
    const uniqueAuthors = new Set(messages.map(msg => msg.authorId)).size;

    return {
      totalMessages: messages.length,
      messagesWithLinks: messagesWithLinks.length,
      totalLinks,
      uniqueChannels,
      uniqueAuthors,
    };
  }
}