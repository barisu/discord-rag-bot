# init-db コマンド結合テスト実行ガイド

最終更新: 2025-07-21

## 🎯 概要

実際のDiscordサーバーとPostgreSQLデータベースを使用したinit-dbコマンドの結合テストの実行手順を説明します。

## 📋 事前準備

### 1. テスト用Discordサーバーの作成

#### サーバー作成
1. Discord上で新しいサーバーを作成（テスト専用）
2. サーバー名: 「Discord RAG Bot Test」など
3. 本番環境とは完全に分離する

#### カテゴリ・チャンネル作成
1. テスト用カテゴリを作成: 「test-category」
2. カテゴリ内にテキストチャンネルを作成: 「general」「test-links」など
3. テスト用メッセージを投稿（リンク付きメッセージを含む）

#### テスト用Discordアプリケーション作成
1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. 「New Application」をクリック
3. アプリケーション名: 「Discord RAG Bot Test」
4. Botセクションで新しいBotを作成
5. Botトークンを取得（後で環境変数に設定）

#### Bot権限設定
必要な権限:
- `View Channels`
- `Read Message History`
- `Send Messages`
- `Use Slash Commands`

#### Botをサーバーに招待
1. OAuth2セクションでURL Generatorを使用
2. Scopeで「bot」を選択
3. Bot Permissionsで上記権限を選択
4. 生成されたURLでテストサーバーにBotを招待

### 2. テスト用データベース環境

#### Docker でPostgreSQL起動
```bash
# テスト用PostgreSQL + pgvectorコンテナを起動
npm run test:integration:setup

# または手動で起動
docker run -d --name test-postgres \
  -e POSTGRES_DB=discord_rag_bot_test \
  -e POSTGRES_USER=test \
  -e POSTGRES_PASSWORD=test \
  -p 5433:5432 \
  pgvector/pgvector:pg16
```

#### マイグレーション適用
```bash
# メインディレクトリで実行
DATABASE_URL=postgres://test:test@localhost:5433/discord_rag_bot_test npm run db:migrate
```

### 3. 環境変数設定

#### 環境変数ファイル作成
```bash
cd src/apps/discord-bot
cp .env.integration.example .env.integration
```

#### 実際の値を設定
`.env.integration`ファイルを編集:

```env
# Discord設定（実際の値に置き換え）
INTEGRATION_DISCORD_TOKEN=your_actual_bot_token
TEST_GUILD_ID=your_test_server_id
TEST_CATEGORY_ID=your_test_category_id
TEST_ADMIN_USER_ID=your_discord_user_id
TEST_REGULAR_USER_ID=another_user_id

# データベース設定
INTEGRATION_DATABASE_URL=postgres://test:test@localhost:5433/discord_rag_bot_test

# テスト設定
TEST_TIMEOUT=60000
```

#### ID取得方法
Discord IDの取得:
1. Discordで開発者モードを有効化 (ユーザー設定 → 詳細設定 → 開発者モード)
2. サーバー・チャンネル・ユーザーを右クリック → 「IDをコピー」

## 🚀 テスト実行

### 1. 基本的な実行手順

```bash
# Discord Bot ワークスペースに移動
cd src/apps/discord-bot

# 結合テスト実行
npm run test:integration
```

### 2. 詳細なテスト実行（段階別）

#### ステップ1: 環境検証
```bash
# 環境設定の確認のみ実行
npm run test:integration -- --reporter=verbose --testNamePattern="Environment Validation"
```

#### ステップ2: 権限テスト
```bash
# 権限チェック関連のテストのみ実行
npm run test:integration -- --testNamePattern="権限チェックテスト"
```

#### ステップ3: データ処理テスト
```bash
# メイン機能のテスト（時間がかかります）
npm run test:integration -- --testNamePattern="データ処理テスト"
```

### 3. 個別テスト実行
```bash
# 特定のテストのみ実行
npm run test:integration -- --testNamePattern="管理者による正常なコマンド実行"
```

