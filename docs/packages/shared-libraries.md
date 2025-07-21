# 共有ライブラリ (@shared/types)

## 概要

`@shared/types` パッケージは、Discord RAG Bot プロジェクト全体で使用される共通機能とユーティリティを提供します。

## 主要コンポーネント

### 1. MessageFetcher (`discord/message-fetcher.ts`)

Discord APIを使用してメッセージ履歴を取得する機能を提供します。

#### 主要メソッド

```typescript
class MessageFetcher {
  // カテゴリ内全チャンネルのメッセージを取得
  async fetchCategoryMessages(categoryId: string, onProgress?: ProgressCallback): Promise<MessageData[]>
  
  // カテゴリの存在とアクセス権限を検証
  async validateCategoryAccess(categoryId: string, guildId: string): Promise<boolean>
  
  // カテゴリ名を取得
  async getCategoryName(categoryId: string): Promise<string | null>
}
```

#### MessageData 型定義

```typescript
interface MessageData {
  id: string;           // Discord メッセージID
  channelId: string;    // チャンネルID
  guildId: string;      // サーバーID
  authorId: string;     // 投稿者ID
  content: string;      // メッセージ内容
  createdAt: Date;      // 投稿日時
  links: string[];      // 抽出されたリンク
}
```

#### 特徴

- **進捗コールバック**: 大量データ処理時のリアルタイム進捗更新
- **Rate Limit対応**: Discord API制限を考慮した取得方式
- **リンク抽出**: メッセージからURLを自動抽出
- **エラーハンドリング**: 適切なエラー処理と復旧

### 2. LinkProcessor (`content/link-processor.ts`)

Webページからコンテンツを取得・解析する機能を提供します。

#### 主要メソッド

```typescript
class LinkProcessor {
  // 複数のリンクを並列処理
  async processLinks(urls: string[]): Promise<ProcessedContent[]>
  
  // 単一リンクの処理
  private async processSingleLink(url: string): Promise<ProcessedContent | null>
}
```

#### ProcessedContent 型定義

```typescript
interface ProcessedContent {
  content: string;      // 抽出されたテキストコンテンツ
  title: string;        // ページタイトル
  originalUrl: string;  // 元のURL
  metadata: {
    description?: string;  // メタ説明
    domain: string;        // ドメイン名
    processedAt: Date;     // 処理日時
    contentType?: string;  // コンテンツタイプ
    wordCount: number;     // 単語数
  };
}
```

#### 特徴

- **並列処理**: 複数リンクの効率的な同時処理
- **コンテンツ抽出**: HTMLからテキストを適切に抽出
- **メタデータ取得**: タイトル、説明、その他の情報を取得
- **エラー許容**: 一部のリンクが失敗しても処理を継続

### 3. データベース統合 (`database/`)

#### Connection管理 (`database/connection.ts`)

```typescript
// データベース接続の取得
export function getDatabase(): Database;

// 接続プールの管理
export function closeDatabase(): Promise<void>;
```

#### スキーマ定義 (`database/schema.ts`)

主要テーブルの定義：

```typescript
// Discord メッセージテーブル
export const discordMessages = pgTable('discord_messages', {
  id: serial('id').primaryKey(),
  messageId: varchar('message_id', { length: 32 }).notNull().unique(),
  channelId: varchar('channel_id', { length: 32 }).notNull(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  authorId: varchar('author_id', { length: 32 }).notNull(),
  content: text('content'),
  createdAt: timestamp('created_at').notNull(),
});

// ドキュメントテーブル（RAG用）
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  source: varchar('source', { length: 500 }),
  metadata: jsonb('metadata'),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// 初期化ジョブ管理テーブル
export const initJobs = pgTable('init_jobs', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 32 }).notNull(),
  categoryId: varchar('category_id', { length: 32 }).notNull(),
  categoryName: varchar('category_name', { length: 255 }),
  initiatedBy: varchar('initiated_by', { length: 32 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // ... その他のカラム
});
```

### 4. 設定管理 (`config/index.ts`)

環境変数とアプリケーション設定を管理：

```typescript
interface Config {
  database: {
    connectionString: string;
    maxConnections: number;
  };
  discord: {
    token: string;
    clientId: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
}

export const config: Config;
```

### 5. 型定義 (`types/index.ts`)

プロジェクト全体で使用される共通型定義：

```typescript
// Discord関連
export interface DiscordMessage { /* ... */ }
export interface DiscordChannel { /* ... */ }

// RAG関連  
export interface Document { /* ... */ }
export interface SearchResult { /* ... */ }
export interface EmbeddingConfig { /* ... */ }

// ジョブ管理
export interface InitJob { /* ... */ }
export interface JobProgress { /* ... */ }
```

## 使用方法

### インストール

```bash
# 共有ライブラリは workspace 内で自動的に利用可能
# 外部依存関係のみインストール
npm install
```

### インポート例

```typescript
// Discord Bot アプリケーションから
import { MessageFetcher, LinkProcessor } from '@shared/discord/message-fetcher';
import { getDatabase } from '@shared/database';
import { discordMessages, documents } from '@shared/database/schema';

// RAG パッケージから
import { ProcessedContent } from '@shared/content/link-processor';
import { config } from '@shared/config';
```

## 開発・デバッグ

### ビルド

```bash
npm run build --workspace=src/packages/shared
```

### 型チェック

```bash
npm run type-check --workspace=src/packages/shared
```

### 開発モード

```bash
npm run dev --workspace=src/packages/shared
```

## 依存関係

### 主要依存関係

- **drizzle-orm**: v0.32.2 - ORM とスキーマ定義
- **postgres**: v3.4.0 - PostgreSQL ドライバー

### 開発依存関係

- **typescript**: v5.8.3
- **@types/node**: v24.0.15
- **drizzle-kit**: v0.31.4

## アーキテクチャ設計

### モジュール構成

```
src/packages/shared/src/
├── config/          # 環境設定・アプリケーション設定
├── content/         # コンテンツ処理（リンク解析等）
├── database/        # データベース接続・スキーマ
├── discord/         # Discord API 関連機能
├── types/           # 共通型定義
├── utils/           # ユーティリティ関数
└── index.ts         # エクスポート統合
```

### 設計原則

1. **単一責任**: 各モジュールは明確な責任を持つ
2. **依存関係の最小化**: 必要最小限の外部依存
3. **型安全性**: TypeScript を活用した厳格な型定義
4. **再利用性**: 複数のアプリケーションから利用可能
5. **テスト容易性**: モックしやすい構造

### パフォーマンス考慮

- **接続プール**: データベース接続の効率的な管理
- **並列処理**: I/O バウンドな処理の並列化
- **メモリ効率**: 大量データ処理時のメモリ使用量最適化
- **エラー回復**: 部分的な失敗に対する適切な処理