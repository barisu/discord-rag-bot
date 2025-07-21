# RAGシステム (@rag/core)

## 概要

`@rag/core` パッケージは、Retrieval-Augmented Generation (RAG) 機能を提供するライブラリです。Mastraフレームワークを使用して、ベクトル検索とAI応答生成を統合しています。

## アーキテクチャ

```
src/packages/rag/src/
├── embeddings/          # 埋め込み生成機能
│   └── index.ts
├── vectorstore/         # ベクトルストア管理
│   ├── index.ts
│   └── postgres-vectorstore.ts
├── retrieval/           # 検索・取得機能
│   └── index.ts
└── index.ts            # 統合エクスポート
```

## 主要コンポーネント

### 1. Embeddings (`embeddings/index.ts`)

テキストをベクトル埋め込みに変換する機能を提供します。

#### 実装例

```typescript
import { Embeddings } from '@rag/core';

class OpenAIEmbeddings implements Embeddings {
  private apiKey: string;
  private model: string = 'text-embedding-ada-002';

  async embedText(text: string): Promise<number[]> {
    // OpenAI Embeddings API を使用してベクトル生成
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // 複数テキストの一括処理
  }
}
```

#### 特徴

- **OpenAI統合**: text-embedding-ada-002 モデルを使用
- **バッチ処理**: 複数テキストの効率的な処理
- **キャッシュ機能**: 計算済み埋め込みの再利用
- **エラーハンドリング**: API制限とネットワークエラーへの対応

### 2. VectorStore (`vectorstore/postgres-vectorstore.ts`)

PostgreSQL + pgvector を使用したベクトルストレージを提供します。

#### 主要メソッド

```typescript
class PostgresVectorStore {
  // ドキュメントとベクトルを保存
  async addDocument(document: Document, embedding: number[]): Promise<string>
  
  // 類似度検索
  async similaritySearch(
    queryEmbedding: number[], 
    options: SearchOptions
  ): Promise<SearchResult[]>
  
  // メタデータフィルタリング付き検索
  async searchWithFilter(
    queryEmbedding: number[],
    filter: MetadataFilter,
    options: SearchOptions
  ): Promise<SearchResult[]>
  
  // ドキュメント削除
  async deleteDocument(documentId: string): Promise<boolean>
}
```

#### SearchOptions 型定義

```typescript
interface SearchOptions {
  limit?: number;           // 結果数制限（デフォルト: 10）
  threshold?: number;       // 類似度閾値（デフォルト: 0.7）
  includeMetadata?: boolean; // メタデータ含有（デフォルト: true）
}
```

#### SearchResult 型定義

```typescript
interface SearchResult {
  id: string;              // ドキュメントID
  content: string;         // ドキュメント内容
  similarity: number;      // 類似度スコア（0-1）
  metadata: {
    title?: string;        // タイトル
    source: string;        // 元URL
    domain: string;        // ドメイン
    messageId?: string;    // 参照Discordメッセージ
    channelId?: string;    // チャンネルID
    authorId?: string;     // 投稿者ID
    processedAt: Date;     // 処理日時
  };
}
```

### 3. Retrieval (`retrieval/index.ts`)

検索機能の高レベルインターフェースを提供します。

#### 主要メソッド

```typescript
class RetrievalSystem {
  // 自然言語クエリによる検索
  async search(query: string, options?: RetrievalOptions): Promise<RetrievalResult>
  
  // コンテキスト付き検索
  async searchWithContext(
    query: string, 
    context: SearchContext,
    options?: RetrievalOptions
  ): Promise<RetrievalResult>
  
  // ランキング済み結果の取得
  async getRankedResults(
    query: string, 
    rawResults: SearchResult[]
  ): Promise<RankedResult[]>
}
```

#### RetrievalOptions 型定義

```typescript
interface RetrievalOptions {
  maxResults?: number;      // 最大結果数
  minSimilarity?: number;   // 最小類似度
  domains?: string[];       // ドメインフィルタ
  dateRange?: {            // 日付範囲フィルタ
    from?: Date;
    to?: Date;
  };
  channels?: string[];      // チャンネルフィルタ
  authors?: string[];       // 投稿者フィルタ
}
```

#### RetrievalResult 型定義

```typescript
interface RetrievalResult {
  query: string;            // 検索クエリ
  results: RankedResult[];  // ランキング済み結果
  totalFound: number;       // 総件数
  processingTime: number;   // 処理時間（ms）
  suggestions?: string[];   // 関連クエリ提案
}

interface RankedResult extends SearchResult {
  rank: number;             // ランキング順位
  relevanceScore: number;   // 関連性スコア
  explanation?: string;     // スコアリング理由
}
```

## 統合インターフェース

### RAGSystem クラス

RAG機能の統合インターフェースを提供：

```typescript
class RAGSystem {
  private embeddings: Embeddings;
  private vectorStore: PostgresVectorStore;
  private retrieval: RetrievalSystem;

  // ドキュメント追加（埋め込み生成 + 保存）
  async addDocument(content: string, metadata: DocumentMetadata): Promise<string>
  
  // 質問応答
  async answer(question: string, options?: AnswerOptions): Promise<AnswerResult>
  
  // 関連ドキュメント検索
  async findRelated(query: string, options?: RetrievalOptions): Promise<RetrievalResult>
}
```

#### AnswerResult 型定義

```typescript
interface AnswerResult {
  answer: string;           // 生成された回答
  sources: SearchResult[];  // 参照ソース
  confidence: number;       // 信頼度スコア
  query: string;           // 元の質問
  processingTime: number;   // 処理時間
}
```

