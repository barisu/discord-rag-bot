# セマンティックチャンキングシステム

最終更新: 2025-07-24

## 概要

Discord RAG Botのセマンティックチャンキングシステムは、長文テキストを意味的に自然な境界で分割する機能を提供します。Google Gemini 2.5 Flashを活用したLLMベースの分割と、フォールバック機能による堅牢な処理を実現しています。

## アーキテクチャ

### コンポーネント構成

```
src/packages/rag/src/chunking/
├── index.ts                   # エクスポート定義
├── semantic-chunker.ts        # メインチャンキング実装
└── response-parser.ts         # LLMレスポンス解析
```

### 依存関係

```
SemanticChunker
├── LLMClient (from @shared/core)
│   └── GeminiClient (Gemini 2.5 Flash実装)
└── ResponseParser (純粋関数)
```

## 主要クラス・インターフェース

### SemanticChunker

テキストのセマンティック分割を担当するメインクラス。

```typescript
export class SemanticChunker {
  constructor(private llmClient: LLMClient) {}
  
  async chunk(text: string, options?: ChunkingOptions): Promise<TextChunk[]>
}
```

**主要機能:**
- LLMを使用した意味的境界での文章分割
- フォールバック機能（段落分割）
- カスタマイズ可能なチャンクサイズ・言語設定
- 空チャンクの自動フィルタリング

### ChunkingOptions

チャンキング動作をカスタマイズするオプション。

```typescript
export interface ChunkingOptions {
  maxChunkSize?: number;    // 最大チャンクサイズ（デフォルト: 1000文字）
  language?: string;        // 言語設定（デフォルト: '日本語'）
}
```

### TextChunk

チャンキング結果の出力形式。

```typescript
export interface TextChunk {
  content: string;  // チャンクのテキスト内容
  index: number;    // チャンクのインデックス（0から開始）
}
```

## LLMプロンプト設計

### プロンプト構造

```typescript
const prompt = `以下のテキストを意味的に自然な境界で分割してください。

要件:
- 各チャンクは概ね${maxChunkSize}文字以下にする
- ${language}の文章構造を考慮する
- 文の途中で切らない
- 意味的に関連する内容は同じチャンクに含める
- 結果はJSON形式で返す

形式:
{
  "chunks": [
    {"content": "チャンク1の内容", "index": 0},
    {"content": "チャンク2の内容", "index": 1}
  ]
}

テキスト:
${text}`;
```

**設計思想:**
- **意味的境界**: 文の途中ではなく、自然な文章区切りで分割
- **言語対応**: 日本語の文章構造を考慮した分割
- **構造化出力**: JSON形式による一貫したレスポンス形式
- **サイズ制御**: 指定された最大文字数を目安にした分割

## フォールバック機能

LLMによる分割が失敗した場合の堅牢な処理。

### フォールバック戦略

1. **LLM分割失敗検出**
   - API呼び出しエラー
   - JSONパースエラー  
   - 不正なレスポンス形式

2. **段落分割による代替処理**
   ```typescript
   private fallbackToSimpleSplit(text: string): TextChunk[] {
     return text
       .split(/\n\s*\n/)  // 空行区切り
       .map(paragraph => paragraph.trim())
       .filter(paragraph => paragraph.length > 0)
       .map((content, index) => ({ content, index }));
   }
   ```

3. **単一チャンク処理**
   - 段落分割でも分割できない場合
   - 元テキストを単一チャンクとして返却

## 実装例

### 基本的な使用方法

```typescript
import { SemanticChunker } from '@rag/core';
import { GeminiClient } from '@shared/core';

// LLMクライアントの初期化
const llmClient = new GeminiClient(apiKey);
const chunker = new SemanticChunker(llmClient);

// テキストをチャンク化
const text = "長い技術文書のテキスト...";
const chunks = await chunker.chunk(text);

console.log(`${chunks.length}個のチャンクに分割されました`);
chunks.forEach((chunk, i) => {
  console.log(`チャンク${i}: ${chunk.content.substring(0, 100)}...`);
});
```

### カスタムオプション付き使用例

```typescript
const options = {
  maxChunkSize: 500,    // 500文字以下
  language: '英語'      // 英語文章として処理
};

const chunks = await chunker.chunk(text, options);
```

## テスト設計

### テストカバレッジ (8テスト)

1. **正常系テスト**
   - 基本的なチャンク化動作
   - カスタムオプションの適用
   - 複数チャンクの生成

2. **異常系テスト**  
   - LLM API失敗時のフォールバック
   - 空チャンクのフィルタリング
   - 不正JSONレスポンス処理

3. **実用的テストケース**
   - 長い技術文書の分割
   - 対話形式テキストの処理
   - 複数話題混在記事の分割

### テスト実行

```bash
# RAGパッケージのテスト実行
npm test --workspace=src/packages/rag

# 特定テストファイルの実行
npm test --workspace=src/packages/rag -- semantic-chunker.test.ts
```

## パフォーマンス特性

### 処理時間
- **LLM分割**: 1-3秒（テキスト長により変動）
- **フォールバック**: 1ms未満（即座に完了）

### メモリ使用量
- **チャンク生成**: テキストサイズの1.5-2倍程度
- **中間処理**: 最小限の一時オブジェクト生成

### スケーラビリティ考慮
- **同期処理**: 単一テキストの逐次処理
- **バッチ処理**: 将来的な複数テキスト同時処理に対応可能

## エラーハンドリング

### エラー分類

1. **LLM APIエラー**
   - 認証エラー: API key不正
   - レート制限: クォータ超過
   - ネットワークエラー: 接続失敗

2. **レスポンス処理エラー**
   - JSONパースエラー: 不正な形式
   - スキーマエラー: 期待形式と不一致

3. **入力検証エラー**
   - 空テキスト: 入力なし
   - 長すぎるテキスト: LLM制限超過

### エラー処理フロー

```typescript
try {
  // LLM分割試行
  const response = await this.llmClient.generateText(prompt, options);
  const chunks = parseChunkingResponse(response);
  return this.filterEmptyChunks(chunks);
} catch (error) {
  console.warn('LLM chunking failed, falling back to simple paragraph splitting:', error);
  return this.fallbackToSimpleSplit(text);
}
```

## 将来の拡張計画

### 予定機能

1. **チャンク品質評価**
   - 意味的一貫性スコア
   - チャンクサイズ分布分析

2. **高度な分割戦略**
   - 階層的チャンキング
   - 重複チャンク生成（コンテキスト保持）

3. **多言語対応強化**
   - 言語自動検出
   - 言語別最適化プロンプト

4. **バッチ処理機能**
   - 複数テキストの並列処理
   - プログレス追跡機能

### 技術的改善

1. **キャッシュ機能**
   - 同一テキストの結果キャッシュ
   - 部分的変更時の差分更新

2. **メトリクス収集**
   - 処理時間計測
   - 成功/失敗率追跡
   - チャンク品質評価

## 関連ドキュメント

- [LLM統合システム](../shared/llm-integration.md)
- [Gemini 2.5 Flash設定](../shared/gemini-client.md)
- [RAGシステム概要](./overview.md)
- [テスト実行ガイド](../../testing-guide.md)