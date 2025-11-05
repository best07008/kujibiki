# Vercel KV セットアップガイド

このガイドでは、Vercel KVをプロジェクトに設定する方法を説明します。

## Vercel KVとは？

Vercel KVは、Redisベースの永続的なキー・バリューストアで、サーバーレス環境でのセッション管理に最適です。

## セットアップ手順

### 1. Vercelダッシュボードでの設定

1. [Vercel Dashboard](https://vercel.com/dashboard) にログイン
2. プロジェクトを選択
3. 「Storage」タブに移動
4. 「Create Database」をクリック
5. 「KV」を選択
6. データベース名を入力（例: `kujibiki-sessions`）
7. リージョンを選択（日本の場合は `Tokyo (nrt1)` を推奨）
8. 「Create」をクリック

### 2. プロジェクトへの接続

1. 作成したKVデータベースのページで「Connect Project」をクリック
2. このプロジェクトを選択
3. 「Connect」をクリック

これにより、以下の環境変数が自動的に設定されます：
- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

### 3. ローカル開発環境での設定

#### オプション1: Vercel CLIを使用（推奨）

```bash
# Vercel CLIをインストール（まだの場合）
npm install -g vercel

# プロジェクトをVercelにリンク
vercel link

# 環境変数を取得
vercel env pull .env.local

# ローカルでVercel環境をエミュレート
vercel dev
```

#### オプション2: 手動設定

Vercelダッシュボードから環境変数の値をコピーして、`.env.local`ファイルを作成：

```bash
# .env.local
KV_URL="redis://default:xxxxx@xxxxx.upstash.io:xxxxx"
KV_REST_API_URL="https://xxxxx.upstash.io"
KV_REST_API_TOKEN="xxxxx"
KV_REST_API_READ_ONLY_TOKEN="xxxxx"
```

**注意**: `.env.local`は`.gitignore`に含まれているため、Gitにコミットされません。

### 4. 動作確認

```bash
# ローカルサーバーを起動
npm run dev

# または Vercel CLI を使用
vercel dev
```

ブラウザで `http://localhost:3000` にアクセスして、セッションを作成してみてください。

ターミナルに以下のようなログが表示されれば成功です：

```
[KVSessionStore] Saved session to KV: ABC123
[SessionManager] Session saved to KV: ABC123
```

もし KV が利用できない場合は、以下のようなログが表示されます：

```
[KVSessionStore] Vercel KV not available, using fallback
[SessionManager] KV unavailable, falling back to file storage
```

この場合でも、ファイルベースのストレージにフォールバックするため、アプリは動作します。

## トラブルシューティング

### KV が接続できない場合

1. **環境変数が設定されているか確認**
   ```bash
   # ローカル
   cat .env.local

   # Vercel
   vercel env ls
   ```

2. **Vercel CLIで再度環境変数を取得**
   ```bash
   vercel env pull .env.local --force
   ```

3. **ローカルでの開発には`vercel dev`を使用**
   ```bash
   # 通常の npm run dev では環境変数が読み込まれない場合があります
   vercel dev
   ```

### デプロイ後もセッションが切れる場合

1. **Vercel KVが正しく接続されているか確認**
   - Vercelダッシュボード → プロジェクト → Storage → KV を確認
   - プロジェクトが接続されているか確認

2. **ログを確認**
   - Vercelダッシュボード → プロジェクト → Deployments → 最新のデプロイ → Function Logs
   - `[KVSessionStore]` のログを確認

3. **KV データベースのリージョンを確認**
   - プロジェクトと同じリージョンに配置されているか確認
   - 異なるリージョンの場合、レイテンシーが高くなる可能性があります

## 料金について

Vercel KVの料金プラン：

- **Hobby（無料プラン）**:
  - 256 MB ストレージ
  - 3,000 コマンド/日
  - 個人プロジェクトには十分

- **Pro プラン**:
  - 512 MB ストレージ
  - 10,000 コマンド/日

詳細は [Vercel Pricing](https://vercel.com/pricing) を参照してください。

## 実装の詳細

### セッションの永続化

- セッションは作成・更新時に自動的にKVに保存されます
- TTL（Time To Live）は2時間（7200秒）に設定されています
- ハートビートが30秒ごとに送信され、TTLが更新されます

### フォールバック機構

KVが利用できない場合、以下の順序でフォールバックします：

1. **メモリストア（最優先）**: 同じ関数インスタンス内で高速アクセス
2. **Vercel KV**: 関数インスタンス間で共有される永続ストレージ
3. **ファイルストア**: ローカル開発用のバックアップ

### セッションのクリーンアップ

- KVのTTLにより自動的に期限切れセッションが削除されます
- メモリストアは5分ごとにチェックされ、2時間以上更新がないセッションが削除されます

## 次のステップ

セットアップが完了したら、アプリをVercelにデプロイしてください：

```bash
vercel --prod
```

デプロイ後、セッションが時間経過で切れないことを確認してください。
