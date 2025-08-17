# Mozilla Readability統合システム

最終更新: 2025-07-24

## 概要

Discord RAG BotのMozilla Readability統合システムは、Webページから本文コンテンツを高品質で抽出する機能を提供します。記事構造の自動認識、ノイズ除去、メタデータ充実により、RAGシステムで使用する質の高いコンテンツを取得できます。

## 技術スタック

### 主要ライブラリ

- **@mozilla/readability**: v0.5.0 - Mozilla製記事抽出ライブラリ
- **jsdom**: v25.0.1 - サーバーサイドDOM実装
- **Node.js fetch**: 組み込みHTTPクライアント

### アーキテクチャ

```
LinkProcessor
├── fetchLinkContent()           # HTTP取得・基本検証
├── extractContentWithReadability() # Readability処理
├── fallbackParseHtmlContent()  # フォールバック処理
└── isContentValuable()         # 品質フィルタリング
```

## 主要機能

### 1. 高品質コンテンツ抽出

Mozilla Readabilityによる記事構造認識と本文抽出。

```typescript
private extractContentWithReadability(html: string, url: string): {
  title?: string;
  content?: string;
  description?: string;
  readability?: LinkContent['readability'];
} {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(document);
  const article = reader.parse();
  
  if (article) {
    return {
      title: article.title,
      content: article.textContent,
      description: extractMetaDescription(document),
      readability: {
        byline: article.byline,
        siteName: article.siteName,
        length: article.length,
        excerpt: article.excerpt
      }
    };
  }
}
```

**抽出される情報:**
- **本文コンテンツ**: 記事の主要テキスト
- **タイトル**: ページタイトル
- **メタデータ**: 説明、著者、サイト名
- **品質情報**: 文字数、抜粋

### 2. ノイズ除去

Readabilityによる不要要素の自動除去。

**除去される要素:**
- ナビゲーションメニュー
- 広告コンテンツ
- サイドバー情報
- フッター情報
- コメント欄
- 関連記事リンク

**保持される要素:**
- メイン記事コンテンツ
- 段落構造
- 見出し階層
- リスト構造

### 3. フォールバック機能

Readability処理が失敗した場合の代替処理。

```typescript
private fallbackParseHtmlContent(html: string): {
  title?: string;
  content?: string;
  description?: string;
} {
  // 基本的なHTML解析
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim();

  // メタタグとスクリプトを除去
  let content = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { title, content, description };
}
```

## 品質フィルタリング

### コンテンツ価値判定

抽出されたコンテンツの品質評価と不適切コンテンツの除外。

```typescript
private isContentValuable(content: LinkContent): boolean {
  const { title, content: text } = content;
  
  // 基本品質チェック
  if (!title || !text) return false;
  if (text.length < 100) return false;
  
  // エラーページ検出
  if (title.toLowerCase().includes('error') || 
      title.toLowerCase().includes('404')) return false;
  
  // スパム検出
  const spamKeywords = ['click here', 'buy now', 'limited time', 'act fast'];
  const lowerContent = (title + ' ' + text).toLowerCase();
  const hasSpam = spamKeywords.some(keyword => lowerContent.includes(keyword));
  
  return !hasSpam;
}
```

**フィルタリング基準:**
- **最小文字数**: 100文字以上
- **エラーページ**: 404、エラー等の除外
- **スパムコンテンツ**: 広告的キーワードの検出
- **完全性**: タイトル・本文の存在確認

## 処理フロー

### 1. URL検証・ドメインフィルタリング

```typescript
private isBlockedDomain(url: string): boolean {
  const domain = new URL(url).hostname.toLowerCase();
  return this.BLOCKED_DOMAINS.some(blocked => 
    domain === blocked || domain.endsWith('.' + blocked)
  );
}
```

**ブロック対象:**
- localhost, 127.0.0.1
- SNSプラットフォーム (Facebook, Twitter, Discord等)
- 不正なURL形式

### 2. HTTP取得・ヘッダー検証

```typescript
const response = await fetch(url, {
  headers: {
    'User-Agent': 'Discord-RAG-Bot/1.0 (+https://github.com/your-repo)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja,en;q=0.9'
  }
});

const contentType = response.headers.get('content-type');
if (!contentType?.includes('text/html')) {
  return { url, error: `Unsupported content type: ${contentType}` };
}
```

### 3. Readability処理・フォールバック

```typescript
try {
  const result = this.extractContentWithReadability(html, url);
  if (result.content && result.title) {
    return result;
  }
} catch (error) {
  console.warn(`Readability failed for ${url}, falling back to basic parsing`);
}

// フォールバック処理
return this.fallbackParseHtmlContent(html);
```

### 4. 品質評価・出力

```typescript
if (content.content && content.title && this.isContentValuable(content)) {
  processedContents.push({
    originalUrl: link,
    title: content.title,
    content: content.content,
    metadata: {
      extractionMethod: content.readability ? 'readability' : 'fallback',
      byline: content.readability?.byline,
      siteName: content.readability?.siteName,
      contentLength: content.readability?.length || content.content.length
    }
  });
}
```

## 出力形式

### ProcessedContent