## Mastra統合

### 設定例

```typescript
import { Mastra } from 'mastra';
import { PostgresVectorStore } from '@rag/core';

const app = new Mastra({
  vectorStore: new PostgresVectorStore({
    connectionString: process.env.DATABASE_URL,
    tableName: 'documents',
    embeddingDimension: 1536
  }),
  
  embeddings: {
    provider: 'openai',
    model: 'text-embedding-ada-002',
    apiKey: process.env.OPENAI_API_KEY
  },
  
  llm: {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY
  }
});
```

### エージェント定義

```typescript
const ragAgent = app.createAgent({
  name: 'discord-rag-bot',
  description: 'Discord channel content search and Q&A',
  
  tools: [
    {
      name: 'search_documents',
      description: 'Search through Discord channel content',
      parameters: {
        query: { type: 'string', description: 'Search query' },
        filters: { type: 'object', description: 'Search filters' }
      },
      handler: async ({ query, filters }) => {
        return await ragSystem.findRelated(query, filters);
      }
    }
  ],
  
  prompt: `
  You are a helpful Discord bot that can search through channel history 
  and provide relevant information. When answering questions:
  
  1. Always cite your sources with Discord message links
  2. Provide accurate information based on the channel content
  3. If you're not sure, say so and suggest what to search for
  4. Keep responses concise but informative
  `
});
```

## 使用例

### 基本的な検索

```typescript
import { RAGSystem } from '@rag/core';

const rag = new RAGSystem();

// ドキュメント追加
await rag.addDocument('TypeScriptの型定義について', {
  title: 'TypeScript Types Guide',
  source: 'https://example.com/typescript',
  messageId: 'discord-message-123',
  channelId: 'channel-456'
});

// 検索実行
const result = await rag.findRelated('TypeScriptの型について教えて');
console.log(result.results);
```

### 質問応答

```typescript
// AI による回答生成
const answer = await rag.answer('TypeScriptでインターフェースを定義する方法は？');

console.log('回答:', answer.answer);
console.log('ソース:', answer.sources.map(s => s.metadata.source));
console.log('信頼度:', answer.confidence);
```

### フィルタリング検索

```typescript
// 特定チャンネルのみを対象に検索
const result = await rag.findRelated('React hooks', {
  channels: ['react-general', 'frontend-help'],
  dateRange: {
    from: new Date('2024-01-01'),
    to: new Date()
  },
  minSimilarity: 0.8
});
```

## パフォーマンス最適化

### インデックス戦略

```sql
-- ベクトル検索用インデックス
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- メタデータ検索用インデックス
CREATE INDEX ON documents USING GIN (metadata);

-- 複合インデックス
CREATE INDEX ON documents (created_at, (metadata->>'domain'));
```

### キャッシュ戦略

```typescript
class CachedEmbeddings {
  private cache = new Map<string, number[]>();
  
  async embedText(text: string): Promise<number[]> {
    const hash = this.hashText(text);
    
    if (this.cache.has(hash)) {
      return this.cache.get(hash)!;
    }
    
    const embedding = await this.actualEmbed(text);
    this.cache.set(hash, embedding);
    
    return embedding;
  }
}
```

### バッチ処理

```typescript
// 大量ドキュメントの効率的な追加
async function addDocumentsBatch(documents: DocumentInput[]): Promise<void> {
  const batchSize = 50;
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    
    // 埋め込み生成（並列）
    const embeddings = await Promise.all(
      batch.map(doc => embeddings.embedText(doc.content))
    );
    
    // データベース保存（バッチ）
    await vectorStore.addDocumentsBatch(batch, embeddings);
  }
}
```

## 設定・環境変数

### 必要な環境変数

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# データベース
DATABASE_URL=postgresql://user:pass@localhost:5432/discord_rag_bot

# RAG設定
RAG_EMBEDDING_MODEL=text-embedding-ada-002
RAG_EMBEDDING_DIMENSION=1536
RAG_MAX_RESULTS=10
RAG_SIMILARITY_THRESHOLD=0.7
```

### 設定ファイル例

```typescript
export const ragConfig = {
  embeddings: {
    provider: 'openai' as const,
    model: process.env.RAG_EMBEDDING_MODEL || 'text-embedding-ada-002',
    dimension: parseInt(process.env.RAG_EMBEDDING_DIMENSION || '1536'),
    batchSize: 100
  },
  
  vectorStore: {
    tableName: 'documents',
    indexType: 'ivfflat',
    indexLists: 100
  },
  
  search: {
    defaultLimit: parseInt(process.env.RAG_MAX_RESULTS || '10'),
    defaultThreshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.7'),
    maxQueryLength: 2000
  }
};
```

## 開発・テスト

### ユニットテスト例

```typescript
describe('RAGSystem', () => {
  let rag: RAGSystem;
  
  beforeEach(() => {
    rag = new RAGSystem(testConfig);
  });
  
  test('ドキュメント追加', async () => {
    const id = await rag.addDocument('テストコンテンツ', {
      title: 'テスト',
      source: 'test://example'
    });
    
    expect(id).toBeDefined();
  });
  
  test('検索実行', async () => {
    await rag.addDocument('TypeScript 型定義', testMetadata);
    
    const result = await rag.findRelated('TypeScript');
    
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].similarity).toBeGreaterThan(0.5);
  });
});
```

### パフォーマンステスト

```typescript
describe('Performance', () => {
  test('大量検索のレスポンス時間', async () => {
    const start = Date.now();
    
    const result = await rag.findRelated('test query', {
      maxResults: 100
    });
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // 1秒以内
  });
});
```