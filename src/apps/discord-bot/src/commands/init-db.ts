import { Message, PermissionFlagsBits, ChannelType } from 'discord.js';
import { MessageFetcher, MessageData } from '@shared/core';
import { LinkProcessor, ProcessedContent } from '@shared/core';
import { GeminiClient } from '@shared/core';
import { KeywordExtractor, BM25Calculator } from '@shared/core';
import { SemanticChunker } from '@rag/core';
import { OpenAIEmbeddings } from '@rag/core';
import { PostgresVectorStore } from '@rag/core';
import { getDatabaseConnection } from '@shared/core';
import { initJobs, sourceDocuments, documentChunks, discordMessages, embeddings, NewDbInitJob } from '@shared/core';
import { eq, and } from 'drizzle-orm';

export class InitDbCommand {
  private messageFetcher: MessageFetcher;
  private linkProcessor: LinkProcessor;
  private geminiClient: GeminiClient;
  private chunker: SemanticChunker;
  private embeddings: OpenAIEmbeddings;
  private keywordExtractor: KeywordExtractor;
  private bm25Calculator: BM25Calculator;
  private vectorStore: PostgresVectorStore;

  constructor(client: any) {
    this.messageFetcher = new MessageFetcher(client);
    this.linkProcessor = new LinkProcessor();
    
    // API key チェック
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required for chunking');
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for embeddings');
    }
    
