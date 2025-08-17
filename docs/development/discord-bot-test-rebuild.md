# Discord Bot テスト再構築ガイド

最終更新: 2025-08-17

## 🎯 概要

Discord Botパッケージのテストファイルが失われているため、テストカバレッジの再構築が必要です。このドキュメントでは、テスト再構築のプロセスと計画を説明します。

## 📊 現在の状況

### テスト状況比較
- **shared**: 52テスト通過 ✅ 
- **rag**: 15テスト通過 ✅
- **discord-bot**: テストファイルなし ❌

### 失われたテストファイル
- `src/apps/discord-bot/__tests__/commands/init-db.test.ts`
- `src/apps/discord-bot/__tests__/commands/search.test.ts`
- `src/apps/discord-bot/__tests__/services/document-search.service.test.ts`

## 🔧 再構築計画

### 1. 最優先テスト（init-dbコマンド）

#### テストファイル: `init-db.test.ts`
```typescript
describe('InitDbCommand', () => {
  describe('権限チェック', () => {
    it('管理者権限なしでコマンド実行時にエラーメッセージを返す')
    it('DM内での実行時にエラーメッセージを返す')
    it('引数が不足している場合にエラーメッセージを返す')
  })

  describe('カテゴリ検証', () => {
    it('存在しないカテゴリIDに対してエラーメッセージを返す')
    it('アクセス権限のないカテゴリに対してエラーメッセージを返す')
    it('有効なカテゴリの名前を正しく取得する')
  })

  describe('重複実行防止', () => {
    it('既存の処理中ジョブがある場合に実行を拒否する')
  })

  describe('正常処理', () => {
    it('管理者による正常なコマンド実行でジョブを作成する')
    it('進捗コールバックが正しく動作する')
  })

  describe('エラーハンドリング', () => {
    it('Discord API エラー時に適切なエラー処理を行う')
    it('データベースエラー時に適切なエラー処理を行う')
  })
})
```

### 2. 検索機能テスト（searchコマンド）

#### テストファイル: `search.test.ts`
```typescript
describe('SearchCommand', () => {
  describe('入力検証', () => {
    it('引数なしでヘルプメッセージを表示する')
    it('2文字未満のクエリでエラーメッセージを返す')
    it('200文字超のクエリでエラーメッセージを返す')
  })

  describe('検索実行', () => {
    it('単一キーワードで正常に検索する')
    it('複数キーワードでAND検索を実行する')
    it('検索結果をEmbed形式で表示する')
    it('検索結果がない場合に適切なメッセージを表示する')
  })

  describe('データベース連携', () => {
    it('ドキュメント数が0の場合に初期化メッセージを表示する')
    it('検索ログを正しく記録する')
  })
})
```

### 3. DocumentSearchService テスト

#### テストファイル: `document-search.service.test.ts`
```typescript
describe('DocumentSearchService', () => {
  describe('searchDocuments', () => {
    it('単一キーワードで部分一致検索を実行する')
    it('複数キーワードでAND検索を実行する')
    it('タイトルマッチを優先してソートする')
    it('結果を5件に制限する')
    it('コンテンツを適切に短縮する')
  })

  describe('getDocumentCount', () => {
    it('データベース内のドキュメント総数を返す')
    it('空のデータベースで0を返す')
  })

  describe('エラーハンドリング', () => {
    it('データベースエラー時に空の結果を返す')
    it('不正なクエリに対して適切に処理する')
  })
})
```

## 🛠️ 実装手順

### ステップ1: テスト環境セットアップ
```bash
# Discord Botワークスペースに移動
cd src/apps/discord-bot

# テストディレクトリ作成
mkdir -p __tests__/commands __tests__/services

# テスト設定ファイル確認
ls vitest.config.ts
```

### ステップ2: 依存関係とモック設定
```typescript
// テストセットアップ
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { getDatabaseConnection } from '@shared/core'
import { getTestDatabase, clearTestData } from '@shared/core/__tests__/helpers/database'

// モック設定
vi.mock('@shared/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/core')>()
  return {
    ...actual,
    getDatabaseConnection: vi.fn(),
  }
})
```

### ステップ3: Discord.js モック
```typescript
// Discord.js のモック
const mockMessage = {
  reply: vi.fn(),
  author: { id: 'test-user-id' },
  guild: { id: 'test-guild-id' },
  member: {
    permissions: {
      has: vi.fn().mockReturnValue(true) // 管理者権限あり
    }
  }
}

const mockClient = {
  channels: {
    fetch: vi.fn().mockResolvedValue(mockCategory)
  }
}
```

### ステップ4: テスト実行・検証
```bash
# テスト実行
npm test

# カバレッジ確認
npm run test:coverage
```

## 📈 期待される結果

### テスト実行後の状況
```
total: 80+テスト通過
├── discord-bot: 20+テスト通過 ✅
│   ├── init-db: 11テスト
│   ├── search: 6テスト
│   └── services: 5テスト
├── shared: 52テスト通過 ✅
└── rag: 15テスト通過 ✅
```

### カバレッジ目標
- **全体カバレッジ**: 85%以上
- **重要コマンド**: 95%以上
- **サービス層**: 90%以上

## ⚠️ 重要な考慮事項

### 1. 既存機能との整合性
- 現在の実装ファイルに基づいてテストを作成
- `init-db-refactored.ts` の実装に合わせる
- `search.ts` の機能に合わせる

### 2. Testcontainers統合
- sharedパッケージと同じデータベースヘルパーを使用
- PostgreSQL + pgvectorコンテナでの統合テスト
- データクリーンアップの適切な実装

### 3. モック戦略
- Discord.js の適切なモック
- 外部依存関係の分離
- 実際のAPI呼び出しの回避

## 🔄 継続的な改善

### 今後の拡張
1. **E2Eテスト**: 実際のDiscord環境でのテスト
2. **パフォーマンステスト**: 大量データでの処理性能
3. **CI/CD統合**: GitHub Actionsでの自動テスト

### メンテナンス
- 新機能追加時のテスト追加
- リファクタリング時のテスト更新
- 定期的なテスト実行とカバレッジ確認

---

**この再構築により、Discord Botの品質保証とリグレッション防止が実現されます。優先度順にテストを実装し、段階的にカバレッジを向上させていきます。**