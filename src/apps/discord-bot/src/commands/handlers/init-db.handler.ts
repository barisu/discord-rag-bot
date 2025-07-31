import { Message, PermissionFlagsBits } from 'discord.js';
import type {
  MessageFetcher,
  LinkProcessor,
  KeywordExtractor,
  Logger,
  Config
} from '@shared/core';
import {
  PermissionError,
  ValidationError,
  ProgressTracker,
  ProgressBuilder,
  ErrorHandler,
  createContextLogger
} from '@shared/core';
import {
  MessageProcessingService,
  ContentExtractionService,
  ChunkingService,
  EmbeddingService,
  KeywordExtractionService,
  JobManagementService,
  type JobInfo
} from '../../services';

/**
 * InitDbCommand の新しいハンドラー実装
 * 責務を明確に分離し、各サービスにデリゲート
 */
export class InitDbCommandHandler {
  private readonly logger: Logger;
  private readonly messageProcessingService: MessageProcessingService;
  private readonly contentExtractionService: ContentExtractionService;
  private readonly chunkingService: ChunkingService;
  private readonly embeddingService: EmbeddingService;
  private readonly keywordExtractionService: KeywordExtractionService;
  private readonly jobManagementService: JobManagementService;

  constructor(
    messageFetcher: MessageFetcher,
    linkProcessor: LinkProcessor,
    embeddings: any,
    chunker: any,
    keywordExtractor: KeywordExtractor,
    vectorStore: any,
    config: Config,
    baseLogger: Logger
  ) {
    this.logger = createContextLogger(baseLogger, 'InitDbCommandHandler');
    
    // サービス層を初期化
    this.messageProcessingService = new MessageProcessingService(messageFetcher, this.logger);
    this.contentExtractionService = new ContentExtractionService(linkProcessor, this.logger);
    this.chunkingService = new ChunkingService(chunker, config, this.logger);
    this.embeddingService = new EmbeddingService(embeddings, this.logger);
    this.keywordExtractionService = new KeywordExtractionService(
      keywordExtractor,
      embeddings,
      vectorStore,
      this.logger
    );
    this.jobManagementService = new JobManagementService(this.logger);
  }

  /**
   * コマンド実行のメインエントリーポイント
   */
  async execute(message: Message, args: string[]): Promise<void> {
    try {
      // バリデーション
      this.validateCommand(message, args);
      const categoryId = this.extractCategoryId(args[0]);

      // カテゴリの検証
      await this.validateCategory(message, categoryId);

      // ジョブを作成して処理開始
      await this.startInitializationJob(message, categoryId);

    } catch (error) {
      this.logger.error('InitDB command execution failed', error instanceof Error ? error : undefined, {
        messageId: message.id,
        guildId: message.guildId,
        args,
      });

      const userMessage = ErrorHandler.getUserMessage(error);
      await message.reply(`❌ ${userMessage}`);
    }
  }

  /**
   * コマンドのバリデーション
   */
  private validateCommand(message: Message, args: string[]): void {
    // 権限チェック
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      throw new PermissionError('このコマンドは管理者のみが実行できます。');
    }

    // ギルド内での実行チェック
    if (!message.guildId) {
      throw new ValidationError('このコマンドはサーバー内でのみ実行できます。');
    }

