import { Message, EmbedBuilder, Client, Colors } from 'discord.js';
import { DocumentSearchResponse } from '@shared/core';
import { DocumentSearchService } from '../services/document-search.service';

/**
 * ドキュメント検索コマンド (!search)
 * 
 * ユーザーのクエリに基づいて、データベースから部分一致検索を行い、
 * 関連するドキュメントを提供する
 */
export class SearchCommand {
  private searchService: DocumentSearchService;

  constructor(client: Client) {
    this.searchService = new DocumentSearchService();
  }

  /**
   * 検索コマンドを実行
   */
  async execute(message: Message, args: string[]): Promise<void> {
    try {
      // 引数チェック
      if (args.length === 0) {
        await this.sendHelpMessage(message);
        return;
      }

      const query = args.join(' ').trim();
      
      if (query.length < 2) {
        await message.reply('❌ 検索クエリは2文字以上で入力してください。');
        return;
      }

      if (query.length > 200) {
        await message.reply('❌ 検索クエリは200文字以内で入力してください。');
        return;
      }

      // 検索開始メッセージ
      const searchingMessage = await message.reply('🔍 検索中...');

      // データベース内のドキュメント数を確認
      const documentCount = await this.searchService.getDocumentCount();
      if (documentCount === 0) {
        await searchingMessage.edit('❌ 検索可能なドキュメントがありません。まず `!init-db` でデータを初期化してください。');
        return;
      }

      // 部分一致検索を実行
      const searchResponse = await this.searchService.searchDocuments(query);
      
      // 検索結果のEmbedを作成
      const embed = await this.createSearchResultEmbed(query, searchResponse, documentCount);
      
      // 検索中メッセージを結果に更新
      await searchingMessage.edit({ content: '', embeds: [embed] });

      // 検索履歴をログに記録
      await this.logSearchQuery(query, searchResponse, message.author.id, message.guildId);

    } catch (error) {
      console.error('Search command error:', error);
      
      const errorMessage = error instanceof Error 
        ? `エラーが発生しました: ${error.message}`
        : '予期しないエラーが発生しました。';
      
      await message.reply(`❌ ${errorMessage}`);
    }
  }

  /**
   * 検索結果のEmbedを作成
   */
  private async createSearchResultEmbed(
    query: string,
    searchResponse: DocumentSearchResponse,
    documentCount: number
  ): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setTitle('🔍 検索結果')
      .setDescription(`**クエリ**: ${query}`)
      .setColor(searchResponse.results.length > 0 ? Colors.Blue : Colors.Orange)
      .addFields(
        {
          name: '📊 検索統計',
          value: [
            `• **検索時間**: ${searchResponse.processingTime}ms`,
            `• **発見件数**: ${searchResponse.results.length}件`,
            `• **総ドキュメント数**: ${documentCount}件`,
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ 
        text: `検索実行時刻: ${new Date().toLocaleString('ja-JP')}` 
      })
      .setTimestamp();

    // 検索結果を追加
    if (searchResponse.results.length === 0) {
      embed.addFields({
        name: '❌ 結果なし',
        value: '関連するドキュメントが見つかりませんでした。別のキーワードで検索してみてください。',
        inline: false,
      });
    } else {
      searchResponse.results.forEach((result, index) => {
        const title = result.title || 'タイトルなし';
        const domain = result.metadata?.domain || '不明なドメイン';
        const content = result.content.length > 200 
          ? result.content.substring(0, 200) + '...'
          : result.content;
        
        embed.addFields({
          name: `${index + 1}. ${title}`,
          value: [
            `**URL**: ${result.url}`,
            `**ドメイン**: ${domain}`,
            `**内容**: ${content}`,
            result.messageId ? `**メッセージID**: ${result.messageId}` : null,
          ].filter(Boolean).join('\n'),
          inline: false,
        });
      });
    }

    return embed;
  }


  /**
   * ヘルプメッセージを送信
   */
  private async sendHelpMessage(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔍 検索コマンドの使用方法')
      .setDescription('データベースに保存されたメッセージから情報を検索します。')
      .setColor(Colors.Green)
      .addFields(
        {
          name: '📖 基本的な使い方',
          value: '`!search <検索したい内容>`',
          inline: false,
        },
        {
          name: '💡 使用例',
          value: [
            '`!search TypeScript エラー処理`',
            '`!search Discord Bot 作り方`',
            '`!search データベース接続`',
            '`!search API 使い方`',
          ].join('\n'),
          inline: false,
        },
        {
          name: '⚠️ 注意事項',
          value: [
            '• 検索クエリは2文字以上200文字以内',
            '• まず `!init-db` でデータを初期化してください',
            '• 結果の信頼度が低い場合は別のキーワードを試してください',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📊 その他のコマンド',
          value: [
            '`!init-db <カテゴリID>` - データベース初期化',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: 'Discord RAG Bot | 検索機能' });

    await message.reply({ embeds: [embed] });
  }


  /**
   * 検索クエリをログに記録
   */
  private async logSearchQuery(
    query: string,
    searchResponse: DocumentSearchResponse,
    userId: string,
    guildId: string | null
  ): Promise<void> {
    try {
      console.log('Search query logged:', {
        query,
        userId,
        guildId,
        resultCount: searchResponse.results.length,
        processingTime: searchResponse.processingTime,
      });
    } catch (error) {
      console.warn('Failed to log search query:', error);
    }
  }


}