# データベース設計・スキーマ詳細

最終更新: 2025-07-21

## 🎯 概要

Discord RAG Botプロジェクトのデータベース設計について詳しく解説します。PostgreSQL 16 + pgvectorを使用したベクトル検索対応の包括的なスキーマ設計です。

## 🗄️ データベース構成

### 技術スタック
- **データベース**: PostgreSQL 16
- **ベクトル検索**: pgvector拡張
- **ORM**: Drizzle ORM v0.44.3
- **マイグレーション**: drizzle-kit
- **接続**: postgres v3.4.7

### Docker環境
```yaml
# compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: discord_rag_bot
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init-pgvector.sql:/docker-entrypoint-initdb.d/init.sql
```

## 📋 スキーマ設計

### 1. discord_messages テーブル

```sql
CREATE TABLE discord_messages (
  id VARCHAR(20) PRIMARY KEY,           -- Discord メッセージID
  channel_id VARCHAR(20) NOT NULL,      -- チャンネルID
  channel_name VARCHAR(100) NOT NULL,   -- チャンネル名
  guild_id VARCHAR(20) NOT NULL,        -- サーバーID
  author_id VARCHAR(20) NOT NULL,       -- 作成者ID
  author_name VARCHAR(100) NOT NULL,    -- 作成者名
  content TEXT NOT NULL,                -- メッセージ内容
  created_at TIMESTAMP NOT NULL,        -- 作成日時
  links TEXT[],                         -- 抽出されたリンク配列
  processed BOOLEAN DEFAULT FALSE,      -- RAG処理済みフラグ
  created_at_db TIMESTAMP DEFAULT NOW() -- DB登録日時
);

-- インデックス
CREATE INDEX discord_messages_guild_id_idx ON discord_messages (guild_id);
CREATE INDEX discord_messages_channel_id_idx ON discord_messages (channel_id);
CREATE INDEX discord_messages_created_at_idx ON discord_messages (created_at);
CREATE INDEX discord_messages_processed_idx ON discord_messages (processed);
```

**用途**: Discord メッセージの生ログ保存
**特徴**: 
- Discord ID形式（20桁の文字列）対応
- リンク配列で関連コンテンツ追跡
- 処理状態管理

### 2. documents テーブル

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- ドキュメント一意ID
  title VARCHAR(500) NOT NULL,                   -- ドキュメントタイトル
  content TEXT NOT NULL,                         -- メインコンテンツ
  metadata JSONB,                               -- メタデータ（柔軟な構造）
  source_type VARCHAR(50) NOT NULL,             -- ソース種別
  source_id VARCHAR(100) NOT NULL,              -- ソース元ID
  created_at TIMESTAMP DEFAULT NOW(),           -- 作成日時
  updated_at TIMESTAMP DEFAULT NOW(),           -- 更新日時
  processed BOOLEAN DEFAULT FALSE,              -- 埋め込み処理済み
  content_hash VARCHAR(64) UNIQUE NOT NULL      -- 重複排除用ハッシュ
);

-- インデックス
CREATE INDEX documents_source_type_idx ON documents (source_type);
CREATE INDEX documents_source_id_idx ON documents (source_id);
CREATE INDEX documents_processed_idx ON documents (processed);
CREATE INDEX documents_created_at_idx ON documents (created_at);
```

**用途**: 構造化されたドキュメント保存
**メタデータ例**:
```json
{
  "url": "https://example.com/article",
  "domain": "example.com",
  "description": "記事の説明",
  "word_count": 1500,
  "language": "ja",
  "tags": ["technology", "ai"]
}
```

### 3. embeddings テーブル（ベクトル検索）

```sql
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- 埋め込みID
  document_id UUID REFERENCES documents(id),      -- ドキュメント参照
  chunk_index INTEGER NOT NULL,                   -- チャンク番号
  chunk_text TEXT NOT NULL,                       -- チャンクテキスト
  embedding VECTOR(1536) NOT NULL,                -- OpenAI embedding
  model_name VARCHAR(100) NOT NULL,               -- 使用モデル名
  created_at TIMESTAMP DEFAULT NOW()              -- 作成日時
);

-- ベクトル検索用インデックス（HNSW）
CREATE INDEX embeddings_embedding_idx ON embeddings 
  USING hnsw (embedding vector_cosine_ops);

