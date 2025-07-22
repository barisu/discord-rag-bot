import { getIntegrationConfig, TEST_URLS, TEST_MESSAGES } from '../config/integration.env.js';

/**
 * テストデータ管理クラス
 */
export class TestData {
  private static config = getIntegrationConfig();

  /**
   * init-dbコマンドの期待される結果データ
   */
  static getExpectedResults() {
    return {
      // 予想されるメッセージ数（テストカテゴリに依存）
      minMessageCount: 3, // 最低限のテストメッセージ数
      maxMessageCount: 100, // 実用的な上限
      
      // 予想されるリンク数
      expectedLinks: [
        TEST_URLS.VALID_LINK,
        TEST_URLS.INVALID_LINK,
      ],
      
      // 期待される処理時間（ミリ秒）
      maxProcessingTime: 60000, // 1分以内
      
      // 期待されるドキュメント数（有効リンクのみ）
      minDocumentCount: 1, // 少なくとも1つの有効ドキュメント
    };
  }

  /**
   * テスト用Discord メッセージデータ
   */
  static getTestMessages() {
    return [
      {
        content: TEST_MESSAGES.WITH_LINKS,
        expectedLinks: 1,
        hasValidContent: true,
      },
      {
        content: TEST_MESSAGES.WITH_MULTIPLE_LINKS,
        expectedLinks: 2,
        hasValidContent: true,
      },
      {
        content: 'リンクのない通常のテストメッセージです',
        expectedLinks: 0,
        hasValidContent: false,
      },
    ];
  }

  /**
   * init-dbコマンドのテストケース
   */
  static getInitDbTestCases() {
    return {
      validCases: [
        {
          name: '管理者による正常なinit-db実行',
          command: `${TEST_MESSAGES.INIT_DB_COMMAND} ${this.config.TEST_CATEGORY_ID}`,
          userId: this.config.TEST_ADMIN_USER_ID,
          shouldSucceed: true,
          expectedResponse: /🔄.*データベース初期化を開始します/,
        },
        {
          name: 'Discord ID記号付きカテゴリIDでの実行',
          command: `${TEST_MESSAGES.INIT_DB_COMMAND} <#${this.config.TEST_CATEGORY_ID}>`,
          userId: this.config.TEST_ADMIN_USER_ID,
          shouldSucceed: true,
          expectedResponse: /🔄.*データベース初期化を開始します/,
        },
      ],
      
      errorCases: [
        {
          name: '一般ユーザーによる実行（権限エラー）',
          command: `${TEST_MESSAGES.INIT_DB_COMMAND} ${this.config.TEST_CATEGORY_ID}`,
          userId: this.config.TEST_REGULAR_USER_ID,
          shouldSucceed: false,
          expectedResponse: /❌.*管理者のみが実行できます/,
        },
        {
          name: '引数なしでの実行',
          command: TEST_MESSAGES.INIT_DB_COMMAND,
          userId: this.config.TEST_ADMIN_USER_ID,
          shouldSucceed: false,
          expectedResponse: /❌.*カテゴリIDを指定してください/,
        },
        {
          name: '無効なカテゴリIDでの実行',
          command: `${TEST_MESSAGES.INIT_DB_COMMAND} invalid-category-id`,
          userId: this.config.TEST_ADMIN_USER_ID,
          shouldSucceed: false,
          expectedResponse: /❌.*カテゴリが見つからないか、アクセスできません/,
        },
      ],
    };
  }

  /**
   * データベース検証用クエリ
   */
  static getDatabaseValidationQueries() {
    return {
      // メッセージ保存の確認
      discordMessages: `
        SELECT COUNT(*) as count, 
               MIN(created_at) as oldest_message,
               MAX(created_at) as newest_message
        FROM discord_messages 
        WHERE guild_id = $1
      `,
      
      // ドキュメント作成の確認
      documentsCreated: `
        SELECT COUNT(*) as count,
               COUNT(CASE WHEN metadata->>'title' IS NOT NULL THEN 1 END) as with_title,
               COUNT(CASE WHEN metadata->>'domain' IS NOT NULL THEN 1 END) as with_domain
        FROM documents 
        WHERE metadata->>'messageId' IS NOT NULL
      `,
      
      // ジョブ状態の確認
      jobStatus: `
        SELECT id, status, total_channels, processed_channels,
               total_messages, processed_messages, 
               created_at, completed_at, error_message
        FROM init_jobs 
        WHERE guild_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `,
      
      // リンク処理結果の確認
      linkProcessingResults: `
        SELECT d.source, d.metadata->>'title' as title, 
               d.metadata->>'statusCode' as status_code
        FROM documents d
        WHERE d.metadata->>'messageId' IS NOT NULL
        ORDER BY d.created_at DESC
      `,
    };
  }

