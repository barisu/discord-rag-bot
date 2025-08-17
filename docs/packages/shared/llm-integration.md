# LLM統合システム

最終更新: 2025-07-24

## 概要

Discord RAG BotのLLM統合システムは、依存注入による交換可能なLLMクライアント設計を提供します。現在はGoogle Gemini 2.5 Flashを実装し、将来的な他のLLMプロバイダー追加に対応できる柔軟なアーキテクチャを採用しています。

## アーキテクチャ

### 設計思想

- **依存注入**: 具体的なLLM実装への依存を排除
- **インターフェース駆動**: 抽象化により実装の交換を容易に
- **エラーハンドリング**: 統一されたエラー処理による信頼性向上
- **型安全性**: TypeScriptによる厳格な型チェック

### コンポーネント構成

```
src/packages/shared/src/llm/
├── llm-client.ts      # 抽象インターフェース定義
└── gemini-client.ts   # Gemini 2.5 Flash実装
```

## コアインターフェース

### LLMClient

すべてのLLM実装が準拠する基本インターフェース。

```typescript
export interface LLMClient {
  generateText(prompt: string, options?: LLMOptions): Promise<string>;
}

export interface LLMOptions {
  temperature?: number;  // 創造性パラメータ（0.0-1.0）
  maxTokens?: number;    // 最大生成トークン数
  model?: string;        // 使用モデル名（オプション）
}
```

**設計原則:**
- **シンプルさ**: 最小限の必要なメソッドのみ
- **柔軟性**: オプションによる細かい制御
- **非同期**: すべての操作をPromiseベース

### LLMError

LLM操作に関する統一されたエラー処理。

```typescript
export class LLMError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
```

**エラーコード分類:**
- `API_KEY_INVALID`: 認証エラー
- `QUOTA_EXCEEDED`: レート制限・クォータ超過
- `REQUEST_TIMEOUT`: リクエストタイムアウト
- `UNKNOWN_ERROR`: その他のエラー

## Gemini 2.5 Flash実装

### GeminiClient

Google Gemini 2.5 FlashのLLMClient実装。

```typescript
export class GeminiClient implements LLMClient {
  private client: GoogleGenAI;
  private defaultModel = 'gemini-2.5-flash';

  constructor(apiKey: string) {
    this.client = new GoogleGenAI(apiKey);
  }

  async generateText(prompt: string, options?: LLMOptions): Promise<string>
}
```

### 主要機能

1. **高度なテキスト生成**
   - 自然な日本語処理
   - コンテキスト理解
   - 構造化出力（JSON形式）

2. **エラー処理**
   - API固有エラーの統一形式変換
   - リトライ機能（将来実装予定）
   - 詳細なログ出力

3. **パフォーマンス最適化**
   - デフォルトパラメータの最適化
   - レスポンス時間の最小化

### 実装例

```typescript
import { GeminiClient } from '@shared/core';

// クライアント初期化
const client = new GeminiClient(process.env.GEMINI_API_KEY!);

// 基本的なテキスト生成
const response = await client.generateText(
  "以下のテキストを要約してください: ...",
  {
    temperature: 0.1,  // 低い創造性（事実重視）
    maxTokens: 1000
  }
);

console.log(response);
```

## 使用例

### セマンティックチャンキングでの使用

```typescript
import { SemanticChunker } from '@rag/core';
import { GeminiClient } from '@shared/core';

// 依存注入による柔軟な設計
const llmClient = new GeminiClient(apiKey);
const chunker = new SemanticChunker(llmClient);

const chunks = await chunker.chunk(longText);
```

### 将来的な拡張例

```typescript
// 他のLLMプロバイダーの追加
import { OpenAIClient } from '@shared/core';  // 将来実装
import { ClaudeClient } from '@shared/core';  // 将来実装

// 同じインターフェースで交換可能
const llmClient = new OpenAIClient(apiKey);
const chunker = new SemanticChunker(llmClient);
```

## 設定管理

### 環境変数

```bash
# .env または .env.test
GEMINI_API_KEY=your_gemini_api_key_here
```

### 設定例

```typescript
// デフォルト設定
const defaultOptions: LLMOptions = {
  temperature: 0.1,     // 低い創造性（事実重視）
  maxTokens: 4000,      // 十分な出力長
  model: 'gemini-2.5-flash'
};

// カスタム設定
const creativeOptions: LLMOptions = {
  temperature: 0.8,     // 高い創造性
  maxTokens: 2000,
  model: 'gemini-2.5-flash'
};
```

