# ESモジュール完全移行ガイド

最終更新: 2025-07-21

## 🎯 概要

Discord RAG BotプロジェクトのESモジュール（ECMAScript Modules）完全移行について詳しく解説します。このガイドはTypeScript 5.8.3 + ES2022環境での実装とベストプラクティスを提供します。

## ✅ 移行完了状況

### 完全移行済み（2025-07-21）
- **全パッケージ**: `"type": "module"` 設定完了
- **TypeScript設定**: ES2022 + ESNext統一
- **ビルドシステム**: ESM対応完了
- **テスト環境**: Vitest 3.2.4完全対応
- **54テスト全通過**: 統合テスト含む

## 🛠️ 技術設定詳細

### 1. ルートTypeScript設定

**ファイル**: `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",           // 最新ES機能使用
    "module": "ESNext",           // ESモジュール出力
    "moduleResolution": "bundler", // バンドラー最適化
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,              // ルートではコンパイルしない
    "resolveJsonModule": true,
    "allowJs": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["./src/packages/shared/src/*"],
      "@rag/*": ["./src/packages/rag/src/*"]
    }
  }
}
```

### 2. 各パッケージ設定

#### package.json設定例
```json
{
  "name": "@shared/core",
  "type": "module",              // ESモジュール有効化
  "main": "dist/index.js",       // ESM形式のエントリ
  "types": "dist/index.d.ts",    // 型定義
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  }
}
```

#### 個別tsconfig.json
```json
{
  "extends": "../../../tsconfig.json",  // ルート設定継承
  "compilerOptions": {
    "outDir": "./dist",          // ビルド出力先
    "noEmit": false,            // コンパイル有効
    "declaration": true,        // .d.ts生成
    "declarationMap": true     // ソースマップ
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 🚧 ESモジュール特有の制約と対処法

### 1. ファイル拡張子の問題

#### 問題
```bash
Error: Directory import '/path/to/types' is not supported resolving ES modules
```

#### 原因
Node.js ESモジュールでは明示的なファイル拡張子が必要な場合がある

#### 解決方法
```typescript
// ❌ 従来の書き方
export * from './types';
export * from './database';

// ✅ ESモジュール対応
export * from './types/index.js';    // .js拡張子が必要
export * from './database/index.js';
```

### 2. モジュール解決の設定

#### moduleResolution設定の選択

**bundler** (推奨 - 現在使用)
```json
{
  "moduleResolution": "bundler"
}
```
- バンドラー環境に最適化
- TypeScript最新機能フル活用
- パフォーマンス最適

**node** (代替案)
```json
{
  "moduleResolution": "node"
}
```
- 純粋なNode.js環境用
- より厳密なESモジュール仕様準拠

### 3. インポート・エクスポートパターン

#### 推奨パターン
```typescript
// 名前付きエクスポート（推奨）
export { MessageFetcher } from './discord/message-fetcher.js';
export { LinkProcessor } from './content/link-processor.js';
export * from './database/index.js';

// 型のみインポート
import type { MessageData } from '@shared/types';
import type { ProcessedContent } from '@shared/content';

// デフォルトエクスポート（最小限に）
export default class InitDbCommand {
  // ...
}
```

## 🧪 テスト環境でのESM対応

### Vitest設定

**ファイル**: `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts']
  },
  resolve: {
    alias: {
      '@shared': new URL('./src/packages/shared/src', import.meta.url).pathname,
      '@rag': new URL('./src/packages/rag/src', import.meta.url).pathname
    }
  }
});
```

### モック対応
```typescript
// ESモジュール対応モック
vi.mock('@shared/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/database')>();
  return {
    ...actual,
    getDatabaseConnection: vi.fn(),
  };
});
```

## 🔧 トラブルシューティング

### よくあるエラーと解決方法

#### 1. Cannot access before initialization
```bash
ReferenceError: Cannot access '__vi_import_3__' before initialization
```

**原因**: モックファクトリー内でトップレベル変数を使用

**解決方法**:
```typescript
// ❌ エラーが出る書き方
vi.mock('@shared/database', () => ({
  getDatabaseConnection: () => getTestDatabase(),  // トップレベル関数呼び出し
}));

// ✅ 正しい書き方
vi.mock('@shared/database', () => ({
  getDatabaseConnection: vi.fn(),
}));

// beforeEachで設定
beforeEach(async () => {
  const testDb = await getTestDatabase();
  vi.mocked(getDatabaseConnection).mockReturnValue(testDb);
});
```

#### 2. Module not found
```bash
Cannot find module '@shared/core'
```

**原因**: パスマッピングまたはworkspaces設定の問題

**解決方法**:
```json
// package.jsonのworkspaces確認
{
  "workspaces": [
    "src/apps/*",
    "src/packages/*"
  ]
}

// tsconfig.jsonのpaths確認
{
  "paths": {
    "@shared/*": ["./src/packages/shared/src/*"]
  }
}
```

#### 3. Type import errors
```bash
Cannot use import statement outside a module
```

**解決方法**: `"type": "module"`の確認
```json
{
  "type": "module"
}
```

## 📦 npm workspaces統合

### workspace依存関係
```json
// パッケージ間依存
{
  "dependencies": {
    "@shared/core": "*",     // workspace内参照
    "@rag/core": "*"
  }
}
```

### ビルド順序管理
```json
// ルートpackage.json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm test --workspaces",
    "type-check": "npm run type-check --workspaces"
  }
}
```

## 🚀 パフォーマンス最適化

### 1. Tree Shakingの活用
```typescript
// 個別インポートでバンドルサイズ削減
import { eq, and } from 'drizzle-orm';           // ✅ 必要な関数のみ
import * as drizzleOrm from 'drizzle-orm';       // ❌ 全体インポート
```

### 2. 動的インポート
```typescript
// 必要時のみ読み込み
const { LinkProcessor } = await import('@shared/content/link-processor');
```

### 3. バンドラー最適化
- **moduleResolution: "bundler"**: 最適化されたモジュール解決
- **target: "ES2022"**: 最新JavaScript機能活用
- **ツリーシェイキング**: 未使用コード自動除去

## ⚠️ 注意事項・制約

### 1. CommonJS互換性
```typescript
// ❌ CommonJS構文は使用禁止
const module = require('./module');
module.exports = { };

// ✅ ESモジュール構文のみ
import module from './module.js';
export { };
```

### 2. __dirname / __filename
```typescript
// ❌ CommonJS変数は利用不可
console.log(__dirname);

// ✅ ESモジュール代替
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### 3. JSON インポート
```typescript
// ✅ アサーション付きインポート
import packageJson from './package.json' with { type: 'json' };

// または設定でresolveJsonModule有効化
import packageJson from './package.json';
```

## 🎯 今後の展開

### 次の最適化目標
1. **Bundle分析**: webpack-bundle-analyzer等での最適化
2. **Lazy Loading**: 動的インポートによる初期化高速化
3. **Code Splitting**: 機能別バンドル分割

### 標準準拠
- **ES2023対応**: 最新言語機能採用検討
- **Import Maps**: ブラウザ環境での最適化
- **Web Standards**: より標準準拠な実装

---

**ESモジュール完全移行により、モダンなJavaScript開発環境が整備され、パフォーマンスと保守性が大幅に向上しました。新機能開発時はこのガイドに沿ってESM準拠の実装を行ってください。**