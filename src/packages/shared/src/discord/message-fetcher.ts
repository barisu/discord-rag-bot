import { Client, ChannelType, CategoryChannel, TextChannel, Collection, Message } from 'discord.js';

export interface MessageData {
  id: string;
  channelId: string;
  channelName: string;
  guildId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  links: string[];
}

export interface FetchProgress {
  totalChannels: number;
  processedChannels: number;
  totalMessages: number;
  processedMessages: number;
  currentChannel?: string;
}

export class MessageFetcher {
  private readonly MESSAGE_LIMIT = 1000;
  private readonly RATE_LIMIT_DELAY = 1000; // 1秒待機

  constructor(private client: Client) {}

  async fetchCategoryMessages(
    categoryId: string,
    onProgress?: (progress: FetchProgress) => void
  ): Promise<MessageData[]> {
    const category = await this.client.channels.fetch(categoryId);
    
    if (!category || category.type !== ChannelType.GuildCategory) {
      throw new Error(`Category not found or invalid: ${categoryId}`);
    }

    const categoryChannel = category as CategoryChannel;
    const textChannels = categoryChannel.children.cache
      .filter(channel => channel.type === ChannelType.GuildText)
      .map(channel => channel as TextChannel);

    const progress: FetchProgress = {
      totalChannels: textChannels.length,
      processedChannels: 0,
      totalMessages: 0,
      processedMessages: 0,
    };

    const allMessages: MessageData[] = [];

    for (const channel of textChannels.values()) {
      progress.currentChannel = channel.name;
      onProgress?.(progress);

      try {
        const channelMessages = await this.fetchChannelMessages(channel);
        allMessages.push(...channelMessages);
        
        progress.processedChannels++;
        progress.totalMessages += channelMessages.length;
        progress.processedMessages = allMessages.length;
        
        onProgress?.(progress);

        // レート制限対策
        await this.delay(this.RATE_LIMIT_DELAY);
      } catch (error) {
        console.error(`Error fetching messages from channel ${channel.name}:`, error);
        // エラーがあっても続行
        progress.processedChannels++;
        onProgress?.(progress);
      }
    }

    return allMessages;
  }

  private async fetchChannelMessages(channel: TextChannel): Promise<MessageData[]> {
    const messages: MessageData[] = [];
    let lastMessageId: string | undefined;
    let fetchedCount = 0;

    while (fetchedCount < this.MESSAGE_LIMIT) {
      const remainingLimit = this.MESSAGE_LIMIT - fetchedCount;
      const batchLimit = Math.min(100, remainingLimit); // Discord API上限は100

      const fetchedMessages = await channel.messages.fetch({
        limit: batchLimit,
        before: lastMessageId,
      });

      if (fetchedMessages.size === 0) {
        break; // これ以上メッセージがない
      }

      for (const message of fetchedMessages.values()) {
        messages.push(this.convertToMessageData(message));
      }

      fetchedCount += fetchedMessages.size;
      lastMessageId = fetchedMessages.last()?.id;

      // レート制限対策
      await this.delay(100);
    }

    return messages.reverse(); // 古い順に並び替え
  }

  private convertToMessageData(message: Message): MessageData {
    const links = this.extractLinks(message.content);
    
    return {
      id: message.id,
      channelId: message.channelId,
      channelName: (message.channel as TextChannel).name,
      guildId: message.guildId || '',
      authorId: message.author.id,
      authorName: message.author.username,
      content: message.content,
      createdAt: message.createdAt,
      links,
    };
  }

  private extractLinks(content: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>]+/g;
    return content.match(urlRegex) || [];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateCategoryAccess(categoryId: string, guildId: string): Promise<boolean> {
    try {
      const category = await this.client.channels.fetch(categoryId);
      return category?.type === ChannelType.GuildCategory && 
             (category as CategoryChannel).guildId === guildId;
    } catch {
      return false;
    }
  }

  async getCategoryName(categoryId: string): Promise<string | null> {
    try {
      const category = await this.client.channels.fetch(categoryId);
      return category?.type === ChannelType.GuildCategory ? category.name : null;
    } catch {
      return null;
    }
  }
}