## テスト設計

### テストカバレッジ (6テスト)

1. **正常系テスト**
   - 基本的なテキスト生成
   - カスタムオプション使用
   - JSON形式レスポンス処理

2. **異常系テスト**
   - API key不正エラー
   - クォータ超過エラー
   - タイムアウトエラー
   - 不明なエラー

### テスト実装

```typescript
describe('GeminiClient', () => {
  let client: GeminiClient;

  beforeEach(() => {
    client = new GeminiClient('test-api-key');
  });

  it('should generate text successfully', async () => {
    const result = await client.generateText('Test prompt');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should handle API errors gracefully', async () => {
    await expect(client.generateText('test'))
      .rejects.toThrow(LLMError);
  });
});
```

## パフォーマンス特性

### レスポンス時間
- **短いプロンプト** (100文字以下): 0.5-1.5秒
- **中程度のプロンプト** (1000文字程度): 1-3秒  
- **長いプロンプト** (3000文字以上): 2-5秒

### レート制限
- **Gemini 2.5 Flash**: 60 RPM (リクエスト/分)
- **クォータ**: API keyに依存
- **同時実行**: 推奨最大5並列

### メモリ使用量
- **クライアント初期化**: 最小限
- **リクエスト処理**: プロンプト + レスポンスサイズ
- **メモリリーク**: なし（適切なリソース管理）

## エラーハンドリング

### エラー分類と対処

1. **認証エラー (API_KEY_INVALID)**
   ```typescript
   try {
     const response = await client.generateText(prompt);
   } catch (error) {
     if (error.code === 'API_KEY_INVALID') {
       console.error('Gemini API key が無効です');
       // 設定確認をユーザーに促す
     }
   }
   ```

2. **クォータ超過 (QUOTA_EXCEEDED)**
   ```typescript
   try {
     const response = await client.generateText(prompt);
   } catch (error) {
     if (error.code === 'QUOTA_EXCEEDED') {
       console.warn('API利用制限に達しました。しばらく待ってから再試行してください');
       // 指数バックオフによるリトライ
     }
   }
   ```

3. **タイムアウト (REQUEST_TIMEOUT)**
   ```typescript
   try {
     const response = await client.generateText(prompt);
   } catch (error) {
     if (error.code === 'REQUEST_TIMEOUT') {
       console.warn('リクエストがタイムアウトしました');
       // より短いプロンプトでリトライ
     }
   }
   ```

## セキュリティ考慮事項

### API Key管理
- **環境変数**: .envファイルで管理
- **リポジトリ除外**: .gitignoreで秘匿情報を保護
- **ローテーション**: 定期的なAPI key更新

### データプライバシー
- **ログ制限**: プロンプト内容の詳細ログ出力を制限
- **一時保存**: レスポンスの長期保存を避ける
- **暗号化**: 必要に応じた通信暗号化

## 将来の拡張計画

### 予定LLMプロバイダー

1. **OpenAI GPT-4**
   ```typescript
   export class OpenAIClient implements LLMClient {
     async generateText(prompt: string, options?: LLMOptions): Promise<string>
   }
   ```

2. **Anthropic Claude**
   ```typescript
   export class ClaudeClient implements LLMClient {
     async generateText(prompt: string, options?: LLMOptions): Promise<string>
   }
   ```

3. **ローカルLLM**
   ```typescript
   export class LocalLLMClient implements LLMClient {
     async generateText(prompt: string, options?: LLMOptions): Promise<string>
   }
   ```

### 機能拡張

1. **リトライ機能**
   - 指数バックオフ
   - 最大リトライ回数設定
   - エラー種別による戦略変更

2. **キャッシュ機能**
   - プロンプトハッシュによるキャッシュ
   - TTL設定
   - メモリ効率化

3. **バッチ処理**
   - 複数プロンプトの並列処理
   - レート制限を考慮した分散実行

4. **メトリクス収集**
   - レスポンス時間追跡
   - 成功/失敗率
   - 使用量統計

## 関連ドキュメント

- [セマンティックチャンキングシステム](../rag/chunking-system.md)
- [Gemini API設定ガイド](./gemini-setup.md)
- [エラーハンドリングガイド](./error-handling.md)
- [テスト実行ガイド](../../testing-guide.md)