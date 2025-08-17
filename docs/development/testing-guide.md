# テスト環境・開発ガイド

最終更新: 2025-08-17

## 🎯 概要

Discord RAG Botプロジェクトの包括的なテストガイド。Vitest + Testcontainersを使用した統合テスト環境について詳しく説明します。

## 📊 テスト全体状況

### テスト実行結果（67テスト通過）
```
total: 67テスト通過
├── discord-bot: テストファイルなし（要再構築🔄）
├── shared: 52テスト通過（全て通過✅）
│   ├── Database Schema: 13テスト
│   ├── LinkProcessor: 17テスト
│   ├── MessageFetcher: 16テスト
│   └── LLM Client: 6テスト
└── rag: 15テスト通過（全て通過✅）
    ├── SemanticChunker: 8テスト
    └── ResponseParser: 7テスト
```

## 🛠️ テスト技術スタック

### コアフレームワーク
- **Vitest 3.2.4**: 高速なTypeScript対応テストフレームワーク
- **Testcontainers 11.3.1**: 実際のPostgreSQLコンテナによる統合テスト
- **Docker**: テスト用PostgreSQL 16 + pgvector環境

### テストユーティリティ
- **vi.mock()**: モック・スパイ機能
- **expect.stringContaining()**: 柔軟なアサーション
- **setTimeout()**: 非同期処理待機

## 🐳 Testcontainers統合テスト

### 設定ファイル: `src/packages/shared/__tests__/helpers/database.ts`

```typescript
export async function getTestDatabase() {
  if (testDb) return testDb;
  
  // PostgreSQL + pgvectorコンテナ起動
  testContainer = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();
  
  const connectionString = testContainer.getConnectionUri();
  testClient = postgres(connectionString, { max: 1 });
  testDb = drizzle(testClient, { schema });
  
  // pgvector拡張有効化
  await testClient`CREATE EXTENSION IF NOT EXISTS vector`;
  
  // マイグレーション適用
  await migrate(testDb, {migrationsFolder: '../../../drizzle'});
  
  return testDb;
}
```

### テストデータクリーンアップ
```typescript
export async function clearTestData() {
  // 外部キー制約を考慮した順序で削除
  await testClient`DELETE FROM embeddings`;
  await testClient`DELETE FROM rag_queries`;
  await testClient`DELETE FROM init_jobs`;
  await testClient`DELETE FROM documents`;
  await testClient`DELETE FROM discord_messages`;
}
```

## 🧪 テストカテゴリ別詳細

### 1. Discord Bot テスト（要再構築）

**状況**: テストファイルが存在しない（再構築が必要）
**予定ファイル**: `src/apps/discord-bot/__tests__/commands/init-db.test.ts`

#### テスト分類
- **権限チェック** (3テスト): 管理者権限、DM実行、引数検証
- **カテゴリ検証** (2テスト): カテゴリ存在確認、名前取得
- **重複実行防止** (1テスト): 同時実行制御
- **正常処理** (2テスト): ジョブ作成、進捗コールバック
- **エラーハンドリング** (2テスト): API エラー、リンク処理エラー
- **引数処理** (1テスト): Discord ID記号除去

#### 重要なモック設定
```typescript
// データベースモック
vi.mock('@shared/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/database')>();
  return {
    ...actual,
    getDatabaseConnection: vi.fn(),
  };
});

// beforeEachでモック設定
beforeEach(async () => {
  const testDb = await getTestDatabase();
  vi.mocked(getDatabaseConnection).mockReturnValue(testDb);
});
```

### 2. LinkProcessor テスト（14テスト）

**ファイル**: `src/packages/shared/__tests__/content/link-processor.test.ts`

#### テスト分類
- **正常処理** (9テスト): コンテンツ抽出、並列処理、HTML解析
- **エラーハンドリング** (3テスト): HTTPエラー、ネットワークエラー、タイムアウト
- **フィルタリング** (2テスト): ブロックドメイン、価値判定

