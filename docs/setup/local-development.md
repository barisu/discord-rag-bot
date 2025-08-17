# Discord RAG Bot ローカル開発環境セットアップ

最終更新: 2025-08-16

## 概要

このドキュメントでは、Discord RAG Botをローカル環境で開発・実行するための完全な手順を説明します。部分一致検索システムが実装されており、Discord サーバーの過去ログから高速な文書検索が可能です。

## 前提条件

### 必要なソフトウェア

- **Node.js**: 18.0.0以上
- **npm**: 9.0.0以上
- **Docker**: 最新版
- **Docker Compose**: 最新版
- **Git**: 最新版

### バージョン確認

```bash
node --version    # v18.0.0以上であることを確認
npm --version     # v9.0.0以上であることを確認
docker --version  # Docker version 20.10.0以上を推奨
docker-compose --version  # v2.0.0以上を推奨
```

## Discord Bot セットアップ

### 1. Discord Developer Portal での Bot 作成

1. **Discord Developer Portal** にアクセス
   - https://discord.com/developers/applications

2. **New Application** をクリック
   - アプリケーション名を入力（例: "Discord RAG Bot - Dev"）

3. **Bot** タブに移動
   - **Add Bot** をクリック
   - **Token** をコピー（後で `.env` に設定）

4. **Bot の権限設定**
   - **Privileged Gateway Intents** で以下を有効化:
     - ✅ Message Content Intent
     - ✅ Server Members Intent (オプション)
   
5. **OAuth2 → URL Generator** で招待URL作成
   - **Scopes**: `bot`
   - **Bot Permissions**:
     - ✅ Send Messages
     - ✅ Read Message History
     - ✅ Use Slash Commands
     - ✅ Embed Links
     - ✅ Read Messages/View Channels

### 2. テスト用 Discord サーバー準備

1. **Discord サーバーを作成**または既存のサーバーを使用
2. **カテゴリを作成**し、カテゴリIDをメモ
3. **ユーザーIDを取得**（開発者モードを有効にしてIDをコピー）

## プロジェクトセットアップ

### 1. リポジトリクローン

```bash
git clone <repository-url>
cd discord-rag-bot

# refactorブランチをチェックアウト（最新の部分一致検索機能）
git checkout refactor
```

### 2. 依存関係インストール

```bash
# ルートディレクトリで実行
npm install
```

この手順で以下のパッケージがインストールされます：
- Discord Bot本体
- 共有ライブラリ（@shared/core）
- RAGライブラリ（@rag/core）
- 開発用ツール（TypeScript、ESLint、Vitest等）

### 3. PostgreSQL データベース起動

```bash
# Docker Compose でPostgreSQL起動
npm run docker:up

# ヘルスチェック確認（約10-30秒待機）
docker-compose logs postgres

# 成功例:
# discord-rag-postgres | database system is ready to accept connections
```

**オプション: pgAdmin起動（データベース管理用）**
```bash
# pgAdminも同時に起動
docker-compose --profile admin up -d

# アクセス: http://localhost:8080
# ログイン: admin@example.com / admin
```

### 4. データベース初期化

```bash
# マイグレーション適用
npm run db:migrate

# 成功時の出力例:
# No schema changes, nothing to push
```

**データベース接続確認**
```bash
# Drizzle Studio でスキーマ確認（オプション）
npm run db:studio
# アクセス: http://localhost:4983
```

### 5. 環境変数設定

**既に用意されている `.env` ファイルを確認・調整**

```bash
# Discord Bot用の環境変数ファイルを確認
cat src/apps/discord-bot/.env
```

**必要に応じて以下の値を更新：**

```bash
# src/apps/discord-bot/.env

# ===== Discord Bot 設定 =====
DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE          # Discord Developer Portal で取得
GUILD_ID=YOUR_GUILD_ID_HERE                # テスト用サーバーのID
CATEGORY_ID=YOUR_CATEGORY_ID_HERE          # テスト用カテゴリのID
ADMIN_USER_ID=YOUR_USER_ID_HERE            # あなたのDiscordユーザーID

# ===== データベース設定 =====
DATABASE_URL=postgres://postgres:postgres@localhost:5432/discord_rag_bot_test

# その他の設定は基本的にそのまま使用可能
```

### 6. プロジェクトビルド

```bash
# 全パッケージビルド
npm run build

# 型チェック
npm run type-check

# Linting
npm run lint
```

## Bot起動と動作確認

### 1. Discord Bot 起動

```bash
# 開発モード起動（ファイル変更時自動再起動）
npm run dev:discord-bot

# 成功時の出力例:
# [INFO] Discord Bot is starting...
# [INFO] Bot logged in as: YourBotName#1234
# [INFO] Bot is ready and connected to 1 guilds
```

### 2. Discord サーバーでの動作確認

#### 2.1 基本的な応答確認

Discord サーバーで以下を実行：

```
!ping
```

期待する応答：
```
🏓 Pong! 応答時間: 45ms
```

#### 2.2 データベース初期化

**重要**: 初回実行時は必ずデータベースを初期化してください

```
!init-db <CATEGORY_ID>
```

例：
```
!init-db 1396811956882640958
```

期待する応答：
```
📊 データベース初期化を開始します...
カテゴリ: テストカテゴリ
チャンネル数: 3
推定処理時間: 2-5分

🔄 進捗: チャンネル 1/3 処理中...
📝 メッセージ 150件を処理しました
🔗 リンク 12件を発見し、コンテンツを解析中...

✅ 初期化完了！
- 処理済みメッセージ: 450件
- 取得済みドキュメント: 25件
- 実行時間: 3分12秒
```

#### 2.3 検索機能テスト

```
!search JavaScript
```

