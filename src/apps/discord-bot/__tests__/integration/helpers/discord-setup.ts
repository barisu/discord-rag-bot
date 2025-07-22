import { Client, GatewayIntentBits, Events, Guild, CategoryChannel, TextChannel, Message, User } from 'discord.js';
import { getIntegrationConfig, TEST_MESSAGES } from '../config/integration.env.js';
import { createDatabaseConnection } from '@shared/database';

/**
 * 結合テスト用Discord Bot セットアップクラス
 */
export class TestDiscordSetup {
  private static client: Client | null = null;
  private static config = getIntegrationConfig();
  private static guild: Guild | undefined = undefined;
  private static category: CategoryChannel | null = null;
  private static testChannel: TextChannel | null = null;

  /**
   * テスト用Discord Clientを作成・接続
   */
  static async createTestClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    console.log('🤖 結合テスト用Discord Bot接続開始...');

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    // データベース接続を初期化（Botで必要）
    createDatabaseConnection(this.config.DATABASE_URL);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Discord Bot接続タイムアウト'));
      }, 15000);

      this.client!.once(Events.ClientReady, async (readyClient) => {
        clearTimeout(timeout);
        console.log(`✅ Discord Bot接続成功: ${readyClient.user.tag}`);

        try {
          // テスト用ギルドとカテゴリの取得
          await this.setupTestGuild();
          
          // テスト用メッセージハンドラーを設定（Botメッセージも処理）
          await this.setupTestMessageHandler();
          
          resolve(readyClient);
        } catch (error) {
          reject(error);
        }
      });

      this.client!.once(Events.Error, (error) => {
        clearTimeout(timeout);
        console.error('❌ Discord接続エラー:', error);
        reject(error);
      });

      this.client!.login(this.config.DISCORD_TOKEN).catch(reject);
    });
  }

  /**
   * テスト用メッセージハンドラーを設定
   * 通常のBotと異なり、Botメッセージにも応答してテストを実行
   */
  private static async setupTestMessageHandler() {
    if (!this.client) return;

    // InitDbCommandインスタンスを動的にインポート
    const { InitDbCommand } = await import('../../../src/commands/init-db.js');
    const initDbCommand = new InitDbCommand(this.client);

    this.client.on(Events.MessageCreate, async (message) => {
      // テスト用チャンネル以外は無視
      if (message.channel.id !== this.testChannel?.id) return;
      
      // Bot自身のメッセージの場合は、初回のみ処理（無限ループ回避）
      if (message.author.bot && message.author.id === this.client!.user!.id) {
        // テスト用のコマンドメッセージのみ処理
        if (message.content.startsWith('!init-db') || message.content.startsWith('!ping')) {
          console.log(`🔄 テストBot自身のコマンドを処理: ${message.content}`);
        } else {
          return; // 通常のBot応答メッセージは無視
        }
      }
      
      // ping テスト
      if (message.content.startsWith('!ping')) {
        await message.reply('Pong! テスト用Discord RAG Bot準備完了.');
        return;
      }
      
      // init-db コマンド処理
      if (message.content.startsWith('!init-db')) {
        const args = message.content.slice(8).trim().split(/\s+/);
        await initDbCommand.execute(message, args);
        return;
      }
    });

    console.log('✅ テスト用メッセージハンドラー設定完了');
  }

  /**
   * テスト用ギルド・カテゴリ・チャンネルのセットアップ
   */
  private static async setupTestGuild() {
    if (!this.client) {
      throw new Error('Discord Clientが初期化されていません');
    }

    console.log('🔍 テスト用ギルド・カテゴリの確認中...');

    // ギルドの取得
    this.guild = this.client.guilds.cache.get(this.config.TEST_GUILD_ID);
    if (!this.guild) {
      throw new Error(
        `テスト用ギルド(ID: ${this.config.TEST_GUILD_ID})が見つかりません。\n` +
        'Discord Botがテスト用サーバーに参加していることを確認してください。'
      );
    }

    // カテゴリの取得
    const channel = this.guild.channels.cache.get(this.config.TEST_CATEGORY_ID);
    if (!channel || channel.type !== 4) { // 4 = CategoryChannel
      throw new Error(
        `テスト用カテゴリ(ID: ${this.config.TEST_CATEGORY_ID})が見つからないか、カテゴリではありません。`
      );
    }

    this.category = channel as CategoryChannel;

    // カテゴリ内のテキストチャンネルを取得（最初の1つ）
    const textChannels = this.category.children.cache.filter(ch => ch.type === 0); // 0 = TextChannel
    if (textChannels.size === 0) {
      throw new Error(`テストカテゴリ内にテキストチャンネルが見つかりません`);
    }

    this.testChannel = textChannels.first() as TextChannel;

    console.log(`✅ テスト環境確認完了:`);
    console.log(`   ギルド: ${this.guild.name} (${this.guild.id})`);
    console.log(`   カテゴリ: ${this.category.name} (${this.category.id})`);
    console.log(`   テストチャンネル: ${this.testChannel.name} (${this.testChannel.id})`);
  }

  /**
   * テスト用メッセージを送信（管理者権限ユーザーとして）
   */
  static async sendAdminMessage(content: string): Promise<Message> {
    if (!this.testChannel) {
      throw new Error('テストチャンネルが初期化されていません');
    }

    console.log(`📝 管理者としてメッセージ送信: "${content}"`);

    try {
      // 実際はBotアカウントから送信されますが、テストでは管理者ユーザーを模擬
      const message = await this.testChannel.send(content);
      
      // 少し待機（Discord APIの処理時間を考慮）
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return message;
    } catch (error) {
      console.error('❌ メッセージ送信エラー:', error);
      throw error;
    }
  }

  /**
   * テスト用メッセージを送信（一般ユーザーとして）
   * 注意: 実際のBot統合テストでは、テストユーザーアカウントが必要
   */
  static async sendRegularUserMessage(content: string): Promise<Message> {
    if (!this.testChannel) {
      throw new Error('テストチャンネルが初期化されていません');
    }

    console.log(`📝 一般ユーザーとしてメッセージ送信: "${content}"`);

    // 注意: 実際の結合テストでは、別のユーザーアカウントからのメッセージ送信が必要
    // ここでは簡易的にBotアカウントから送信
    const message = await this.testChannel.send(content);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return message;
  }

  /**
   * テストカテゴリ内のすべてのメッセージをクリーンアップ
   */
  static async cleanupTestMessages(): Promise<void> {
    if (!this.category) {
      throw new Error('テストカテゴリが初期化されていません');
    }

    console.log('🧹 テストメッセージクリーンアップ開始...');

    try {
      const textChannels = this.category.children.cache.filter(ch => ch.type === 0);
      let totalDeleted = 0;

      for (const [_, channel] of textChannels) {
        const textChannel = channel as TextChannel;
        
        // 最新100件のメッセージを取得してBotメッセージを削除
        const messages = await textChannel.messages.fetch({ limit: 100 });
        const botMessages = messages.filter(msg => msg.author.id === this.client!.user!.id);
        
        for (const [_, message] of botMessages) {
          try {
            await message.delete();
            totalDeleted++;
            // レート制限回避のため短い待機
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            // メッセージが既に削除されている等のエラーは無視
            console.warn(`メッセージ削除スキップ: ${error}`);
          }
        }
      }

      console.log(`✅ テストメッセージクリーンアップ完了 (${totalDeleted}件削除)`);

    } catch (error) {
      console.error('❌ テストメッセージクリーンアップエラー:', error);
      // クリーンアップエラーは致命的ではないので続行
    }
  }

  /**
   * Bot応答を待機して取得
   */
  static async waitForBotResponse(timeoutMs: number = 60000): Promise<Message | null> {
    if (!this.client || !this.testChannel) {
      throw new Error('Discord環境が初期化されていません');
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.client!.off(Events.MessageCreate, messageHandler);
        resolve(null);
      }, timeoutMs);

      const messageHandler = (message: Message) => {
        // テストチャンネルからのBotメッセージをチェック
        if (
          message.channel.id === this.testChannel!.id &&
          message.author.id === this.client!.user!.id
        ) {
          clearTimeout(timeout);
          this.client!.off(Events.MessageCreate, messageHandler);
          resolve(message);
        }
      };

      if (this.client === null)
        throw new Error("Clientがnullです。");
      this.client.on(Events.MessageCreate, messageHandler);
    });
  }

  /**
   * テスト用データを準備
   * カテゴリ内にテスト用メッセージとリンクを投稿
   */
  static async setupTestData(): Promise<void> {
    if (!this.testChannel) {
      throw new Error('テストチャンネルが初期化されていません');
    }

    console.log('🌱 テスト用Discordデータ準備開始...');

    try {
      // リンク付きメッセージを投稿
      await this.testChannel.send(TEST_MESSAGES.WITH_LINKS);
      await new Promise(resolve => setTimeout(resolve, 1000));

      await this.testChannel.send(TEST_MESSAGES.WITH_MULTIPLE_LINKS);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 通常のメッセージも投稿
      await this.testChannel.send('テスト用の通常メッセージです（リンクなし）');
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('✅ テスト用Discordデータ準備完了');

    } catch (error) {
      console.error('❌ テストデータ準備エラー:', error);
      throw error;
    }
  }

  /**
   * ユーザー権限をチェック
   */
  static async checkUserPermissions(userId: string): Promise<boolean> {
    if (!this.guild) {
      throw new Error('テストギルドが初期化されていません');
    }

    try {
      const member = await this.guild.members.fetch(userId);
      return member.permissions.has('Administrator');
    } catch (error) {
      console.warn(`ユーザー権限チェックエラー (${userId}):`, error);
      return false;
    }
  }

  /**
   * Discord Clientを取得
   */
  static getClient(): Client {
    if (!this.client) {
      throw new Error('Discord Clientが初期化されていません。createTestClient()を先に呼び出してください。');
    }
    return this.client;
  }

  /**
   * テストギルドを取得
   */
  static getGuild(): Guild {
    if (!this.guild) {
      throw new Error('テストギルドが初期化されていません');
    }
    return this.guild;
  }

  /**
   * テストカテゴリを取得
   */
  static getCategory(): CategoryChannel {
    if (!this.category) {
      throw new Error('テストカテゴリが初期化されていません');
    }
    return this.category;
  }

  /**
   * Discord接続をクリーンアップ
   */
  static async cleanup(): Promise<void> {
    console.log('🔄 Discord接続クリーンアップ開始...');

    try {
      if (this.client) {
        await this.cleanupTestMessages();
        await this.client.destroy();
        this.client = null;
        this.guild = undefined;
        this.category = null;
        this.testChannel = null;
        console.log('✅ Discord接続クリーンアップ完了');
      }
    } catch (error) {
      console.error('❌ Discordクリーンアップエラー:', error);
      throw error;
    }
  }
}