```typescript
export interface ProcessedContent {
  originalUrl: string;
  title: string;
  content: string;
  metadata: {
    description?: string;
    domain: string;
    processedAt: Date;
    statusCode: number;
    byline?: string;           // 著者情報
    siteName?: string;         // サイト名
    contentLength: number;     // コンテンツ文字数
    excerpt?: string;          // 抜粋
    extractionMethod: 'readability' | 'fallback';  // 抽出方法
  };
}
```

## テスト設計

### テストカバレッジ (17テスト)

#### 基本機能テスト (9テスト)
- 有効リンクからのコンテンツ抽出
- ブロックドメインのスキップ
- 非HTMLコンテンツの除外
- HTTPエラー処理
- ネットワークエラー処理
- 短すぎるコンテンツの除外
- エラーページの検出
- スパムコンテンツの検出
- 複数リンクの並列処理

#### Mozilla Readability統合テスト (3テスト)
- 記事構造の正しい認識
- フォールバック処理の動作
- ニュース記事の処理

#### HTML解析テスト (2テスト)
- HTMLタグの正しい除去
- メタ説明の抽出

#### その他テスト (3テスト)
- ドメインブロック機能
- タイムアウト処理
- 不正URL処理

### 実用的テストケース

```typescript
it('記事構造を正しく認識してコンテンツを抽出する', async () => {
  const mockArticleHtml = `
    <html>
      <head>
        <title>AI技術の最新動向</title>
        <meta name="description" content="人工知能技術の最新トレンドについて詳しく解説">
      </head>
      <body>
        <main>
          <article>
            <h1>AI技術の最新動向</h1>
            <div class="content">
              <p>人工知能（AI）技術は急速に発展しており...</p>
            </div>
          </article>
        </main>
        <aside>
          <div class="ads">広告コンテンツ</div>
        </aside>
      </body>
    </html>
  `;

  const result = await linkProcessor.processLinks(['https://tech-blog.example.com/ai-trends']);

  expect(result[0].title).toBe('AI技術の最新動向');
  expect(result[0].content).toContain('人工知能（AI）技術は急速に発展');
  expect(result[0].content).not.toContain('広告コンテンツ');
  expect(result[0].metadata.extractionMethod).toBe('readability');
});
```

## パフォーマンス特性

### 処理時間
- **Readability処理**: 50-200ms (HTML複雑さに依存)
- **フォールバック処理**: 1-10ms
- **HTTP取得**: 500ms-3秒 (ネットワーク依存)

### メモリ使用量
- **JSDOM初期化**: HTMLサイズの2-3倍
- **Readability処理**: 追加で1-2MB
- **ガベージコレクション**: 処理完了後に自動解放

### 並列処理
- **同時接続数**: デフォルト無制限（実際はブラウザ制限適用）
- **レート制限**: 500ms間隔でリクエスト分散
- **タイムアウト**: 10秒（設定可能）

## エラーハンドリング

### エラー分類

1. **ネットワークエラー**
   - 接続タイムアウト
   - DNS解決失敗
   - SSL証明書エラー

2. **HTTPエラー**
   - 404 Not Found
   - 403 Forbidden
   - 500 Internal Server Error

3. **コンテンツエラー**
   - 非HTMLコンテンツ
   - 空のレスポンス
   - 文字エンコーディングエラー

4. **Readabilityエラー**
   - DOM解析失敗
   - 記事構造認識失敗

### エラー処理戦略

```typescript
try {
  const content = await this.fetchLinkContent(link);
  if (content.content && content.title && this.isContentValuable(content)) {
    // 成功処理
  }
} catch (error) {
  console.error(`Error processing link ${link}:`, error);
  // エラーがあっても続行（堅牢性重視）
}
```

## 設定・カスタマイズ

### タイムアウト設定

```typescript
private readonly REQUEST_TIMEOUT = 10000; // 10秒
```

### コンテンツサイズ制限

```typescript
private readonly MAX_CONTENT_LENGTH = 50000; // 50KB
```

### ブロックドメイン

```typescript
private readonly BLOCKED_DOMAINS = [
  'localhost', '127.0.0.1', '0.0.0.0',
  'facebook.com', 'twitter.com', 'instagram.com',
  'tiktok.com', 'discord.com', 'discord.gg'
];
```

## 将来の拡張計画

### 予定機能

1. **コンテンツキャッシュ**
   - URL別結果キャッシュ
   - 更新日時による無効化
   - メモリ効率化

2. **高度なフィルタリング**
   - 機械学習による品質評価
   - 言語検出・フィルタリング
   - 重複コンテンツ検出

3. **メタデータ拡張**
   - OGP情報取得
   - 構造化データ抽出
   - 画像メタデータ

4. **パフォーマンス改善**
   - HTTP/2サポート
   - 圧縮レスポンス処理
   - プリフェッチ機能

### 技術的改善

1. **リトライ機能**
   - 指数バックオフ
   - 条件別リトライ戦略

2. **モニタリング**
   - 成功率追跡
   - レスポンス時間計測
   - エラー分類統計

## 関連ドキュメント

- [Discord Message Fetcher](./message-fetcher.md)
- [コンテンツ品質管理](./content-quality.md)
- [テスト実行ガイド](../../testing-guide.md)
- [パフォーマンス最適化](./performance-optimization.md)