期待する応答：
```
🔍 検索結果
クエリ: JavaScript

📊 検索統計
• 検索時間: 45ms
• 発見件数: 3件
• 総ドキュメント数: 25件

1. JavaScript入門ガイド
URL: https://example.com/js-guide
ドメイン: example.com
内容: JavaScriptは動的なプログラミング言語で...
メッセージID: 1234567890123456789

2. ES6の新機能について
URL: https://developer.mozilla.org/...
ドメイン: developer.mozilla.org
内容: ES6（ES2015）では多くの新しい機能が追加されました...
```

複数キーワード検索：
```
!search TypeScript エラー処理
```

## 利用可能なコマンド

### Discord Bot コマンド

| コマンド | 説明 | 例 |
|---------|------|-----|
| `!init-db <カテゴリID>` | 指定カテゴリのメッセージを取得・解析してDBに保存 | `!init-db 1234567890123456789` |
| `!search <クエリ>` | 保存されたドキュメントから部分一致検索 | `!search React Hook` |

### 開発用コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev:discord-bot` | Discord Bot開発サーバー起動 |
| `npm run build` | 全パッケージビルド |
| `npm run test` | テスト実行 |
| `npm run type-check` | TypeScript型チェック |
| `npm run lint` | ESLintコード検査 |
| `npm run docker:up` | PostgreSQL起動 |
| `npm run docker:down` | PostgreSQL停止 |
| `npm run db:studio` | Drizzle Studio起動 |

## 開発ワークフロー

### 1. 日常的な開発手順

```bash
# 1. 最新コードを取得
git pull origin refactor

# 2. 依存関係更新（必要に応じて）
npm install

# 3. PostgreSQL起動
npm run docker:up

# 4. Bot起動
npm run dev:discord-bot

# 5. コード変更後の確認
npm run type-check
npm run lint
npm test
```

### 2. テスト実行

```bash
# 全テスト実行
npm test

# テスト監視モード
npm run test:watch

# テストUI起動
npm run test:ui

# 特定パッケージのテスト
npm test --workspace=src/packages/shared
```

### 3. データベース操作

```bash
# マイグレーション生成
npm run db:generate

# マイグレーション適用
npm run db:migrate

# データベース管理画面
npm run db:studio
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. Bot が起動しない

**症状**: `npm run dev:discord-bot` でエラーが発生

**原因と解決策**:

```bash
# Discord Token が無効
error: Used disallowed intents
→ Discord Developer Portal で Bot Token を再生成

# データベース接続エラー
error: connect ECONNREFUSED 127.0.0.1:5432
→ PostgreSQL が起動していない
npm run docker:up

# 環境変数が設定されていない
error: DISCORD_TOKEN is required
→ src/apps/discord-bot/.env ファイルを確認
```

#### 2. init-db コマンドが失敗する

**症状**: `!init-db` 実行時にエラー

**解決策**:

```bash
# 権限不足
❌ このコマンドは管理者のみ実行可能です
→ .env の ADMIN_USER_ID を自分のユーザーIDに変更

# カテゴリIDが無効
❌ 指定されたカテゴリが見つかりません
→ Discord で開発者モードを有効にしてカテゴリIDを再取得

# データベース接続エラー
❌ データベースに接続できません
→ npm run docker:up でPostgreSQLを起動
```

#### 3. 検索結果が表示されない

**症状**: `!search` で結果が0件

**解決策**:

```bash
# データが初期化されていない
→ 先に !init-db <カテゴリID> を実行

# 検索キーワードが適切でない
→ より一般的なキーワードで検索

# データベースにリンクが少ない
→ リンクを含むメッセージがあるカテゴリで init-db を実行
```

#### 4. TypeScript / ビルドエラー

```bash
# 型エラー
npm run type-check
→ エラー箇所を修正

# 依存関係の問題
rm -rf node_modules package-lock.json
npm install

# ビルドキャッシュ問題
npm run clean
npm run build
```

### ログ確認方法

```bash
# Discord Bot ログ
npm run dev:discord-bot
# → コンソールに直接出力

# PostgreSQL ログ
npm run docker:logs

# データベース内容確認
npm run db:studio
# → http://localhost:4983 でスキーマとデータを確認
```

### パフォーマンス最適化

```bash
# データベースインデックス確認
npm run db:studio
# → source_documents テーブルのインデックスを確認

# 検索性能測定
!search <キーワード>
# → 検索時間をチェック（通常50ms以下）
```

## セキュリティ注意事項

### 環境変数の管理

⚠️ **重要**: `.env` ファイルには機密情報が含まれています

```bash
# Git にコミットしないよう注意
echo "src/apps/discord-bot/.env" >> .gitignore

# 本番環境では異なるトークンを使用
# 開発用と本番用でBot・サーバーを分ける
```

### Discord Token の保護

- Bot Token は絶対に公開しない
- Token が漏洩した場合は即座に再生成
- 開発環境でのみ使用する

## 追加リソース

### 関連ドキュメント

- **システム概要**: `/docs/apps/discord-bot/document-search.md`
- **データベーススキーマ**: `/src/packages/shared/src/database/schema.ts`
- **プロジェクト全体設計**: `/CLAUDE.md`

### 便利なツール

- **pgAdmin**: http://localhost:8080 (データベース管理)
- **Drizzle Studio**: http://localhost:4983 (スキーマ確認)
- **Vitest UI**: `npm run test:ui` (テストUI)

### サポート

問題が解決しない場合：

1. **ログを確認**してエラーメッセージを特定
2. **GitHub Issues** で類似の問題を検索
3. **Discord Developer Portal** の設定を再確認
4. **Docker コンテナ**の状態を確認 (`docker ps`)

---

これで Discord RAG Bot のローカル開発環境が完全に構築できます。何か問題があれば、上記のトラブルシューティングを参考に解決してください。