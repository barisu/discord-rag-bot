import { Message, EmbedBuilder, Client, Colors } from 'discord.js';
import { RagRetriever } from '@rag/retrieval';
import { OpenAIEmbeddings } from '@rag/embeddings';
import { PostgresVectorStore } from '@rag/vectorstore';
import type { Source } from '@shared/core';

/**
 * RAG検索コマンド (!search)
 * 
 * ユーザーのクエリに基づいて、データベースから関連する情報を検索し、
 * 詳細な検索結果と情報源を提供する
 */
export class SearchCommand {
  private ragRetriever: RagRetriever;
  private vectorStore: PostgresVectorStore;

  constructor(client: Client) {
    // API key チェック
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for search functionality');
    }
    
    // RAGシステムを初期化
    const embeddings = new OpenAIEmbeddings(process.env.OPENAI_API_KEY);
    this.vectorStore = new PostgresVectorStore();
    this.ragRetriever = new RagRetriever(embeddings, this.vectorStore);
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
      const documentCount = await this.vectorStore.getDocumentCount();
      if (documentCount === 0) {
        await searchingMessage.edit('❌ 検索可能なドキュメントがありません。まず `!init-db` でデータを初期化してください。');
        return;
      }

      // RAG検索を実行
      const startTime = Date.now();
      const ragResponse = await this.ragRetriever.query({
        query,
        userId: message.author.id,
        guildId: message.guildId || undefined,
        contextLimit: 5,
      });

      // 検索結果のEmbed作成
      const embed = await this.createSearchResultEmbed(query, ragResponse, documentCount, startTime);
      
      // 検索中メッセージを結果に更新
      await searchingMessage.edit({ content: '', embeds: [embed] });

      // 詳細なソース情報が必要な場合は追加で送信
      if (ragResponse.sources.length > 0) {
        const sourceEmbed = await this.createSourcesEmbed(ragResponse.sources);
        await message.reply({ embeds: [sourceEmbed] });
      }

      // 検索履歴をログに記録
      await this.logSearchQuery(query, ragResponse, message.author.id, message.guildId);

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
    ragResponse: any,
    documentCount: number,
    startTime: number
  ): Promise<EmbedBuilder> {
    const processingTime = Date.now() - startTime;
    const confidenceColor = this.getConfidenceColor(ragResponse.confidence);

    const embed = new EmbedBuilder()
      .setTitle('🔍 検索結果')
      .setDescription(`**クエリ**: ${query}`)
      .setColor(confidenceColor)
      .addFields(
        {
          name: '💡 回答',
          value: ragResponse.answer || '関連する情報が見つかりませんでした。',
          inline: false,
        },
        {
          name: '📊 検索統計',
          value: [
            `• **信頼度**: ${ragResponse.confidence.toFixed(1)}%`,
            `• **検索時間**: ${processingTime}ms`,
            `• **発見ソース**: ${ragResponse.sources.length}件`,
            `• **総ドキュメント数**: ${documentCount}件`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🎯 検索品質',
          value: this.getSearchQualityDescription(ragResponse.confidence, ragResponse.sources.length),
          inline: true,
        }
      )
      .setFooter({ 
        text: `検索実行時刻: ${new Date().toLocaleString('ja-JP')}` 
      })
      .setTimestamp();

    return embed;
  }

  /**
   * 情報源詳細のEmbedを作成
   */
  private async createSourcesEmbed(sources: Source[]): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setTitle('📚 情報源詳細')
      .setColor(Colors.Blue);

    sources.slice(0, 5).forEach((source, index) => {
      const similarity = (source.similarity * 100).toFixed(1);
      const content = source.content.length > 150 
        ? source.content.substring(0, 150) + '...'
        : source.content;

      const metadata = source.metadata;
      const sourceInfo = [
        `**類似度**: ${similarity}%`,
        metadata?.messageId ? `**メッセージID**: ${metadata.messageId}` : null,
        metadata?.channelName ? `**チャンネル**: #${metadata.channelName}` : null,
        metadata?.authorName ? `**投稿者**: ${metadata.authorName}` : null,
        metadata?.createdAt ? `**投稿日**: ${new Date(metadata.createdAt).toLocaleDateString('ja-JP')}` : null,
      ].filter(Boolean).join('\n');

      embed.addFields({
        name: `${index + 1}. ソース (ID: ${source.id})`,
        value: `${content}\n\n${sourceInfo}`,
        inline: false,
      });
    });

    if (sources.length > 5) {
      embed.addFields({
        name: '📌 注記',
        value: `他に ${sources.length - 5} 件の関連ソースがあります。`,
        inline: false,
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
            '`!ask <質問>` - AI による回答生成',
            '`!init-db <カテゴリID>` - データベース初期化',
          ].join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: 'Discord RAG Bot | 検索機能' });

    await message.reply({ embeds: [embed] });
  }

  /**
   * 信頼度に基づいて色を決定
   */
  private getConfidenceColor(confidence: number): number {
    if (confidence >= 80) return Colors.Green;
    if (confidence >= 60) return Colors.Yellow;
    if (confidence >= 40) return Colors.Orange;
    return Colors.Red;
  }

  /**
   * 検索品質の説明を取得
   */
  private getSearchQualityDescription(confidence: number, sourceCount: number): string {
    if (confidence >= 80 && sourceCount >= 3) {
      return '🟢 高品質\n複数の関連情報を発見';
    }
    if (confidence >= 60 && sourceCount >= 2) {
      return '🟡 中程度\nある程度の関連情報を発見';
    }
    if (confidence >= 40 || sourceCount >= 1) {
      return '🟠 低品質\n部分的な関連情報のみ';
    }
    return '🔴 不十分\n関連情報が見つからず';
  }

  /**
   * 検索クエリをログに記録
   */
  private async logSearchQuery(
    query: string,
    ragResponse: any,
    userId: string,
    guildId: string | null
  ): Promise<void> {
    try {
      // 将来的にrag_queriesテーブルに記録する
      console.log('Search query logged:', {
        query,
        userId,
        guildId,
        confidence: ragResponse.confidence,
        sourceCount: ragResponse.sources.length,
        processingTime: ragResponse.processingTime,
      });
    } catch (error) {
      console.warn('Failed to log search query:', error);
    }
  }

  /**
   * ドキュメント統計を取得
   */
  async getDocumentStats(): Promise<{ total: number; bySource: Record<string, number> }> {
    try {
      const total = await this.vectorStore.getDocumentCount();
      return {
        total,
        bySource: {}, // 将来的に実装
      };
    } catch (error) {
      console.error('Failed to get document stats:', error);
      return { total: 0, bySource: {} };
    }
  }
}