-- 通常インデックス
CREATE INDEX embeddings_document_id_idx ON embeddings (document_id);
CREATE INDEX embeddings_model_name_idx ON embeddings (model_name);
```

**用途**: ベクトル埋め込みによる意味検索
**特徴**:
- pgvector VECTOR型（1536次元 = OpenAI text-embedding-3-small）
- HNSW インデックスによる高速近似最近傍検索
- チャンク分割による長文対応

### 4. rag_queries テーブル

```sql
CREATE TABLE rag_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- クエリID
  user_id VARCHAR(20) NOT NULL,                  -- ユーザーID
  guild_id VARCHAR(20),                          -- サーバーID
  channel_id VARCHAR(20),                        -- チャンネルID
  query_text TEXT NOT NULL,                      -- 質問内容
  response_text TEXT,                            -- 回答内容
  sources JSONB,                                 -- 参照ソース
  confidence DECIMAL(3,2),                       -- 信頼度
  processing_time INTEGER,                       -- 処理時間(ms)
  created_at TIMESTAMP DEFAULT NOW(),            -- 作成日時
  feedback INTEGER                               -- ユーザーフィードバック
);

-- インデックス
CREATE INDEX rag_queries_user_id_idx ON rag_queries (user_id);
CREATE INDEX rag_queries_guild_id_idx ON rag_queries (guild_id);
CREATE INDEX rag_queries_created_at_idx ON rag_queries (created_at);
```

**用途**: RAG クエリ・レスポンスログ
**sources例**:
```json
[
  {
    "document_id": "uuid-here",
    "chunk_index": 0,
    "similarity": 0.85,
    "title": "関連記事タイトル",
    "url": "https://example.com/article"
  }
]
```

### 5. init_jobs テーブル

```sql
CREATE TABLE init_jobs (
  id SERIAL PRIMARY KEY,                    -- ジョブID
  guild_id VARCHAR(20) NOT NULL,            -- サーバーID
  category_id VARCHAR(20) NOT NULL,         -- カテゴリID
  category_name VARCHAR(100) NOT NULL,      -- カテゴリ名
  initiated_by VARCHAR(20) NOT NULL,        -- 実行者ID
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- ステータス
  total_channels INTEGER DEFAULT 0,         -- 総チャンネル数
  processed_channels INTEGER DEFAULT 0,     -- 処理済みチャンネル数
  total_messages INTEGER DEFAULT 0,         -- 総メッセージ数
  processed_messages INTEGER DEFAULT 0,     -- 処理済みメッセージ数
  total_links INTEGER DEFAULT 0,            -- 総リンク数
  processed_links INTEGER DEFAULT 0,        -- 処理済みリンク数
  created_at TIMESTAMP DEFAULT NOW(),       -- 作成日時
  started_at TIMESTAMP,                     -- 開始日時
  completed_at TIMESTAMP,                   -- 完了日時
  error_message TEXT                        -- エラーメッセージ
);

-- インデックス
CREATE INDEX init_jobs_guild_id_idx ON init_jobs (guild_id);
CREATE INDEX init_jobs_status_idx ON init_jobs (status);
CREATE INDEX init_jobs_created_at_idx ON init_jobs (created_at);
```

**用途**: 初期化ジョブの進捗管理
**ステータス**: `pending`, `running`, `completed`, `failed`

## 🔧 Drizzle ORM スキーマ定義

### TypeScript スキーマ

```typescript
// src/packages/shared/src/database/schema.ts
import { pgTable, varchar, text, timestamp, boolean, integer, serial, uuid, decimal, jsonb } from 'drizzle-orm/pg-core';
import { vector } from 'pgvector/drizzle-orm';