## 📊 期待される結果

### 成功時の出力例
```
✅ 結合テスト環境セットアップ完了
🚀 Discord Bot接続成功: TestBot#1234
📊 テスト環境確認完了:
   ギルド: Discord RAG Bot Test (1234567890123456789)
   カテゴリ: test-category (1234567890123456789)

✓ Environment Validation > 必要な環境変数が設定されている
✓ Environment Validation > テスト用データベースに接続できる  
✓ Environment Validation > Discord Botに接続できる

✓ 権限チェックテスト > 管理者ユーザーによる正常なコマンド実行
✓ 権限チェックテスト > 一般ユーザーによるコマンド実行の拒否

✓ データ処理テスト > メッセージ取得とデータベース保存
📊 処理結果統計: { discord_messages: 15, documents: 3, init_jobs: 1 }

Test Files  1 passed (1)
Tests  8 passed (8)
```

### データベース結果確認
テスト実行後、データベースの内容を確認:

```bash
# PostgreSQL接続
docker exec -it test-postgres psql -U test -d discord_rag_bot_test

# データ確認
SELECT COUNT(*) FROM discord_messages;
SELECT COUNT(*) FROM documents;  
SELECT status, total_messages, processed_messages FROM init_jobs;
```

## ⚠️ トラブルシューティング

### よくあるエラーと対処法

#### 1. Discord接続エラー
```
Error: Invalid token
```
**対処**: 
- `.env.integration`のトークンが正しいか確認
- Bot権限が適切に設定されているか確認

#### 2. データベース接続エラー
```
Error: connection refused
```
**対処**:
```bash
# PostgreSQLコンテナの状態確認
docker ps | grep test-postgres

# 再起動
npm run test:integration:cleanup
npm run test:integration:setup
```

#### 3. 権限エラー
```
Error: Missing Access
```
**対処**:
- Botがテストサーバーにいるか確認
- カテゴリ・チャンネルの閲覧権限があるか確認

#### 4. タイムアウトエラー  
```
Error: Test timed out
```
**対処**:
- `TEST_TIMEOUT`を増加 (例: 120000)
- Discord APIレート制限の可能性

### デバッグオプション

#### 詳細ログ出力
```bash
LOG_LEVEL=debug npm run test:integration
```

#### 特定テストのスキップ
```javascript
it.skip('長時間のテスト', async () => {
  // スキップされる
});
```

## 🧹 テスト後のクリーンアップ

### データベースクリーンアップ
```bash
# PostgreSQLコンテナ停止・削除
npm run test:integration:cleanup
```

### Discordメッセージクリーンアップ
テスト実行時に自動的にBotメッセージが削除されますが、手動削除も可能:

1. テストチャンネルでBotメッセージを選択
2. 一括削除またはチャンネルクリア

## 📈 結果の解釈

### 成功指標
- **環境検証**: 全て通過
- **権限テスト**: 管理者は成功、一般ユーザーは適切に拒否
- **データ処理**: メッセージとドキュメントがDBに保存
- **エラーハンドリング**: 適切なエラーメッセージ表示

### 性能指標
- **処理時間**: 通常30-60秒以内
- **メッセージ数**: テストカテゴリのメッセージ数と一致
- **ドキュメント数**: 有効リンク数に応じて作成

### 失敗の分析
1. **設定問題**: 環境変数、権限設定を再確認
2. **ネットワーク問題**: Discord API、データベース接続確認
3. **データ問題**: テストデータの準備状況確認

## 🔄 継続的な実行

### 定期実行スケジュール
- **開発時**: 機能変更後に実行
- **リリース前**: 必須実行
- **定期チェック**: 週1回程度

### 自動化の検討
現在は手動実行のみですが、将来のCI/CD統合を想定して設計されています。

---

**この結合テストにより、init-dbコマンドの実際の動作を包括的に検証し、プロダクション環境での安定性を保証できます。**