  /**
   * テスト結果の期待値
   */
  static getExpectedDatabaseResults() {
    return {
      // init_jobs テーブル
      jobCompletionStates: ['completed', 'failed'],
      requiredJobFields: [
        'guild_id',
        'category_id', 
        'category_name',
        'initiated_by',
        'status',
        'created_at'
      ],
      
      // discord_messages テーブル
      requiredMessageFields: [
        'message_id',
        'channel_id',
        'guild_id', 
        'author_id',
        'content',
        'created_at'
      ],
      
      // documents テーブル
      requiredDocumentFields: [
        'title',
        'content',
        'source',
        'metadata',
        'created_at'
      ],
      
      // メタデータの期待される構造
      expectedMetadataFields: [
        'title',
        'description',
        'domain',
        'messageId',
        'channelId',
        'authorId',
        'processedAt'
      ],
    };
  }

  /**
   * テスト実行時の待機時間設定
   */
  static getTimeouts() {
    return {
      // Discord Bot接続タイムアウト
      botConnection: 15000, // 15秒
      
      // コマンド応答待機時間
      commandResponse: 5000, // 5秒
      
      // 処理完了待機時間（init-dbの完全実行）
      processingComplete: this.config.TEST_TIMEOUT, // 設定値に依存
      
      // データベース確認の待機時間
      databaseCheck: 2000, // 2秒
      
      // メッセージ間の待機時間（レート制限回避）
      messageCooldown: 1000, // 1秒
      
      // クリーンアップ待機時間
      cleanup: 3000, // 3秒
    };
  }

  /**
   * エラーメッセージのパターン
   */
  static getErrorPatterns() {
    return {
      permissions: /❌.*管理者のみ/,
      dmOnly: /❌.*サーバー内でのみ/,
      missingArgs: /❌.*カテゴリIDを指定/,
      invalidCategory: /❌.*カテゴリが見つからない/,
      categoryName: /❌.*カテゴリ名を取得できません/,
      alreadyRunning: /❌.*既に初期化処理が実行中/,
      generalError: /❌.*エラーが発生しました/,
    };
  }

  /**
   * 成功レスポンスのパターン
   */
  static getSuccessPatterns() {
    return {
      started: /🔄.*データベース初期化を開始します/,
      processing: /🔄.*初期化処理中/,
      linkProcessing: /🔍.*リンク処理中/,
      completed: /✅.*初期化処理が完了しました/,
    };
  }

  /**
   * テスト用のリンク検証データ
   */
  static getLinkTestData() {
    return {
      validLinks: [
        {
          url: TEST_URLS.VALID_LINK,
          expectedTitle: /.+/, // なんらかのタイトルがある
          expectedContent: /.+/, // なんらかのコンテンツがある
          shouldProcess: true,
        },
      ],
      
      invalidLinks: [
        {
          url: TEST_URLS.INVALID_LINK,
          expectedTitle: null,
          expectedContent: null,
          shouldProcess: false,
        },
      ],
      
      slowLinks: [
        {
          url: TEST_URLS.SLOW_LINK,
          expectedTimeout: true,
          shouldSkip: true,
        },
      ],
    };
  }

  /**
   * テスト環境の検証データ
   */
  static getEnvironmentValidation() {
    return {
      requiredEnvVars: [
        'INTEGRATION_DISCORD_TOKEN',
        'TEST_GUILD_ID',
        'TEST_CATEGORY_ID',
        'TEST_ADMIN_USER_ID',
        'TEST_REGULAR_USER_ID',
      ],
      
      databaseRequirements: {
        tables: [
          'discord_messages',
          'documents',
          'init_jobs',
          'embeddings',
          'rag_queries'
        ],
        extensions: ['vector'],
      },
      
      discordRequirements: {
        botPermissions: [
          'ViewChannel',
          'ReadMessageHistory', 
          'SendMessages',
        ],
        guildFeatures: [],
      },
    };
  }
}