    this.geminiClient = new GeminiClient(process.env.GEMINI_API_KEY);
    this.chunker = new SemanticChunker(this.geminiClient);
    this.embeddings = new OpenAIEmbeddings(process.env.OPENAI_API_KEY);
    this.bm25Calculator = new BM25Calculator();
    this.keywordExtractor = new KeywordExtractor(this.geminiClient, this.bm25Calculator);
    this.vectorStore = new PostgresVectorStore();
  }

  async execute(message: Message, args: string[]): Promise<void> {
    // 権限チェック
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply('❌ このコマンドは管理者のみが実行できます。');
      return;
    }

    if (!message.guildId) {
      await message.reply('❌ このコマンドはサーバー内でのみ実行できます。');
      return;
    }

    // 引数チェック
    if (args.length === 0) {
      await message.reply('❌ カテゴリIDを指定してください。\n使用方法: `!init-db <カテゴリID>`');
      return;
    }

    const categoryId = args[0].replace(/[<>#]/g, ''); // Discord IDの記号を除去

    try {
      // カテゴリの検証
      const isValidCategory = await this.messageFetcher.validateCategoryAccess(categoryId, message.guildId);
      if (!isValidCategory) {
        await message.reply('❌ 指定されたカテゴリが見つからないか、アクセスできません。');
        return;
      }

      const categoryName = await this.messageFetcher.getCategoryName(categoryId);
      if (!categoryName) {
        await message.reply('❌ カテゴリ名を取得できませんでした。');
        return;
      }

      // 既存の処理中ジョブをチェック
      const db = getDatabaseConnection();
      const existingJob = await db
        .select()
        .from(initJobs)
        .where(and(eq(initJobs.guildId, message.guildId), eq(initJobs.status, 'running')))
        .limit(1);

      if (existingJob.length > 0) {
        await message.reply('❌ 既に初期化処理が実行中です。完了まで待機してください。');
        return;
      }

      // 初期化ジョブを作成
      const [job] = await db
        .insert(initJobs)
        .values({
          guildId: message.guildId,
          categoryId,
          categoryName,
          initiatedBy: message.author.id,
          status: 'pending',
        })
        .returning();

      const confirmMessage = await message.reply(
        `🔄 **データベース初期化を開始します**\n` +
        `📂 カテゴリ: **${categoryName}**\n` +
        `📊 ジョブID: \`${job.id}\`\n\n` +
        `⚠️ この処理には時間がかかる場合があります。\n` +
        `進捗は随時お知らせします...`
      );

      // バックグラウンドで処理を開始
      this.processInitialization(job.id, categoryId, message, confirmMessage);

    } catch (error) {
      console.error('InitDB command error:', error);
      await message.reply('❌ 初期化処理の開始中にエラーが発生しました。');
    }
  }

  private async processInitialization(
    jobId: number,
    categoryId: string,
    originalMessage: Message,
    statusMessage: Message
  ): Promise<void> {
    const db = getDatabaseConnection();
    
    try {
      // ジョブステータスを実行中に更新
      await db
        .update(initJobs)
        .set({ 
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(initJobs.id, jobId));

      let totalLinks = 0;
      let totalDocuments = 0;
      let totalKeywords = 0;

      // メッセージ取得の進捗コールバック
      const onProgress = async (progress: any) => {
        await db
          .update(initJobs)
          .set({
            totalChannels: progress.totalChannels,
            processedChannels: progress.processedChannels,
            totalMessages: progress.totalMessages,
            processedMessages: progress.processedMessages,
          })
          .where(eq(initJobs.id, jobId));

        // 定期的に進捗を更新
        if (progress.processedChannels % 3 === 0 || progress.processedChannels === progress.totalChannels) {
          await statusMessage.edit(
            `🔄 **初期化処理中...**\n` +
            `📂 チャンネル進捗: ${progress.processedChannels}/${progress.totalChannels}\n` +
            `💬 メッセージ数: ${progress.totalMessages}\n` +
            `🔗 リンク発見数: ${totalLinks}\n` +
            `📄 ドキュメント作成数: ${totalDocuments}\n` +
            `🔑 キーワード抽出数: ${totalKeywords}`
          );
        }
      };

      // メッセージ履歴を取得
      const messages = await this.messageFetcher.fetchCategoryMessages(categoryId, onProgress);
      
      // リンクを含むメッセージを抽出
      const messagesWithLinks = messages.filter(msg => msg.links.length > 0);
      totalLinks = messagesWithLinks.reduce((sum, msg) => sum + msg.links.length, 0);

      await statusMessage.edit(
        `🔍 **リンク処理中...**\n` +
        `💬 総メッセージ数: ${messages.length}\n` +
        `🔗 リンク付きメッセージ: ${messagesWithLinks.length}\n` +
        `🔗 総リンク数: ${totalLinks}\n` +
        `⏳ コンテンツを取得しています...`
      );

      // メッセージをデータベースに保存
      for (const message of messages) {
        await db
          .insert(discordMessages)
          .values({
            messageId: message.id,
            channelId: message.channelId,
            guildId: message.guildId,
            authorId: message.authorId,
            content: message.content,
            createdAt: message.createdAt,
          })
          .onConflictDoNothing();
      }

      // BM25統計を取得
      const documentStats = await this.vectorStore.getKeywordStats();

      // リンクを処理してドキュメントを作成
      for (let i = 0; i < messagesWithLinks.length; i++) {
        const message = messagesWithLinks[i];
        
        try {
          const processedContents = await this.linkProcessor.processLinks(message.links);
          
          for (const content of processedContents) {
            // Step 1: 完全なドキュメントをsource_documentsに保存
            const [sourceDoc] = await db
              .insert(sourceDocuments)
              .values({
                url: content.originalUrl,
                title: content.title,
                fullContent: content.content,
                metadata: {
                  description: content.metadata.description,
                  domain: content.metadata.domain,
                  extractionMethod: content.metadata.extractionMethod,
                  contentLength: content.content.length,
                },
                messageId: message.id,
                channelId: message.channelId,
                authorId: message.authorId,
                processedAt: content.metadata.processedAt,
              })
              .returning();

            // Step 2: コンテンツをチャンク化
            const chunks = await this.chunker.chunk(content.content);
            
            for (const chunk of chunks) {
              // Step 3: チャンクをdocument_chunksに保存
              const [chunkDoc] = await db
                .insert(documentChunks)
                .values({
                  sourceDocumentId: sourceDoc.id,
                  content: chunk.content,
                  chunkIndex: chunk.index,
                  startPosition: null, // 将来的に実装可能
                  endPosition: null,   // 将来的に実装可能
                  metadata: {
                    chunkLength: chunk.content.length,
                    totalChunks: chunks.length,
                  },
                })
                .returning();
              
              // Step 4: チャンクの埋め込み生成・保存
              try {
                const embedding = await this.embeddings.embed(chunk.content);
                await db
                  .insert(embeddings)
                  .values({
                    chunkId: chunkDoc.id,
                    embedding,
                  });
              } catch (embeddingError) {
                console.error(`Error generating embedding for chunk ${chunkDoc.id}:`, embeddingError);
                // embedding生成に失敗してもチャンク保存は続行
              }

              // Step 5: キーワード抽出・保存
              try {
                const keywords = await this.keywordExtractor.extractKeywords(chunk.content, documentStats);
                
                if (keywords.length > 0) {
                  // キーワードのembeddingを生成
                  const keywordData = [];
                  for (const keyword of keywords) {
                    try {
                      const keywordEmbedding = await this.embeddings.embed(keyword.keyword);
                      keywordData.push({
                        keyword: keyword.keyword,
                        bm25Score: keyword.bm25Score,
                        termFrequency: keyword.termFrequency,
                        documentFrequency: keyword.documentFrequency,
                        embedding: keywordEmbedding,
                      });
                    } catch (keywordEmbeddingError) {
                      console.error(`Error generating embedding for keyword "${keyword.keyword}":`, keywordEmbeddingError);
                      // キーワード個別のembedding失敗は続行
                    }
                  }

                  // キーワード一括保存
                  if (keywordData.length > 0) {
                    await this.vectorStore.addKeywords(chunkDoc.id, keywordData);
                    totalKeywords += keywordData.length;
                  }
                }
              } catch (keywordError) {
                console.error(`Error extracting keywords for chunk ${chunkDoc.id}:`, keywordError);
                // キーワード抽出に失敗してもチャンク保存は続行
              }
              
              totalDocuments++; // totalDocuments は実際にはチャンク数
            }
          }

          // 進捗更新（10件ごと）
          if (i % 10 === 0) {
            await db
              .update(initJobs)
              .set({
                documentsCreated: totalDocuments,
                keywordsExtracted: totalKeywords,
              })
              .where(eq(initJobs.id, jobId));

            await statusMessage.edit(
              `🔍 **リンク処理中...**\n` +
              `💬 処理済みメッセージ: ${i + 1}/${messagesWithLinks.length}\n` +
              `📄 作成済みチャンク: ${totalDocuments}\n` +
              `🔑 抽出済みキーワード: ${totalKeywords}\n` +
              `🤖 チャンク化・キーワード・埋め込み処理中...\n` +
              `⏳ 残り約${messagesWithLinks.length - i}件...`
            );
          }

        } catch (error) {
          console.error(`Error processing message ${message.id}:`, error);
          // エラーがあっても続行
        }
      }

      // 完了処理
      await db
        .update(initJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          documentsCreated: totalDocuments,
          keywordsExtracted: totalKeywords,
          linksFound: totalLinks,
        })
        .where(eq(initJobs.id, jobId));

      await statusMessage.edit(
        `✅ **初期化処理が完了しました！**\n\n` +
        `📊 **処理結果:**\n` +
        `💬 処理したメッセージ: ${messages.length}件\n` +
        `🔗 発見したリンク: ${totalLinks}件\n` +
        `📄 作成したチャンク: ${totalDocuments}件\n` +
        `🔑 抽出したキーワード: ${totalKeywords}件\n` +
        `🔮 埋め込みベクトル: ${totalDocuments + totalKeywords}件\n\n` +
        `🎉 RAG + キーワード検索機能が利用可能になりました！`
      );

    } catch (error) {
      console.error('Initialization process error:', error);
      
      // エラー処理
      await db
        .update(initJobs)
        .set({
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        })
        .where(eq(initJobs.id, jobId));

      await statusMessage.edit(
        `❌ **初期化処理中にエラーが発生しました**\n\n` +
        `🔍 エラー内容: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
        `🔧 管理者にお問い合わせください。`
      );
    }
  }
}