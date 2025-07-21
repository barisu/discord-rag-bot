# Discord RAG Bot - 開発状況

最終更新: 2025-07-21

## 現在のリポジトリ状態

### プロジェクト構造
```
discord-rag-bot/
├── README.md                    # プロジェクト概要とセットアップ手順
├── package.json                 # ルートpackage.json（npm workspaces設定）
├── tsconfig.json               # ルートTypeScript設定
├── compose.yml                 # PostgreSQL + pgvector用Docker設定
├── drizzle.config.ts           # Drizzle ORM設定
├── .env.example                # 環境変数テンプレート
├── docker/
│   └── init-pgvector.sql       # pgvector初期化スクリプト
├── docs/                       # プロジェクトドキュメント
│   ├── usercase.md            # ボットのユースケース定義
│   ├── apps/
│   │   └── discord-bot/       # Discord Bot関連ドキュメント
│   ├── packages/              # パッケージドキュメント
│   └── deployment/            # デプロイメント関連
│       └── infra.dio         # インフラ構成図
└── src/
    ├── apps/
    │   └── discord-bot/        # Discord Botアプリケーション
    │       ├── package.json
    │       ├── tsconfig.json
    │       └── src/
    │           ├── index.ts
    │           ├── bot.ts
    │           ├── api/
    │           │   └── index.ts
    │           ├── agents/      # AIエージェント機能
    │           ├── commands/    # Discord コマンド
    │           │   └── init-db.ts  # DB初期化コマンド
    │           ├── events/      # Discord イベントハンドラ
    │           └── services/    # ビジネスロジック
    └── packages/
        ├── shared/             # 共有ライブラリ
        │   ├── package.json
        │   ├── tsconfig.json
        │   └── src/
        │       ├── index.ts
        │       ├── types/
        │       ├── utils/
        │       ├── config/      # 設定管理
        │       ├── content/     # コンテンツ処理
        │       │   └── link-processor.ts  # リンク処理機能
        │       ├── database/    # データベース関連
        │       │   ├── connection.ts
        │       │   ├── schema.ts
        │       │   └── index.ts
        │       └── discord/     # Discord API関連
        │           └── message-fetcher.ts  # メッセージ取得機能
        └── rag/                # RAG機能ライブラリ
            ├── package.json
            ├── tsconfig.json
            └── src/
                ├── index.ts
                ├── vectorstore/
                │   ├── index.ts
                │   └── postgres-vectorstore.ts
                ├── embeddings/ # 埋め込み機能
                │   └── index.ts
                └── retrieval/  # 検索機能
                    └── index.ts
```

### TypeScript設定状況

**✅ コンパイル出力の整理完了**

1. **ルートtsconfig.json**: `"noEmit": true`設定済み
2. **各パッケージtsconfig.json**: `"outDir": "./dist"`で適切に出力先を指定
3. **散乱していた.jsファイル**: src配下から削除済み
4. **コンパイル出力**: 今後はdistディレクトリにのみ出力される

### 依存関係とパッケージ

**npm workspaces構成**
- ルート: `discord-rag-bot`
- アプリ: `@discord-rag-bot/discord-bot`
- パッケージ: `@shared/types`, `@rag/core`

**主要依存関係**
- **TypeScript**: v5.8.3
- **Discord.js**: v14.14.0
- **Hono**: v4.8.5 (API用)
- **Drizzle ORM**: v0.32.2
- **Mastra**: v0.10.13 (RAG機能)
- **PostgreSQL driver**: postgres v3.4.0
- **tsx**: v4.20.3 (開発用)
- **@types/node**: v24.0.15
- **drizzle-kit**: v0.31.4

### 開発コマンド

```bash
# 開発
npm run dev:discord-bot          # Discord Bot開発サーバー
npm run build                    # 全体ビルド
npm run type-check              # 型チェック
npm run lint                    # ESLint実行
npm run clean                   # distディレクトリクリーンアップ

# データベース
npm run docker:up               # PostgreSQL起動
npm run docker:down             # PostgreSQL停止
npm run docker:logs             # PostgreSQLログ確認
npm run db:generate             # マイグレーション生成
npm run db:migrate              # マイグレーション適用
npm run db:studio               # Drizzle Studio起動
```

### Git状態

**現在のブランチ**: main
**作業ツリー**: クリーン（コミット待ちの変更なし）

