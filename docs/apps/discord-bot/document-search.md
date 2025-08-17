# ドキュメント検索システム

最終更新: 2025-08-16

## 概要

Discord RAG Botのドキュメント検索システムは、PostgreSQLデータベースに保存されたWebコンテンツから部分一致検索を行う機能です。RAGシステムから高速でシンプルな検索システムに変更されました。

## アーキテクチャ

### システム構成

```
Discord Bot (search.ts)
     ↓
DocumentSearchService
     ↓
PostgreSQL (source_documents)
```

### 主要コンポーネント

1. **SearchCommand** (`src/apps/discord-bot/src/commands/search.ts`)
   - Discord `!search` コマンドの実装
   - ユーザー入力の検証
   - 検索結果の表示

2. **DocumentSearchService** (`src/apps/discord-bot/src/services/document-search.service.ts`)
   - 検索ロジックの実装
   - データベースクエリの実行
   - 結果の整形

3. **型定義** (`src/packages/shared/src/types/index.ts`)
   - `DocumentSearchResult`: 検索結果の型
   - `DocumentSearchResponse`: 検索レスポンスの型

## 検索機能

### 対応する検索パターン

- **単一キーワード検索**: `!search TypeScript`
- **複数キーワード検索**: `!search TypeScript エラー処理`
- **大文字小文字を区別しない検索**: `ILIKE` オペレータを使用

### 検索対象フィールド

- `source_documents.title`: ドキュメントのタイトル
- `source_documents.fullContent`: ドキュメントの本文

### 検索ロジック

```sql
-- 複数キーワードのAND検索例
WHERE (
  (title ILIKE '%keyword1%' OR fullContent ILIKE '%keyword1%')
  AND (title ILIKE '%keyword2%' OR fullContent ILIKE '%keyword2%')
)
ORDER BY title_match_score DESC, created_at DESC
LIMIT 5
```

### ソート順

1. **タイトルマッチ優先**: タイトルにキーワードが含まれる場合優先
2. **作成日降順**: 新しいドキュメント順

## 使用方法

### Discord コマンド

```
!search <検索クエリ>
```

**例:**
- `!search JavaScript`
- `!search React Hook useState`
- `!search データベース 接続`

### 検索結果表示

検索結果は Discord Embed として表示され、以下の情報を含みます：

- **検索統計**
  - 検索時間（ミリ秒）
  - 発見件数
  - 総ドキュメント数

- **検索結果** (最大5件)
  - ドキュメントタイトル
  - URL
  - ドメイン
  - 内容の一部（200文字まで）
  - メッセージID（該当する場合）

### 結果がない場合

```
❌ 結果なし
関連するドキュメントが見つかりませんでした。別のキーワードで検索してみてください。
```

## 実装詳細

### DocumentSearchService の主要メソッド

#### `searchDocuments(query: string): Promise<DocumentSearchResponse>`

メインの検索メソッド

**パラメータ:**
- `query`: 検索クエリ文字列

**戻り値:**
- `DocumentSearchResponse`: 検索結果とメタデータ

**処理フロー:**
1. クエリを空白で分割
2. 各キーワードに対する検索条件を構築
3. タイトルマッチスコアを計算
4. データベースクエリを実行
5. 結果を整形して返却

#### `getDocumentCount(): Promise<number>`

データベース内の総ドキュメント数を取得

#### `truncateContent(content: string, maxLength: number): string`

表示用にコンテンツを短縮

### 型定義

```typescript
export interface DocumentSearchResult {
  id: number;
  title: string | null;
  content: string;
  url: string;
  metadata: Record<string, any> | null;
  messageId: string | null;
  channelId: string | null;
  authorId: string | null;
  createdAt: Date;
}

export interface DocumentSearchResponse {
  results: DocumentSearchResult[];
  total: number;
  query: string;
  processingTime: number;
}
```

## パフォーマンス

### インデックス

`source_documents` テーブルには以下のインデックスが設定されています：

- `source_documents_url_idx`: URL フィールド
- `source_documents_message_id_idx`: メッセージID フィールド  
- `source_documents_created_at_idx`: 作成日時フィールド

### 最適化

- **LIMIT 5**: 結果を上位5件に制限
- **ILIKE オペレータ**: PostgreSQLネイティブの高速文字列検索
- **タイトル優先ソート**: 関連度の高い結果を優先表示

## エラーハンドリング

### 検索エラー

```typescript
try {
  const results = await this.db.select(...)...
} catch (error) {
  console.error('Document search error:', error);
  return {
    results: [],
    total: 0,
    query,
    processingTime: Date.now() - startTime,
  };
}
```

### 入力検証

- **最小文字数**: 2文字以上
- **最大文字数**: 200文字以内
- **空クエリ**: エラーメッセージ表示

## 設定とカスタマイズ

### 設定可能な項目

- **結果件数制限**: 現在は5件固定、将来的に設定可能
- **コンテンツ短縮長**: 現在は300文字、カスタマイズ可能
- **検索対象フィールド**: title, fullContent から選択可能

### 環境要件

- PostgreSQL 12以上
- Node.js 18以上
- Drizzle ORM 0.44.3以上

## 今後の機能拡張

### 予定している改善

1. **検索結果のハイライト表示**
   - マッチしたキーワードの強調表示

2. **ページネーション**
   - 大量の検索結果の分割表示

3. **検索履歴の保存**
   - `rag_queries` テーブルへの検索ログ保存

4. **フィルタリング機能**
   - ドメイン別、日付別の絞り込み

5. **検索提案**
   - 類似クエリの提案機能

## トラブルシューティング

### よくある問題

1. **検索結果が表示されない**
   - データベース接続を確認
   - `source_documents` テーブルにデータが存在するか確認

2. **検索が遅い**
   - インデックスの状態を確認
   - データベースの統計情報を更新

3. **文字化け**
   - データベースとアプリケーションの文字エンコーディング設定を確認

### デバッグ方法

```typescript
// ログ出力の有効化
console.log('Search query logged:', {
  query,
  userId,
  guildId,
  resultCount: searchResponse.results.length,
  processingTime: searchResponse.processingTime,
});
```

## 関連ファイル

- **実装**: `src/apps/discord-bot/src/services/document-search.service.ts`
- **コマンド**: `src/apps/discord-bot/src/commands/search.ts`
- **型定義**: `src/packages/shared/src/types/index.ts`
- **データベーススキーマ**: `src/packages/shared/src/database/schema.ts`
- **テスト**: 今後実装予定