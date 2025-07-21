# DB初期化コマンド (init-db)

## 概要

`!init-db` コマンドは、指定されたDiscordカテゴリ内の全チャンネルから過去のメッセージ履歴を取得し、リンクを含むメッセージを解析してデータベースに保存する機能です。

## 実装ファイル

- `src/apps/discord-bot/src/commands/init-db.ts`

## 使用方法

```
!init-db <カテゴリID>
```

### 例
```
!init-db 123456789012345678
!init-db #general-category
```

## 権限要件

- **管理者権限**: `PermissionFlagsBits.Administrator` が必要
- **サーバー内実行**: DM では実行不可

## 処理フロー

### 1. 権限・引数検証
1. 実行者の管理者権限をチェック
2. サーバー内での実行かを確認
3. カテゴリIDの形式検証
4. カテゴリの存在とアクセス権限を検証

### 2. 重複実行防止
- 同一サーバーで既に実行中のジョブがないかチェック
- 実行中の場合はエラーメッセージを表示して終了

### 3. 初期化ジョブ作成
データベースに以下の情報でジョブレコードを作成：
- `guildId`: サーバーID
- `categoryId`: 対象カテゴリID  
- `categoryName`: カテゴリ名
- `initiatedBy`: 実行者のユーザーID
- `status`: "pending"

### 4. バックグラウンド処理開始

#### 4.1 メッセージ履歴取得
- `MessageFetcher` を使用してカテゴリ内全チャンネルのメッセージを取得
- 進捗コールバックでリアルタイム更新
- Discord APIの制限に配慮した取得方式

#### 4.2 リンク抽出・保存
- 取得したメッセージをデータベースに保存
- リンクを含むメッセージを抽出
- `LinkProcessor` でWebコンテンツを取得・解析

#### 4.3 ドキュメント作成
- 処理したコンテンツからドキュメントレコードを作成
- メタデータ（タイトル、説明、ドメイン、参照元メッセージ）を保存
- ベクトル検索用のフィールドを準備

## 進捗表示

処理中は以下の情報をリアルタイムで更新表示：

```
🔄 初期化処理中...
📂 チャンネル進捗: 5/10
💬 メッセージ数: 1,234
🔗 リンク発見数: 45
📄 ドキュメント作成数: 38
```

## エラーハンドリング

### 権限エラー
- 管理者権限がない場合
- 指定カテゴリにアクセスできない場合

### 実行時エラー
- ジョブテーブルにエラー内容を記録
- ユーザーにエラーメッセージを表示
- 詳細はログに出力

### API制限対応
- Discord API の Rate Limit に配慮
- エラー発生時も可能な限り処理を継続

## データベーススキーマ

### init_jobs テーブル
| カラム | 型 | 説明 |
|--------|----|----|
| id | serial | ジョブID |
| guild_id | varchar | サーバーID |
| category_id | varchar | カテゴリID |
| category_name | varchar | カテゴリ名 |
| initiated_by | varchar | 実行者ID |
| status | varchar | ステータス (pending/running/completed/failed) |
| total_channels | integer | 総チャンネル数 |
| processed_channels | integer | 処理済みチャンネル数 |
| total_messages | integer | 総メッセージ数 |
| processed_messages | integer | 処理済みメッセージ数 |
| documents_created | integer | 作成ドキュメント数 |
| links_found | integer | 発見リンク数 |
| started_at | timestamp | 開始時刻 |
| completed_at | timestamp | 完了時刻 |
| error_message | text | エラーメッセージ |

### discord_messages テーブル
| カラム | 型 | 説明 |
|--------|----|----|
| id | serial | レコードID |
| message_id | varchar | DiscordメッセージID |
| channel_id | varchar | チャンネルID |
| guild_id | varchar | サーバーID |
| author_id | varchar | 投稿者ID |
| content | text | メッセージ内容 |
| created_at | timestamp | 投稿日時 |

### documents テーブル
| カラム | 型 | 説明 |
|--------|----|----|
| id | serial | ドキュメントID |
| content | text | コンテンツ本文 |
| source | varchar | 元URL |
| metadata | jsonb | メタデータ |
| embedding | vector | ベクトル埋め込み |
| created_at | timestamp | 作成日時 |

## パフォーマンス考慮事項

### 非同期処理
- メイン処理はバックグラウンドで実行
- ユーザーの操作をブロックしない

### バッチ処理
- メッセージは一括でデータベースに保存
- 重複データの挿入を防止 (`onConflictDoNothing`)

### 進捗管理
- 定期的な進捗更新（3チャンネルごと、10メッセージごと）
- データベースへの更新頻度を制限

## 運用上の注意

### 実行時間
- 大量のメッセージがある場合、処理に数分〜数十分かかる可能性
- 実行中は他の初期化を実行不可

### リソース使用量
- Discord API の Rate Limit に配慮
- データベース接続の適切な管理
- メモリ使用量の監視

### 再実行
- 既存データとの重複は自動的に回避
- 失敗したジョブは手動で削除後に再実行可能

## トラブルシューティング

### よくある問題

#### 1. 権限エラー
**症状**: "このコマンドは管理者のみが実行できます"
**解決**: Discord サーバーでの管理者権限を確認

#### 2. カテゴリアクセスエラー  
**症状**: "指定されたカテゴリが見つからないか、アクセスできません"
**解決**: カテゴリIDの確認、ボットの権限設定を確認

#### 3. 処理中エラー
**症状**: "初期化処理中にエラーが発生しました"
**解決**: ログを確認し、データベース接続やAPI制限を確認

### ログ確認
```bash
# Discord Bot のログ確認
npm run dev:discord-bot

# データベースログ確認  
npm run docker:logs
```

### ジョブ状態確認
Drizzle Studio でジョブテーブルの状態を確認可能：
```bash
npm run db:studio
```