export const discordMessages = pgTable('discord_messages', {
  id: varchar('id', { length: 20 }).primaryKey(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  channelName: varchar('channel_name', { length: 100 }).notNull(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  authorId: varchar('author_id', { length: 20 }).notNull(),
  authorName: varchar('author_name', { length: 100 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull(),
  links: text('links').array(),
  processed: boolean('processed').default(false),
  createdAtDb: timestamp('created_at_db').defaultNow(),
});

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  metadata: jsonb('metadata'),
  sourceType: varchar('source_type', { length: 50 }).notNull(),
  sourceId: varchar('source_id', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  processed: boolean('processed').default(false),
  contentHash: varchar('content_hash', { length: 64 }).unique().notNull(),
});

export const embeddings = pgTable('embeddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').references(() => documents.id),
  chunkIndex: integer('chunk_index').notNull(),
  chunkText: text('chunk_text').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  modelName: varchar('model_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### 型安全なクエリ例

```typescript
// メッセージ検索
const recentMessages = await db
  .select()
  .from(discordMessages)
  .where(eq(discordMessages.guildId, guildId))
  .orderBy(desc(discordMessages.createdAt))
  .limit(100);

// ベクトル検索
const similarDocuments = await db
  .select({
    id: documents.id,
    title: documents.title,
    similarity: sql<number>`1 - (${embeddings.embedding} <=> ${queryEmbedding})`
  })
  .from(embeddings)
  .innerJoin(documents, eq(embeddings.documentId, documents.id))
  .orderBy(sql`${embeddings.embedding} <=> ${queryEmbedding}`)
  .limit(5);
```

## 📊 データフロー

### 1. 初期データ収集フロー
```
Discord API → discord_messages → リンク抽出 → documents → 埋め込み生成 → embeddings
                     ↓
                init_jobs (進捗追跡)
```

### 2. RAG クエリフロー
```
User Query → 埋め込み生成 → ベクトル検索 (embeddings) → 関連文書取得 → AI応答生成 → rag_queries
```

### 3. 継続的更新フロー
```
新Discord Message → 自動処理 → documents作成 → embedding生成 → 検索対象に追加
```

## 🚀 パフォーマンス最適化

### インデックス戦略

#### 1. ベクトル検索最適化
```sql
-- HNSW インデックス（高速だが近似）
CREATE INDEX embeddings_embedding_hnsw_idx ON embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- IVFFlat インデックス（精密だが低速）
CREATE INDEX embeddings_embedding_ivfflat_idx ON embeddings 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

#### 2. 複合インデックス
```sql
-- 日時範囲検索用
CREATE INDEX discord_messages_guild_time_idx ON discord_messages (guild_id, created_at);

-- 処理状態確認用
CREATE INDEX documents_source_processed_idx ON documents (source_type, processed);
```

### クエリ最適化

#### 1. ページネーション
```typescript
const messages = await db
  .select()
  .from(discordMessages)
  .where(eq(discordMessages.guildId, guildId))
  .orderBy(desc(discordMessages.createdAt))
  .limit(50)
  .offset(page * 50);
```

#### 2. 部分ロード
```typescript
const documentSummary = await db
  .select({
    id: documents.id,
    title: documents.title,
    sourceType: documents.sourceType,
    createdAt: documents.createdAt
  })
  .from(documents);
```

## 🔍 運用・監視

### 統計情報取得
```sql
-- テーブルサイズ
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public';

-- インデックス使用状況
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes;

-- ベクトル検索パフォーマンス
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM embeddings 
ORDER BY embedding <=> '[0.1,0.2,...]' 
LIMIT 10;
```

### バックアップ戦略
```bash
# 定期バックアップ
pg_dump -h localhost -U postgres -d discord_rag_bot > backup_$(date +%Y%m%d).sql

# ベクトルデータ含む完全バックアップ
pg_dump -h localhost -U postgres -d discord_rag_bot --format=custom > backup.dump
```

## ⚠️ 注意事項・制約

### 1. pgvector制約
- **最大次元数**: 16,000次元まで
- **データ型**: REAL（32bit浮動小数点）
- **NULL値**: 検索でスキップされる

### 2. パフォーマンス考慮
- **大量ベクトル**: HNSWインデックス推奨
- **メモリ使用量**: embedding用に十分なRAM確保
- **同時接続数**: connection pooling設定

### 3. 運用上の制約
- **マイグレーション**: ベクトルインデックス再構築時間長い
- **バックアップサイズ**: ベクトルデータでサイズ大
- **レプリケーション**: pgvector対応要確認

## 🎯 今後の拡張計画

### 短期改善
1. **パーティショニング**: 日付別テーブル分割
2. **読み取りレプリカ**: クエリ負荷分散
3. **キャッシュ層**: Redis導入検討

### 長期改善
1. **分散データベース**: 水平スケーリング
2. **多言語対応**: 言語別埋め込みモデル
3. **リアルタイム更新**: Change Data Capture

---

**このデータベース設計により、高性能なベクトル検索を持つDiscord RAG Botの基盤が構築されています。新機能追加時はスキーマ設計とインデックス戦略を慎重に検討してください。**