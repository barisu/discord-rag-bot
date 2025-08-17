# Discord 文書検索 Bot

PostgreSQL + Drizzle ORM を使用した高速文書検索機能付きDiscord Botのモノレポ構成プロジェクト

## 概要

このプロジェクトは、Discord サーバーの過去ログから高品質なコンテンツを抽出・保存し、部分一致検索で関連情報を素早く提供するBotです。Mozilla Readabilityを使用した高品質なコンテンツ抽出と、PostgreSQLのILIKEオペレータによる高速検索を実現しています。

## 技術スタック

- **言語**: TypeScript 5.8.3 (ES2022 + ESNext)
- **Discord Bot**: discord.js v14.14.0
- **コンテンツ抽出**: Mozilla Readability + JSDOM
- **データベース**: PostgreSQL 16
- **ORM**: Drizzle ORM v0.44.3
- **検索エンジン**: PostgreSQL ILIKEオペレータ
- **パッケージ管理**: npm workspaces
- **テスト**: Vitest + Testcontainers

## プロジェクト構造

```
src/
├── apps/
│   └── discord-bot/              # Discord Botアプリケーション
│       ├── src/
│       │   ├── commands/          # Discordコマンド
│       │   │   ├── init-db-refactored.ts  # DB初期化
│       │   │   └── search.ts              # 文書検索
│       │   ├── services/          # ビジネスロジック
│       │   │   ├── document-search.service.ts  # 検索サービス
│       │   │   ├── content-extraction.service.ts  # コンテンツ抽出
│       │   │   └── job-management.service.ts  # ジョブ管理
│       │   └── bot.ts             # メインBot
└── packages/
    ├── shared/                   # 共有ライブラリ (@shared/core)
    │   ├── src/database/         # データベーススキーマ・接続
    │   ├── src/content/          # コンテンツ処理 (Mozilla Readability)
    │   ├── src/discord/          # Discord API統合
    │   └── src/types/            # 型定義
    └── rag/                      # コンテンツ処理ライブラリ (@rag/core)
        └── src/chunking/         # テキストチャンキング
```

## クイックスタート

### 前提条件

- Node.js 18.0.0以上
- npm 9.0.0以上  
- Docker & Docker Compose
- Discord Bot Token (詳細は下記参照)

### 5分で始める手順

```bash
# 1. リポジトリクローン
git clone <repository-url>
cd discord-rag-bot
git checkout refactor  # 最新の部分一致検索機能

# 2. 依存関係インストール
npm install

# 3. PostgreSQL起動
npm run docker:up

# 4. データベース初期化
npm run db:migrate

# 5. Bot起動 (事前に.env設定が必要)
npm run dev:discord-bot
```

> 📚 **詳細な手順**: [docs/setup/local-development.md](docs/setup/local-development.md) を参照

## 主要機能

### Discordコマンド

| コマンド | 説明 | 例 |
|---------|------|-----|
| `!init-db <カテゴリID>` | 指定カテゴリのメッセージを収集・DB保存 | `!init-db 1234567890123456789` |
| `!search <クエリ>` | 保存されたドキュメントから検索 | `!search TypeScript エラー処理` |

### 検索機能の特徴

- **高速検索**: PostgreSQL ILIKEオペレータによるミリ秒単位の高速処理
- **複数キーワード**: スペース区切りでAND検索対応
- **高品質コンテンツ**: Mozilla Readabilityによる本文抽出
- **タイトル優先**: タイトルマッチを優先表示
- **簡潔表示**: 上位5件の関連性高い結果

### 環境変数設定

`src/apps/discord-bot/.env` ファイルを作成：

```bash
# Discord Bot設定
DISCORD_TOKEN=your_discord_bot_token
GUILD_ID=your_guild_id
CATEGORY_ID=your_category_id  
ADMIN_USER_ID=your_user_id

# データベース設定
DATABASE_URL=postgres://postgres:postgres@localhost:5432/discord_rag_bot_test

# オプション: コンテンツ抽出用
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
```

## 開発コマンド

