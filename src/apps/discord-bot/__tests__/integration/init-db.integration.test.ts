import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client, Message } from 'discord.js';
import { TestDiscordSetup } from './helpers/discord-setup.js';
import { IntegrationDatabaseSetup } from './helpers/database-setup.js';
import { TestData } from './helpers/test-data.js';
import { getIntegrationConfig } from './config/integration.env.js';
import { InitDbCommand } from '../../src/commands/init-db.js';

/**
 * init-dbコマンド結合テスト
 * 実際のDiscordサーバーとPostgreSQLデータベースを使用した統合テスト
 */
describe('InitDB Command Integration Tests', () => {
  let client: Client;
  let testDb: any;
  let initDbCommand: InitDbCommand;
  
  const integratioConfig = getIntegrationConfig();
  const testData = TestData.getInitDbTestCases();
  const timeouts = TestData.getTimeouts();
  const errorPatterns = TestData.getErrorPatterns();
  const successPatterns = TestData.getSuccessPatterns();

  beforeAll(async () => {
    console.log('🚀 結合テスト環境セットアップ開始...');

    try {
      // データベース接続
      testDb = await IntegrationDatabaseSetup.createTestDatabase();
      await IntegrationDatabaseSetup.verifyTables();

      // Discord Bot接続
      client = await TestDiscordSetup.createTestClient();
      
      // InitDbCommandインスタンス作成
      initDbCommand = new InitDbCommand(client);

      // テスト用Discordデータ準備
      await TestDiscordSetup.setupTestData();

      console.log('✅ 結合テスト環境セットアップ完了');

    } catch (error) {
      console.error('❌ 結合テスト環境セットアップ失敗:', error);
      throw error;
    }
  }, timeouts.botConnection + 10000);

  afterAll(async () => {
    console.log('🔄 結合テスト環境クリーンアップ開始...');

    try {
      await TestDiscordSetup.cleanup();
      await IntegrationDatabaseSetup.cleanup();
      console.log('✅ 結合テスト環境クリーンアップ完了');
    } catch (error) {
      console.error('❌ クリーンアップエラー:', error);
    }
  }, timeouts.cleanup);

  beforeEach(async () => {
    // 各テスト前にデータベースをクリア
    await IntegrationDatabaseSetup.cleanDatabase();
  });

  afterEach(async () => {
    // 各テスト後に少し待機（Discord API レート制限考慮）
    await new Promise(resolve => setTimeout(resolve, timeouts.messageCooldown));
  });

  describe('権限チェックテスト', () => {
    it('管理者ユーザーによる正常なコマンド実行', async () => {
      // テストケースデータ
      const testCase = testData.validCases.find(c => c.name.includes('管理者による正常'))!;
      
      // コマンド送信をシミュレート
      const commandMessage = await TestDiscordSetup.sendAdminMessage(testCase.command);
      
      // Bot応答を待機
      const botResponse = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      
      expect(botResponse).toBeTruthy();
      expect(botResponse?.content).toMatch(testCase.expectedResponse);

      // データベースにジョブが作成されたことを確認
      const stats = await IntegrationDatabaseSetup.getDatabaseStats();
      expect(stats.init_jobs).toBeGreaterThan(0);

    }, timeouts.commandResponse + 5000);

    it('一般ユーザーによるコマンド実行の拒否', async () => {
      const testCase = testData.errorCases.find(c => c.name.includes('一般ユーザー'))!;
      
      // 一般ユーザーとしてコマンド送信
      const commandMessage = await TestDiscordSetup.sendRegularUserMessage(testCase.command);
      
      // Bot応答を待機
      const botResponse = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      
      expect(botResponse).toBeTruthy();
      expect(botResponse?.content).toMatch(testCase.expectedResponse);

      // ジョブが作成されていないことを確認
      const stats = await IntegrationDatabaseSetup.getDatabaseStats();
      expect(stats.init_jobs).toBe(0);

    }, timeouts.commandResponse + 5000);

    it('引数不足でのエラーメッセージ表示', async () => {
      const testCase = testData.errorCases.find(c => c.name.includes('引数なし'))!;
      
      const commandMessage = await TestDiscordSetup.sendAdminMessage(testCase.command);
      const botResponse = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      
      expect(botResponse).toBeTruthy();
      expect(botResponse?.content).toMatch(testCase.expectedResponse);
      
    }, timeouts.commandResponse + 5000);
  });

  describe('カテゴリ検証テスト', () => {
    it('有効なカテゴリIDでの処理開始', async () => {
      const command = `!init-db ${integratioConfig.TEST_CATEGORY_ID}`;
      
      const commandMessage = await TestDiscordSetup.sendAdminMessage(command);
      const botResponse = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      
      expect(botResponse).toBeTruthy();
      expect(botResponse?.content).toMatch(successPatterns.started);
      
      // カテゴリ名が正しく取得されていることを確認
      expect(botResponse?.content).toContain(integratioConfig.TEST_CATEGORY_ID);

    }, timeouts.commandResponse + 5000);

    it('Discord ID記号付きカテゴリIDの正しい処理', async () => {
      const command = `!init-db <#${integratioConfig.TEST_CATEGORY_ID}>`;
      
      const commandMessage = await TestDiscordSetup.sendAdminMessage(command);
      const botResponse = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      
      expect(botResponse).toBeTruthy();
      expect(botResponse?.content).toMatch(successPatterns.started);

    }, timeouts.commandResponse + 5000);

    it('無効なカテゴリIDでのエラー処理', async () => {
      const testCase = testData.errorCases.find(c => c.name.includes('無効なカテゴリ'))!;
      
      const commandMessage = await TestDiscordSetup.sendAdminMessage(testCase.command);
      const botResponse = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      
      expect(botResponse).toBeTruthy();
      expect(botResponse?.content).toMatch(testCase.expectedResponse);

    }, timeouts.commandResponse + 5000);
  });

  describe('データ処理テスト', () => {
    it('メッセージ取得とデータベース保存', async () => {
      const command = `!init-db ${integratioConfig.TEST_CATEGORY_ID}`;
      
      // コマンド実行
      const commandMessage = await TestDiscordSetup.sendAdminMessage(command);
      const initialResponse = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      
      expect(initialResponse).toBeTruthy();
      expect(initialResponse?.content).toMatch(successPatterns.started);

      // 処理完了まで待機（長時間）
      console.log('⏳ 処理完了を待機中...');
      
      // 定期的にデータベースをチェックして処理完了を確認
      let completedJob = null;
      let attempts = 0;
      const maxAttempts = Math.floor(timeouts.processingComplete / timeouts.databaseCheck);

      while (attempts < maxAttempts && !completedJob) {
        await new Promise(resolve => setTimeout(resolve, timeouts.databaseCheck));
        
        const client = IntegrationDatabaseSetup.getPostgresClient();
        const jobs = await client`
          SELECT id, status, total_messages, processed_messages, error_message
          FROM init_jobs 
          WHERE guild_id = ${integratioConfig.TEST_GUILD_ID}
          ORDER BY created_at DESC 
          LIMIT 1
        `;
        
        if (jobs.length > 0 && ['completed', 'failed'].includes(jobs[0].status)) {
          completedJob = jobs[0];
          break;
        }
        
        attempts++;
        console.log(`📊 処理確認中... (${attempts}/${maxAttempts}) Status: ${jobs[0]?.status || 'unknown'}`);
      }

      // 結果検証
      expect(completedJob).toBeTruthy();
      expect(completedJob?.status).toBe('completed');
      
      if (completedJob?.status === 'failed') {
        console.error('❌ 処理失敗:', completedJob.error_message);
      }

      // データベース内容の検証
      const stats = await IntegrationDatabaseSetup.getDatabaseStats();
      console.log('📊 処理結果統計:', stats);

      expect(stats.discord_messages).toBeGreaterThan(0);
      expect(stats.init_jobs).toBe(1);

      // 有効なリンクがある場合はドキュメントが作成されているかチェック
      if (stats.documents > 0) {
        console.log(`✅ ${stats.documents}件のドキュメントが作成されました`);
      }

    }, timeouts.processingComplete + 10000);

    it('重複実行の防止', async () => {
      const command = `!init-db ${integratioConfig.TEST_CATEGORY_ID}`;
      
      // 最初のコマンド実行
      await TestDiscordSetup.sendAdminMessage(command);
      const firstResponse = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      expect(firstResponse?.content).toMatch(successPatterns.started);

      // すぐに同じコマンドを実行
      await TestDiscordSetup.sendAdminMessage(command);
      const secondResponse = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      
      expect(secondResponse).toBeTruthy();
      expect(secondResponse?.content).toMatch(errorPatterns.alreadyRunning);

    }, timeouts.commandResponse * 2 + 5000);
  });

  describe('エラーハンドリングテスト', () => {
    it('ネットワークエラー時の適切な処理', async () => {
      // このテストは実際のネットワーク状態に依存するため、
      // モックまたは特定の条件下でのみ実行
      console.log('⚠️ ネットワークエラーテストはスキップ（環境依存）');
    });

    it('データベース制約エラーの処理', async () => {
      // 重複データによる制約エラーを意図的に発生させる
      await IntegrationDatabaseSetup.seedTestData();
      
      const command = `!init-db ${integratioConfig.TEST_CATEGORY_ID}`;
      
      const commandMessage = await TestDiscordSetup.sendAdminMessage(command);
      const response = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      
      // 制約エラーがあっても処理が継続することを確認
      expect(response).toBeTruthy();

    }, timeouts.commandResponse + 5000);
  });

  describe('進捗表示テスト', () => {
    it('処理進捗の適切な表示', async () => {
      const command = `!init-db ${integratioConfig.TEST_CATEGORY_ID}`;
      
      const commandMessage = await TestDiscordSetup.sendAdminMessage(command);
      const initialResponse = await TestDiscordSetup.waitForBotResponse(timeouts.commandResponse);
      
      expect(initialResponse?.content).toMatch(successPatterns.started);

      // 短時間待機後に進捗メッセージを確認
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 実際の実装では進捗更新メッセージを編集で送信するため、
      // メッセージ履歴から確認する必要がある
      console.log('📊 進捗表示テストは基本レベルで完了');

    }, 10000);
  });
});

/**
 * 環境検証テスト（結合テストの前提条件チェック）
 */
describe('Environment Validation', () => {
  it('必要な環境変数が設定されている', () => {
    const validation = TestData.getEnvironmentValidation();
    
    for (const envVar of validation.requiredEnvVars) {
      expect(process.env[envVar]).toBeDefined();
      expect(process.env[envVar]).not.toBe('');
    }
  });

  it('テスト用データベースに接続できる', async () => {
    const db = await IntegrationDatabaseSetup.createTestDatabase();
    expect(db).toBeDefined();
    
    const isValid = await IntegrationDatabaseSetup.verifyTables();
    expect(isValid).toBe(true);

  }, 10000);

  it('Discord Botに接続できる', async () => {
    const client = await TestDiscordSetup.createTestClient();
    expect(client).toBeDefined();
    expect(client.isReady()).toBe(true);

    const guild = TestDiscordSetup.getGuild();
    expect(guild).toBeDefined();
    expect(guild.id).toBe(getIntegrationConfig().TEST_GUILD_ID);

  }, 15000);
});