    // 引数チェック
    if (args.length === 0) {
      throw new ValidationError(
        'カテゴリIDを指定してください。\n使用方法: `!init-db <カテゴリID>`'
      );
    }
  }

  /**
   * カテゴリIDの抽出とクリーニング
   */
  private extractCategoryId(rawId: string): string {
    return rawId.replace(/[<>#]/g, ''); // Discord IDの記号を除去
  }

  /**
   * カテゴリの検証
   */
  private async validateCategory(message: Message, categoryId: string): Promise<string> {
    const isValid = await this.messageProcessingService.messageFetcher.validateCategoryAccess(
      categoryId,
      message.guildId!
    );

    if (!isValid) {
      throw new ValidationError('指定されたカテゴリが見つからないか、アクセスできません。');
    }

    const categoryName = await this.messageProcessingService.messageFetcher.getCategoryName(categoryId);
    if (!categoryName) {
      throw new ValidationError('カテゴリ名を取得できませんでした。');
    }

    return categoryName;
  }

  /**
   * 初期化ジョブの開始
   */
  private async startInitializationJob(message: Message, categoryId: string): Promise<void> {
    const categoryName = await this.messageProcessingService.messageFetcher.getCategoryName(categoryId);
    if (!categoryName) {
      throw new ValidationError('カテゴリ名を取得できませんでした。');
    }

    // ジョブを作成
    const job = await this.jobManagementService.createJob(
      message.guildId!,
      categoryId,
      categoryName,
      message.author.id
    );

    // 確認メッセージを送信
    const confirmMessage = await message.reply(
      `🔄 **データベース初期化を開始します**\n` +
      `📂 カテゴリ: **${categoryName}**\n` +
      `📊 ジョブID: \`${job.id}\`\n\n` +
      `⚠️ この処理には時間がかかる場合があります。\n` +
      `進捗は随時お知らせします...`
    );

    // バックグラウンドで処理を開始
    this.processInitializationAsync(job, message, confirmMessage);
  }

  /**
   * 非同期で初期化処理を実行
   */
  private async processInitializationAsync(
    job: JobInfo,
    originalMessage: Message,
    statusMessage: Message
  ): Promise<void> {
    try {
      // ジョブを開始状態に更新
      await this.jobManagementService.startJob(job.id);

      // 進捗トラッカーを設定
      const progressTracker = new ProgressBuilder()
        .addPhase('メッセージ取得', 30)
        .addPhase('コンテンツ抽出', 25)
        .addPhase('チャンク化', 15)
        .addPhase('埋め込み生成', 15)
        .addPhase('キーワード抽出', 15)
        .build();

      // 各フェーズを実行
      const stats = await this.executeInitializationPhases(
        job,
        statusMessage,
        progressTracker
      );

      // ジョブを完了状態に更新
      await this.jobManagementService.completeJob(job.id, stats);

      // 最終メッセージを更新
      await this.sendCompletionMessage(statusMessage, stats);

    } catch (error) {
      this.logger.error('Initialization process failed', error instanceof Error ? error : undefined, {
        jobId: job.id,
        categoryId: job.categoryId,
      });

      // ジョブを失敗状態に更新
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.jobManagementService.failJob(job.id, errorMessage);

      // エラーメッセージを送信
      await statusMessage.edit(
        `❌ **初期化処理中にエラーが発生しました**\n\n` +
        `🔍 エラー内容: ${ErrorHandler.getUserMessage(error)}\n` +
        `🔧 管理者にお問い合わせください。`
      );
    }
  }

  /**
   * 初期化の各フェーズを実行
   */
  private async executeInitializationPhases(
    job: JobInfo,
    statusMessage: Message,
    progressTracker: ProgressTracker
  ): Promise<{
    linksFound: number;
    documentsCreated: number;
    keywordsExtracted: number;
  }> {
    // フェーズ1: メッセージ処理
    progressTracker.update({ currentStep: 'メッセージを取得しています...' });
    const { messages, totalLinks } = await this.messageProcessingService.processMessages(
      job.categoryId,
      statusMessage,
      progressTracker
    );

    await this.jobManagementService.updateJobProgress(job.id, {
      totalMessages: messages.length,
      linksFound: totalLinks,
    });

    // フェーズ2: コンテンツ抽出
    const messagesWithLinks = this.messageProcessingService.filterMessagesWithLinks(messages);
    const extractedContents = await this.contentExtractionService.extractAndSaveContent(
      messagesWithLinks,
      progressTracker
    );

    await this.jobManagementService.updateJobProgress(job.id, {
      documentsCreated: extractedContents.length,
    });

    // フェーズ3: チャンク化
    const chunks = await this.chunkingService.processChunks(extractedContents, progressTracker);

    // フェーズ4: 埋め込み生成
    const embeddingResults = await this.embeddingService.generateEmbeddings(chunks, progressTracker);

    // フェーズ5: キーワード抽出
    const keywordResults = await this.keywordExtractionService.extractKeywords(chunks, progressTracker);
    const totalKeywords = keywordResults.reduce((sum, r) => sum + r.keywords.length, 0);

    await this.jobManagementService.updateJobProgress(job.id, {
      keywordsExtracted: totalKeywords,
    });

    return {
      linksFound: totalLinks,
      documentsCreated: extractedContents.length,
      keywordsExtracted: totalKeywords,
    };
  }

  /**
   * 完了メッセージを送信
   */
  private async sendCompletionMessage(
    statusMessage: Message,
    stats: {
      linksFound: number;
      documentsCreated: number;
      keywordsExtracted: number;
    }
  ): Promise<void> {
    await statusMessage.edit(
      `✅ **初期化処理が完了しました！**\n\n` +
      `📊 **処理結果:**\n` +
      `🔗 発見したリンク: ${stats.linksFound}件\n` +
      `📄 作成したドキュメント: ${stats.documentsCreated}件\n` +
      `🔑 抽出したキーワード: ${stats.keywordsExtracted}件\n` +
      `🔮 埋め込みベクトル: ${stats.documentsCreated + stats.keywordsExtracted}件\n\n` +
      `🎉 RAG + キーワード検索機能が利用可能になりました！`
    );
  }
}