#### HTTPモック例
```typescript
// 成功レスポンス
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  headers: { get: () => 'text/html' },
  text: async () => '<html><head><title>Test</title>...'
});

// エラーレスポンス
global.fetch = vi.fn().mockResolvedValue({
  ok: false,
  status: 404,
  statusText: 'Not Found'
});
```

### 3. MessageFetcher テスト（16テスト）

**ファイル**: `src/packages/shared/__tests__/discord/message-fetcher.test.ts`

#### テスト分類
- **メッセージ取得** (6テスト): 単一・複数チャンネル、進捗コールバック
- **リンク抽出** (3テスト): HTTPS・HTTP、リンクなし
- **権限・検証** (4テスト): カテゴリアクセス、名前取得
- **エラーハンドリング** (3テスト): APIエラー、権限エラー、タイムアウト

#### Discord.js モック
```typescript
const mockClient = {
  channels: {
    fetch: vi.fn().mockResolvedValue(mockCategory)
  }
};

const mockCategory = {
  type: ChannelType.GuildCategory,
  children: {
    cache: new Map([
      ['channel1', mockTextChannel],
      ['channel2', mockTextChannel]
    ])
  }
};
```

### 4. Database Schema テスト（13テスト）

**ファイル**: `src/packages/shared/__tests__/database/schema.test.ts`

#### テスト分類
- **テーブル作成・削除** (5テスト): 各テーブルのCRUD操作
- **制約・インデックス** (4テスト): 外部キー、NOT NULL、ユニーク制約
- **pgvector機能** (2テスト): ベクトル挿入・検索
- **マイグレーション** (2テスト): スキーマ変更、データ移行

## 🔧 テスト実行方法

### 基本コマンド
```bash
# 全テスト実行
npm test

# 特定パッケージのテスト
npm test --workspace=src/apps/discord-bot
npm test --workspace=src/packages/shared

# 監視モード（ファイル変更時に自動実行）
npm run test:watch

# UI付きテスト実行
npm run test:ui
```

### 環境要件
- **Docker**: Testcontainers用（必須）
- **Node.js**: 18.x以上
- **Memory**: 2GB以上推奨（PostgreSQLコンテナ用）

## ⚠️ 注意事項・トラブルシューティング

### よくある問題

#### 1. ESモジュールエラー
```
Error: Directory import is not supported
```
**解決方法**: `src/packages/shared/src/index.ts`でファイル拡張子を明示
```typescript
export * from './types/index.js';  // .js必要
```

#### 2. データベースモックエラー
```
TypeError: db.select is not a function
```
**解決方法**: 正しいDrizzle DBインスタンスをモック
```typescript
vi.mocked(getDatabaseConnection).mockReturnValue(testDb);
```

#### 3. Dockerコンテナ起動エラー
```
Error: Could not start container
```
**解決方法**: 
- Docker Desktopが起動しているか確認
- メモリ不足の場合は他のコンテナを停止

#### 4. テストタイムアウト
**設定**: `vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    timeout: 30000,  // 30秒
    setupFiles: ['./src/__tests__/setup.ts']
  }
});
```

### デバッグのヒント

#### 詳細ログ出力
```typescript
// テスト中のログ確認
console.log('🧹 Test data cleared');
console.log('✅ Test database setup completed');
```

#### 非同期処理の待機
```typescript
// 処理完了まで待機
await new Promise(resolve => setTimeout(resolve, 100));

// データベース確認
const jobs = await db.execute('SELECT * FROM init_jobs');
expect(jobs.length).toBeGreaterThan(0);
```

## 🚀 今後の改善計画

### テスト拡張予定
1. **E2Eテスト**: 実際のDiscord Bot動作テスト
2. **パフォーマンステスト**: 大量データ処理能力
3. **セキュリティテスト**: 権限・入力検証
4. **CI/CD統合**: GitHub Actions自動テスト

### 品質指標目標
- **カバレッジ**: 90%以上
- **テスト実行時間**: 30秒以内
- **テスト安定性**: 99.5%以上の成功率

---

**このテスト環境により、プロダクション品質のコード品質が保証されています。新機能追加時は必ずテストを併せて実装してください。**