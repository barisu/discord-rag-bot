/**
 * 進捗管理とレポーティングの共通機能
 */

export interface ProgressState {
  readonly totalSteps: number;
  readonly completedSteps: number;
  readonly currentStep: string;
  readonly percentage: number;
  readonly startTime: Date;
  readonly estimatedEndTime: Date | null;
  readonly metadata: Record<string, any>;
}

export interface ProgressUpdate {
  completedSteps?: number;
  currentStep?: string;
  metadata?: Record<string, any>;
}

export type ProgressCallback = (state: ProgressState) => void | Promise<void>;

/**
 * 進捗追跡クラス
 */
export class ProgressTracker {
  private totalSteps: number;
  private completedSteps: number;
  private currentStep: string;
  private startTime: Date;
  private metadata: Record<string, any>;
  private callbacks: ProgressCallback[];

  constructor(totalSteps: number, initialStep = 'Starting...') {
    this.totalSteps = totalSteps;
    this.completedSteps = 0;
    this.currentStep = initialStep;
    this.startTime = new Date();
    this.metadata = {};
    this.callbacks = [];
  }

  /**
   * 進捗コールバックを追加
   */
  addCallback(callback: ProgressCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * 進捗コールバックを削除
   */
  removeCallback(callback: ProgressCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * 現在の進捗状態を取得
   */
  getState(): ProgressState {
    const now = new Date();
    const elapsed = now.getTime() - this.startTime.getTime();
    const percentage = this.totalSteps > 0 ? (this.completedSteps / this.totalSteps) * 100 : 0;
    
    // 残り時間を推定
    let estimatedEndTime: Date | null = null;
    if (percentage > 0 && percentage < 100) {
      const estimatedTotal = (elapsed / percentage) * 100;
      estimatedEndTime = new Date(this.startTime.getTime() + estimatedTotal);
    }

    return {
      totalSteps: this.totalSteps,
      completedSteps: this.completedSteps,
      currentStep: this.currentStep,
      percentage: Math.round(percentage * 100) / 100,
      startTime: this.startTime,
      estimatedEndTime,
      metadata: { ...this.metadata },
    };
  }

  /**
   * 進捗を更新
   */
  async update(update: ProgressUpdate): Promise<void> {
    if (update.completedSteps !== undefined) {
      this.completedSteps = Math.min(update.completedSteps, this.totalSteps);
    }
    
    if (update.currentStep !== undefined) {
      this.currentStep = update.currentStep;
    }
    
    if (update.metadata !== undefined) {
      this.metadata = { ...this.metadata, ...update.metadata };
    }

    // コールバックを実行
    const state = this.getState();
    await Promise.all(this.callbacks.map(callback => callback(state)));
  }

  /**
   * ステップを1つ進める
   */
  async next(step?: string): Promise<void> {
    await this.update({
      completedSteps: this.completedSteps + 1,
      currentStep: step,
    });
  }

  /**
   * ステップを指定数進める
   */
  async advance(steps: number, currentStep?: string): Promise<void> {
    await this.update({
      completedSteps: this.completedSteps + steps,
      currentStep,
    });
  }

  /**
   * 完了状態にする
   */
  async complete(finalStep = 'Completed'): Promise<void> {
    await this.update({
      completedSteps: this.totalSteps,
      currentStep: finalStep,
    });
  }

  /**
   * 総ステップ数を更新
   */
  async setTotalSteps(totalSteps: number): Promise<void> {
    this.totalSteps = totalSteps;
    await this.update({});
  }

  /**
   * 進捗をリセット
   */
  async reset(totalSteps?: number, initialStep?: string): Promise<void> {
    if (totalSteps !== undefined) {
      this.totalSteps = totalSteps;
    }
    this.completedSteps = 0;
    this.currentStep = initialStep || 'Starting...';
    this.startTime = new Date();
    this.metadata = {};
    
    await this.update({});
  }

  /**
   * 完了しているかチェック
   */
  isComplete(): boolean {
    return this.completedSteps >= this.totalSteps;
  }

  /**
   * 経過時間を取得（ミリ秒）
   */
  getElapsedTime(): number {
    return new Date().getTime() - this.startTime.getTime();
  }
}

/**
 * 段階的な進捗管理のためのビルダー
 */
export class ProgressBuilder {
  private phases: Array<{ name: string; steps: number }> = [];

  addPhase(name: string, steps: number): this {
    this.phases.push({ name, steps });
    return this;
  }

  build(): ProgressTracker {
    const totalSteps = this.phases.reduce((sum, phase) => sum + phase.steps, 0);
    return new ProgressTracker(totalSteps);
  }

  /**
   * フェーズ情報を取得
   */
  getPhases(): Array<{ name: string; steps: number }> {
    return [...this.phases];
  }
}

/**
 * Discord メッセージ更新のための進捗レポーター
 */
export class DiscordProgressReporter {
  private message: any; // Discord.js Message型
  private lastUpdateTime = 0;
  private updateInterval: number;

  constructor(message: any, updateIntervalMs = 2000) {
    this.message = message;
    this.updateInterval = updateIntervalMs;
  }

  /**
   * 進捗コールバック関数を作成
   */
  createCallback(): ProgressCallback {
    return async (state: ProgressState) => {
      const now = Date.now();
      
      // 更新間隔をチェック（完了時は即座に更新）
      if (now - this.lastUpdateTime < this.updateInterval && state.percentage !== 100) {
        return;
      }

      this.lastUpdateTime = now;

      try {
        const content = this.formatProgressMessage(state);
        await this.message.edit(content);
      } catch (error) {
        console.error('Failed to update Discord progress message:', error);
      }
    };
  }

  /**
   * 進捗メッセージをフォーマット
   */
  private formatProgressMessage(state: ProgressState): string {
    const progressBar = this.createProgressBar(state.percentage);
    const timeInfo = this.formatTimeInfo(state);
    
    return (
      `🔄 **${state.currentStep}**\n\n` +
      `${progressBar} ${state.percentage.toFixed(1)}%\n` +
      `📊 進捗: ${state.completedSteps}/${state.totalSteps}\n` +
      `⏱️ ${timeInfo}\n` +
      this.formatMetadata(state.metadata)
    );
  }

  /**
   * プログレスバーを作成
   */
  private createProgressBar(percentage: number, length = 20): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * 時間情報をフォーマット
   */
  private formatTimeInfo(state: ProgressState): string {
    const elapsed = new Date().getTime() - state.startTime.getTime();
    const elapsedStr = this.formatDuration(elapsed);
    
    if (state.estimatedEndTime && state.percentage < 100) {
      const remaining = state.estimatedEndTime.getTime() - new Date().getTime();
      const remainingStr = this.formatDuration(remaining);
      return `経過: ${elapsedStr} | 推定残り: ${remainingStr}`;
    }
    
    return `経過時間: ${elapsedStr}`;
  }

  /**
   * メタデータをフォーマット
   */
  private formatMetadata(metadata: Record<string, any>): string {
    const entries = Object.entries(metadata);
    if (entries.length === 0) return '';
    
    const formatted = entries
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    return `\n📋 **詳細:**\n${formatted}`;
  }

  /**
   * 期間をフォーマット
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}時間${minutes % 60}分`;
    } else if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }
}

/**
 * バッチ処理での進捗管理ヘルパー
 */
export async function withProgress<T>(
  items: T[],
  processor: (item: T, index: number) => Promise<void>,
  options: {
    tracker?: ProgressTracker;
    stepName?: (item: T, index: number) => string;
    batchSize?: number;
    onError?: (error: unknown, item: T, index: number) => void;
  } = {}
): Promise<void> {
  const {
    tracker = new ProgressTracker(items.length),
    stepName = (_, index) => `Processing item ${index + 1}`,
    batchSize = 1,
    onError,
  } = options;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (item, batchIndex) => {
        const index = i + batchIndex;
        
        try {
          await tracker.update({
            currentStep: stepName(item, index),
          });
          
          await processor(item, index);
          await tracker.next();
        } catch (error) {
          if (onError) {
            onError(error, item, index);
          } else {
            throw error;
          }
        }
      })
    );
  }
}