# Discord RAG Bot - 開発状況

最終更新: 2025-07-20

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
└── src/
    ├── apps/
    │   └── discord-bot/        # Discord Botアプリケーション
    │       ├── package.json
    │       ├── tsconfig.json
    │       └── src/
    │           ├── index.ts
    │           ├── bot.ts
    │           └── api/
    │               └── index.ts
    └── packages/
        ├── shared/             # 共有ライブラリ
        │   ├── package.json
        │   ├── tsconfig.json
        │   └── src/
        │       ├── index.ts
        │       ├── types/
        │       ├── utils/
        │       └── database/
        │           └── schema.ts
        └── rag/                # RAG機能ライブラリ
            ├── package.json
            ├── tsconfig.json
            └── src/
                ├── index.ts
                ├── vectorstore/
                │   ├── index.ts
                │   └── postgres-vectorstore.ts
                ├── embeddings/
                ├── retrieval/
                └── config/
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
npm run db:generate             # マイグレーション生成
npm run db:migrate              # マイグレーション適用
npm run db:studio               # Drizzle Studio起動
```

### Git状態

**現在のブランチ**: main
**作業ツリー**: クリーン（コミット待ちの変更なし）

**最近のコミット履歴**:
- `cacd94a` - web-apiを削除してdiscord-botに集約
- `49e163e` - initial commit

### 技術スタック

- **言語**: TypeScript (ES2022)
- **Bot Framework**: discord.js v14
- **Web Framework**: Hono
- **AI/RAG**: Mastra + OpenAI embeddings
- **データベース**: PostgreSQL + pgvector
- **ORM**: Drizzle ORM
- **パッケージ管理**: npm workspaces
- **コンテナ**: Docker Compose

### 設定済み機能

1. **モノレポ構成**: npm workspacesで効率的な開発環境
2. **TypeScript**: 厳格な型チェックとモジュール解決
3. **ESLint**: コード品質チェック
4. **PostgreSQL + pgvector**: ベクトル検索対応データベース
5. **Drizzle ORM**: タイプセーフなデータベース操作
6. **Docker環境**: ローカル開発用PostgreSQL環境

### 今後の開発タスク

1. **Discord Bot機能**: コマンド実装とイベントハンドリング
2. **RAG機能**: ベクトル検索とAI応答機能
3. **データベーススキーマ**: テーブル定義と関係設定
4. **エラーハンドリング**: ログ出力と例外処理
5. **テスト**: ユニットテストとE2Eテスト
6. **デプロイ**: 本番環境への展開設定

### 重要な注意事項

- 環境変数は`.env.example`を参考に`.env`ファイルで設定
- PostgreSQLはDocker Composeで起動してから開発開始
- TypeScriptコンパイル出力はdistディレクトリにのみ生成される
- npm workspacesのため、各パッケージは相互に依存関係を持つ

### 関連ドキュメント

- **README.md**: セットアップ手順と基本的な使い方
- **compose.yml**: Docker環境設定
- **drizzle.config.ts**: データベース設定
- **各package.json**: パッケージ固有の設定と依存関係