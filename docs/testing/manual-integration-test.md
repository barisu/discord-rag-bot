# 手動結合テストガイド

最終更新: 2025-07-22

## 🎯 概要

結合テスト環境を使用して、手動でDiscord Botの動作を確認するためのガイドです。

## 📋 セットアップ手順

### 1. データベースセットアップ

```bash
# ルートディレクトリから実行
npm run dev:integration:setup
```

これにより以下が実行されます：
- PostgreSQL + pgvectorコンテナ起動
- pgvector拡張の有効化
- データベースマイグレーション適用

### 2. 環境変数設定確認

`.env.integration`ファイルが正しく設定されていることを確認：

```bash
cd src/apps/discord-bot
ls -la .env.integration  # ファイルが存在するか確認
```

### 3. 手動Bot起動

```bash
# ルートディレクトリから実行
npm run dev:integration

# または discord-bot ディレクトリから
cd src/apps/discord-bot
npm run dev:integration
```

## 🚀 手動テスト実行

### Bot起動後の確認事項

1. **起動ログ確認**:
   ```
   Ready! Logged in as YourBot#1234
   Internal API server running on port 3002
   ```

2. **Discord設定確認**:
   - Botがテストサーバーにオンライン表示されているか
   - 適切な権限が設定されているか

### テストコマンド実行

テストカテゴリ内のチャンネルで以下を実行：

#### 1. 基本動作確認
```
!ping
```
**期待される結果**: `Pong! Discord RAG Bot is ready.`

#### 2. init-db正常実行（管理者のみ）
```
!init-db YOUR_CATEGORY_ID
```
**期待される結果**: 
- `🔄 データベース初期化を開始します` メッセージ
- 処理進捗の表示
- 完了時に `✅ 初期化処理が完了しました` メッセージ

#### 3. エラーハンドリング確認

**引数なし**:
```
!init-db
```
**期待される結果**: `❌ カテゴリIDを指定してください`

**無効ID**:
```
!init-db invalid-id
```
**期待される結果**: `❌ カテゴリが見つからないか、アクセスできません`

**一般ユーザー実行**:
```
!init-db YOUR_CATEGORY_ID
```
**期待される結果**: `❌ このコマンドは管理者のみが実行できます`

### データベース結果確認

処理完了後、データベースの内容を確認：

```bash
# PostgreSQLコンテナに接続
docker exec -it test-postgres psql -U test -d discord_rag_bot_test

# データ確認
SELECT COUNT(*) FROM discord_messages;
SELECT COUNT(*) FROM documents;
SELECT status, total_messages, processed_messages FROM init_jobs ORDER BY created_at DESC LIMIT 1;
```

## 🔍 トラブルシューティング

### Bot起動エラー

**Discord Token エラー**:
```
❌ 必要な環境変数が設定されていません: INTEGRATION_DISCORD_TOKEN
```
**解決**: `.env.integration`で正しいBotトークンを設定

**データベース接続エラー**:
```
❌ Database connection failed
```
**解決**: 
1. `npm run dev:integration:setup` でDB起動
2. PostgreSQLコンテナ状態確認: `docker ps | grep test-postgres`

### Bot権限エラー

**Bot応答なし**:
- Botがサーバーに招待されているか確認
- Bot権限（メッセージ送信、履歴読み取り）が設定されているか確認
- テストチャンネルでBotが表示権限があるか確認

**管理者権限エラー**:
```
❌ このコマンドは管理者のみが実行できます
```
**解決**: 
- `.env.integration`の`TEST_ADMIN_USER_ID`が正しいか確認
- Discord IDを右クリック → 「IDをコピー」で取得

### Discord API制限

**レート制限エラー**:
- 大量メッセージ処理時に発生する場合があります
- 少し待機してから再実行してください

## 🧹 後始末

### Bot停止
Bot起動中のターミナルで `Ctrl+C`

### データベース停止
```bash
npm run test:integration:cleanup
```

### テストデータクリア
```bash
# PostgreSQL接続
docker exec -it test-postgres psql -U test -d discord_rag_bot_test

# 全データ削除
DELETE FROM embeddings;
DELETE FROM rag_queries;
DELETE FROM init_jobs;
DELETE FROM documents;
DELETE FROM discord_messages;
```

## 📊 期待される性能指標

- **!ping応答時間**: 1秒以内
- **init-db開始**: 5-10秒以内に開始メッセージ
- **メッセージ処理**: 100メッセージで30-60秒程度
- **リンク処理**: 有効リンクあたり2-5秒程度

## 💡 テスト成功の確認

以下がすべて確認できれば結合テスト成功：

1. ✅ Botの正常起動とDiscord接続
2. ✅ !pingコマンドへの即座の応答
3. ✅ !init-dbの正常実行と適切な応答
4. ✅ エラーハンドリングの適切な動作
5. ✅ データベースへの正常なデータ保存
6. ✅ リンク処理の動作（テストメッセージにリンクがある場合）

これらが確認できれば、結合テスト環境は完全に動作しています！