### データベース関連
```bash
# PostgreSQL起動
npm run docker:up

# PostgreSQL停止
npm run docker:down

# データベースログ確認
npm run docker:logs

# マイグレーション生成
npm run db:generate

# マイグレーション適用
npm run db:migrate

# Drizzle Studio（DB管理UI）
npm run db:studio
```

### アプリケーション開発
```bash
# Discord Bot開発サーバー
npm run dev:discord-bot

# 全体ビルド
npm run build

# 型チェック
npm run type-check

# リント
npm run lint
```

### pgAdmin（オプション）
```bash
# pgAdminも起動する場合
docker compose --profile admin up -d

# アクセス: http://localhost:8080
# Email: admin@example.com
# Password: admin
```

## 使用例

### 1. データ収集

```
!init-db 1234567890123456789
```

**実行結果:**
```
📊 データベース初期化を開始します...
カテゴリ: 技術討論
チャンネル数: 5

🔄 進捗: チャンネル 3/5 処理中...
📝 メッセージ 287件を処理しました
🔗 リンク 23件を発見し、コンテンツを解析中...

✅ 初期化完了！
- 処理済みメッセージ: 1,247件
- 取得済みドキュメント: 67件
- 実行時間: 4分12秒
```

### 2. 文書検索

```
!search React Hook
```

**検索結果:**
```
🔍 検索結果
クエリ: React Hook

📊 検索統計
• 検索時間: 34ms
• 発見件数: 3件
• 総ドキュメント数: 67件

1. React Hooks 完全ガイド
URL: https://react.dev/learn/state-a-components-memory
ドメイン: react.dev
内容: HooksはReact 16.8で導入された機能で、関数コンポーネントでstateやライフサイクルを扱えるように...

2. useState Hookの使い方
URL: https://react.dev/reference/react/useState
ドメイン: react.dev
内容: useStateはコンポーネントにstate変数を追加するためのReact Hookです...
```

## データベーススキーマ

### 主要テーブル
- `source_documents` - Webコンテンツ保存（メインテーブル）
- `discord_messages` - Discordメッセージ履歴
- `init_jobs` - データ収集ジョブ管理
- `rag_queries` - 検索クエリログ
- `documents` - レガシーテーブル

### 検索最適化
- **インデックス**: URL、メッセージID、作成日時
- **ILIKEオペレータ**: 高速文字列部分一致検索
- **タイトル優先ソート**: 関連性の高い結果を優先表示

## 本番環境へのデプロイ

### PostgreSQLセットアップ

1. **Neon / Railway / Supabase** 等でPostgreSQLインスタンス作成
2. `DATABASE_URL` を本番環境の接続文字列に更新
3. マイグレーション実行: `npm run db:migrate`

### Discord Botデプロイ

**推奨プラットフォーム:**
- **Railway**: シンプルなGitベースデプロイ
- **Heroku**: 定番のホスティングサービス
- **VPS**: Docker Composeで自己ホスティング

## アーキテクチャの特徴

### 設計思想

1. **シンプル設計**: RAGの複雑さを排除し、部分一致検索で高速処理
2. **高品質コンテンツ**: Mozilla Readabilityによる本文抽出
3. **タイプセーフ**: Drizzle ORM + TypeScriptで型安全性を確保
4. **モノレポ構成**: 効率的な開発とテスト
5. **スケーラブル**: PostgreSQLのパフォーマンスとインデックス最適化

## プロジェクト状態

- **完成度**: 約65% (基盤・データ収集・検索機能完了)
- **テスト**: 84テスト中67テスト通過
- **現在のブランチ**: `refactor` (部分一致検索システム)
- **次のマイルストーン**: メンション応答機能の実装

## 関連ドキュメント

- **詳細セットアップ手順**: [docs/setup/local-development.md](docs/setup/local-development.md)
- **検索システム詳細**: [docs/apps/discord-bot/document-search.md](docs/apps/discord-bot/document-search.md)
- **プロジェクト全体設計**: [CLAUDE.md](CLAUDE.md)

## ライセンス

MIT License