**最近のコミット履歴**:
- `ccfcc4a` - DB初期化用コマンドを作成
- `f09a99c` - botのユースケースを記載
- `945b696` - CLAUDE.mdを作成
- `99c6e33` - バージョンを最新化
- `6ed7511` - 誤って出力されたものなので削除
- `807c4ce` - Drizzle ORMを利用するための設定
- `cacd94a` - web-apiを削除してdiscord-botに集約

### 技術スタック

- **言語**: TypeScript (ES2022)
- **Bot Framework**: discord.js v14
- **Web Framework**: Hono
- **AI/RAG**: Mastra + OpenAI embeddings
- **データベース**: PostgreSQL + pgvector
- **ORM**: Drizzle ORM
- **パッケージ管理**: npm workspaces
- **コンテナ**: Docker Compose

### 実装済み機能

#### ✅ 基盤機能
1. **モノレポ構成**: npm workspacesで効率的な開発環境
2. **TypeScript**: 厳格な型チェックとモジュール解決
3. **ESLint**: コード品質チェック
4. **PostgreSQL + pgvector**: ベクトル検索対応データベース
5. **Drizzle ORM**: タイプセーフなデータベース操作
6. **Docker環境**: ローカル開発用PostgreSQL環境

#### ✅ Discord Bot機能
1. **DB初期化コマンド** (`!init-db`): 指定カテゴリのメッセージ履歴を取得してDBに保存
   - 管理者権限チェック
   - カテゴリ検証とアクセス制御
   - バックグラウンド処理による非同期実行
   - リアルタイム進捗表示
   - ジョブ管理とエラーハンドリング

#### ✅ 共有ライブラリ機能
1. **MessageFetcher**: Discordメッセージ取得機能
   - カテゴリ内全チャンネルのメッセージ履歴取得
   - リンク抽出とメタデータ解析
   - 進捗コールバック対応

2. **LinkProcessor**: Webコンテンツ処理機能
   - URLからコンテンツ取得・解析
   - メタデータ抽出（タイトル、説明、ドメイン）
   - 複数リンクの並列処理

3. **データベース統合**: 完全なスキーマ定義
   - Discord メッセージテーブル
   - ドキュメントテーブル（ベクトル検索対応）
   - 初期化ジョブ管理テーブル

### 今後の開発タスク

#### 🔄 開発中
1. **RAG機能**: ベクトル検索とAI応答の実装
   - Mastraを使用したベクトル検索システム
   - OpenAI embeddings統合
   - 検索結果のランキングとフィルタリング

#### 📋 実装予定
1. **Discord Bot拡張機能**:
   - メンション応答機能（質問への自動回答）
   - ユーザーコマンド（検索、ヘルプ等）
   - イベントハンドリング（新メッセージの自動処理）

2. **AIエージェント機能**:
   - 自然言語による質問処理
   - コンテキスト理解と関連性判定
   - レスポンス生成とソース引用

3. **品質向上**:
   - エラーハンドリングの強化
   - ログ出力システム
   - ユニットテストとE2Eテスト
   - パフォーマンス最適化

4. **運用・デプロイ**:
   - 本番環境への展開設定
   - 監視とアラート
   - バックアップとリストア機能

### 重要な注意事項

- 環境変数は`.env.example`を参考に`.env`ファイルで設定
- PostgreSQLはDocker Composeで起動してから開発開始
- TypeScriptコンパイル出力はdistディレクトリにのみ生成される
- npm workspacesのため、各パッケージは相互に依存関係を持つ

### 関連ドキュメント

- **README.md**: セットアップ手順と基本的な使い方
- **docs/usercase.md**: ボットの具体的なユースケースと動作フロー
- **compose.yml**: Docker環境設定
- **drizzle.config.ts**: データベース設定
- **各package.json**: パッケージ固有の設定と依存関係

### 主要な実装ファイル

#### Discord Bot
- `src/apps/discord-bot/src/commands/init-db.ts`: DB初期化コマンドの完全実装

#### 共有ライブラリ
- `src/packages/shared/src/discord/message-fetcher.ts`: Discordメッセージ取得機能
- `src/packages/shared/src/content/link-processor.ts`: Webコンテンツ処理機能
- `src/packages/shared/src/database/schema.ts`: データベーススキーマ定義

#### RAG機能
- `src/packages/rag/src/vectorstore/postgres-vectorstore.ts`: PostgreSQL ベクトルストア
- `src/packages/rag/src/embeddings/index.ts`: 埋め込み機能
- `src/packages/rag/src/retrieval/index.ts`: 検索機能