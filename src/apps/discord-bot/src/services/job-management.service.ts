import type { Message } from 'discord.js';
import type { Logger } from '@shared/core';
import {
  getDatabaseConnection,
  initJobs,
  type NewDbInitJob,
  DatabaseError,
  ValidationError,
  safeAsync
} from '@shared/core';
import { eq, and } from 'drizzle-orm';

export interface JobInfo {
  id: number;
  guildId: string;
  categoryId: string;
  categoryName: string;
  initiatedBy: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  progress: {
    totalChannels: number;
    processedChannels: number;
    totalMessages: number;
    processedMessages: number;
    linksFound: number;
    documentsCreated: number;
    keywordsExtracted: number;
  };
}

/**
 * ジョブ管理サービス
 * DB初期化ジョブの作成、更新、監視を担当
 */
export class JobManagementService {
  constructor(private readonly logger: Logger) {}

  /**
   * 新しい初期化ジョブを作成
   */
  async createJob(
    guildId: string,
    categoryId: string,
    categoryName: string,
    initiatedBy: string
  ): Promise<JobInfo> {
    const db = getDatabaseConnection();

    try {
      // 既存の実行中ジョブをチェック
      await this.checkExistingJobs(guildId);

      // 新しいジョブを作成
      const [job] = await db
        .insert(initJobs)
        .values({
          guildId,
          categoryId,
          categoryName,
          initiatedBy,
          status: 'pending',
        })
        .returning();

      this.logger.info('Init job created', {
        jobId: job.id,
        guildId,
        categoryId,
        categoryName,
        initiatedBy,
      });

      return this.mapToJobInfo(job);

    } catch (error) {
      this.logger.error('Failed to create init job', error instanceof Error ? error : undefined, {
        guildId,
        categoryId,
        categoryName,
      });
      throw new DatabaseError('Failed to create initialization job', error instanceof Error ? error : undefined);
    }
  }

  /**
   * ジョブを開始状態に更新
   */
  async startJob(jobId: number): Promise<void> {
    const db = getDatabaseConnection();

    const result = await safeAsync(async () => {
      await db
        .update(initJobs)
        .set({
          status: 'running',
          startedAt: new Date(),
        })
        .where(eq(initJobs.id, jobId));
    });

    if (result === null) {
      throw new DatabaseError('Failed to start job');
    }

    this.logger.info('Job started', { jobId });
  }

  /**
   * ジョブの進捗を更新
   */
  async updateJobProgress(
    jobId: number,
    progress: Partial<{
      totalChannels: number;
      processedChannels: number;
      totalMessages: number;
      processedMessages: number;
      linksFound: number;
      documentsCreated: number;
      keywordsExtracted: number;
    }>
  ): Promise<void> {
    const db = getDatabaseConnection();

    const result = await safeAsync(async () => {
      await db
        .update(initJobs)
        .set(progress)
        .where(eq(initJobs.id, jobId));
    });

    if (result === null) {
      this.logger.warn('Failed to update job progress', { jobId, progress });
    } else {
      this.logger.debug('Job progress updated', { jobId, progress });
    }
  }

  /**
   * ジョブを完了状態に更新
   */
  async completeJob(
    jobId: number,
    finalStats: {
      linksFound: number;
      documentsCreated: number;
    }
  ): Promise<void> {
    const db = getDatabaseConnection();

    const result = await safeAsync(async () => {
      await db
        .update(initJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          linksFound: finalStats.linksFound,
          documentsCreated: finalStats.documentsCreated,
        })
        .where(eq(initJobs.id, jobId));
    });

    if (result === null) {
      throw new DatabaseError('Failed to complete job');
    }

    this.logger.info('Job completed', { jobId, finalStats });
  }

  /**
   * ジョブを失敗状態に更新
   */
  async failJob(jobId: number, errorMessage: string): Promise<void> {
    const db = getDatabaseConnection();

    const result = await safeAsync(async () => {
      await db
        .update(initJobs)
        .set({
          status: 'failed',
          errorMessage,
          completedAt: new Date(),
        })
        .where(eq(initJobs.id, jobId));
    });

    if (result === null) {
      this.logger.error('Failed to update job to failed state', undefined, { jobId });
    } else {
      this.logger.info('Job marked as failed', { jobId, errorMessage });
    }
  }

  /**
   * ジョブ情報を取得
   */
  async getJob(jobId: number): Promise<JobInfo | null> {
    const db = getDatabaseConnection();

    const result = await safeAsync(async () => {
      const [job] = await db
        .select()
        .from(initJobs)
        .where(eq(initJobs.id, jobId))
        .limit(1);
      return job;
    });

    return result ? this.mapToJobInfo(result) : null;
  }

  /**
   * ギルドの実行中ジョブを取得
   */
  async getRunningJob(guildId: string): Promise<JobInfo | null> {
    const db = getDatabaseConnection();

    const result = await safeAsync(async () => {
      const [job] = await db
        .select()
        .from(initJobs)
        .where(and(
          eq(initJobs.guildId, guildId),
          eq(initJobs.status, 'running')
        ))
        .limit(1);
      return job;
    });

    return result ? this.mapToJobInfo(result) : null;
  }

  /**
   * ギルドの最近のジョブ履歴を取得
   */
  async getJobHistory(guildId: string, limit = 10): Promise<JobInfo[]> {
    const db = getDatabaseConnection();

    const result = await safeAsync(async () => {
      return await db
        .select()
        .from(initJobs)
        .where(eq(initJobs.guildId, guildId))
        .orderBy(initJobs.createdAt)
        .limit(limit);
    });

    return result ? result.map(job => this.mapToJobInfo(job)) : [];
  }

  /**
   * 既存の実行中ジョブをチェック
   */
  private async checkExistingJobs(guildId: string): Promise<void> {
    const runningJob = await this.getRunningJob(guildId);
    
    if (runningJob) {
      throw new ValidationError(
        'Another initialization job is already running. Please wait for it to complete.',
        { guildId, runningJobId: runningJob.id }
      );
    }
  }

  /**
   * データベースレコードをJobInfoにマッピング
   */
  private mapToJobInfo(job: any): JobInfo {
    return {
      id: job.id,
      guildId: job.guildId,
      categoryId: job.categoryId,
      categoryName: job.categoryName,
      initiatedBy: job.initiatedBy,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
      progress: {
        totalChannels: job.totalChannels || 0,
        processedChannels: job.processedChannels || 0,
        totalMessages: job.totalMessages || 0,
        processedMessages: job.processedMessages || 0,
        linksFound: job.linksFound || 0,
        documentsCreated: job.documentsCreated || 0,
        keywordsExtracted: job.keywordsExtracted || 0,
      },
    };
  }

  /**
   * ジョブの実行時間を計算
   */
  getJobDuration(job: JobInfo): number | null {
    if (!job.startedAt) return null;
    
    const endTime = job.completedAt || new Date();
    return endTime.getTime() - job.startedAt.getTime();
  }

  /**
   * ジョブの進捗率を計算
   */
  getJobProgressPercentage(job: JobInfo): number {
    const { progress } = job;
    
    if (job.status === 'completed') return 100;
    if (job.status === 'failed') return 0;
    if (job.status === 'pending') return 0;

    // 簡単な進捗計算（各段階を均等に重み付け）
    let totalWeight = 0;
    let completedWeight = 0;

    // メッセージ取得段階 (30%)
    if (progress.totalChannels > 0) {
      totalWeight += 30;
      completedWeight += (progress.processedChannels / progress.totalChannels) * 30;
    }

    // ドキュメント作成段階 (40%)
    if (progress.totalMessages > 0) {
      totalWeight += 40;
      const estimatedDocuments = progress.totalMessages * 0.1; // 10%のメッセージにリンクがあると仮定
      completedWeight += Math.min(progress.documentsCreated / estimatedDocuments, 1) * 40;
    }

    // キーワード抽出段階 (30%)
    if (progress.documentsCreated > 0) {
      totalWeight += 30;
      const estimatedKeywords = progress.documentsCreated * 5; // 1ドキュメントあたり5キーワード
      completedWeight += Math.min(progress.keywordsExtracted / estimatedKeywords, 1) * 30;
    }

    return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) / 100 : 0;
  }

  /**
   * ジョブ統計のサマリーを取得
   */
  getJobSummary(job: JobInfo): {
    status: string;
    duration: string | null;
    progressPercentage: number;
    summary: string;
  } {
    const duration = this.getJobDuration(job);
    const progressPercentage = this.getJobProgressPercentage(job);

    let durationStr: string | null = null;
    if (duration !== null) {
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      durationStr = `${minutes}分${seconds}秒`;
    }

    let summary = '';
    switch (job.status) {
      case 'pending':
        summary = '処理開始待ち';
        break;
      case 'running':
        summary = `実行中 (${progressPercentage}%)`;
        break;
      case 'completed':
        summary = `完了 - ${job.progress.documentsCreated}件のドキュメント、${job.progress.keywordsExtracted}個のキーワードを処理`;
        break;
      case 'failed':
        summary = `失敗: ${job.errorMessage}`;
        break;
    }

    return {
      status: job.status,
      duration: durationStr,
      progressPercentage,
      summary,
    };
  }
}