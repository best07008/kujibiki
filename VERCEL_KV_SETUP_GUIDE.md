# Vercel本番環境 KVセットアップ完全ガイド

## 📋 前提条件

- Vercelアカウントが必要
- プロジェクトがVercelにデプロイされている、または`vercel link`でリンクされている
- Vercel CLI がインストールされている（`npm install -g vercel`）

---

## 🚀 ステップ1: Vercelダッシュボードにアクセス

1. https://vercel.com/dashboard にアクセスしてログイン
2. くじびきプロジェクト（`kujibiki`）を選択

---

## 🗄️ ステップ2: KVデータベースを作成

### 2-1. Storageタブに移動

1. プロジェクトのページで上部メニューから **「Storage」** タブをクリック
2. 「Create Database」ボタンをクリック

### 2-2. KVを選択

1. データベースタイプの選択画面で **「KV (Key-Value Store)」** を選択
2. 「Continue」をクリック

### 2-3. データベースを設定

以下の項目を入力：

| 項目 | 推奨値 | 説明 |
|------|--------|------|
| **Database Name** | `kujibiki-sessions` | わかりやすい名前 |
| **Primary Region** | `Tokyo, Japan (nrt1)` | 日本のユーザー向け |
| **Read Regions** | なし（任意） | グローバル展開する場合のみ |

**重要**: Primary Regionは後から変更できないため、慎重に選択してください。

4. 「Create」ボタンをクリック

### 2-4. データベース作成完了

- 数秒〜数十秒で作成が完了します
- 作成されたKVデータベースのページに自動的に遷移します

---

## 🔗 ステップ3: プロジェクトにKVを接続

### 3-1. Connect Project

1. KVデータベースのページで **「Connect Project」** ボタンをクリック
   - または上部の「Settings」タブから「Connected Projects」セクションを探す

2. プロジェクト選択画面で **`kujibiki`** プロジェクトを選択

3. 環境を選択（複数選択可能）：
   - ☑️ **Production** （本番環境：必須）
   - ☑️ **Preview** （プレビュー環境：推奨）
   - ☐ **Development** （ローカル開発：任意）

4. **「Connect」** ボタンをクリック

### 3-2. 環境変数の自動設定を確認

接続が完了すると、以下の環境変数が自動的にプロジェクトに追加されます：

```bash
KV_URL="redis://default:xxxxx@xxxxx.upstash.io:xxxxx"
KV_REST_API_URL="https://xxxxx.upstash.io"
KV_REST_API_TOKEN="xxxxx"
KV_REST_API_READ_ONLY_TOKEN="xxxxx"
```

確認方法：
1. プロジェクトページに戻る（ブレッドクラムから「kujibiki」をクリック）
2. 「Settings」タブをクリック
3. 左サイドバーから「Environment Variables」を選択
4. 上記4つの変数が存在することを確認

---

## 🌐 ステップ4: 本番環境にデプロイ

### 4-1. コマンドラインからデプロイ

```bash
# プロジェクトディレクトリに移動
cd /Users/741720_m-sawada/Library/CloudStorage/Dropbox/web/kujibiki

# Vercelにデプロイ（本番環境）
vercel --prod
```

または

```bash
# Gitにプッシュ（Vercel GitインテグレーションがONの場合）
git add .
git commit -m "Add Vercel KV session management"
git push origin main
```

### 4-2. デプロイの確認

1. ターミナルに表示されるURLにアクセス（例: `https://kujibiki-ten.vercel.app`）
2. セッションを作成して、開催者ダッシュボードを開く
3. **10分以上放置してから**ページをリロードしてみる
4. セッションが切れずに続いていればOK！

---

## ✅ ステップ5: 動作確認

### 5-1. ログでKVの動作を確認

1. Vercelダッシュボードの「Deployments」タブに移動
2. 最新のデプロイをクリック
3. 「Functions」タブをクリック
4. 任意の関数（例: `/api/session/[sessionId]`）をクリック
5. ログを確認

**成功している場合のログ例**:
```
[KVSessionStore] Saved session to KV: 7HP97Y
[SessionManager] Session saved to KV: 7HP97Y
[KVSessionStore] Loaded session from KV: 7HP97Y
[Heartbeat] KV TTL refreshed for session: 7HP97Y
```

**KVが動作していない場合のログ例**:
```
[KVSessionStore] Vercel KV not available, using fallback
[SessionManager] KV unavailable, falling back to file storage
```

### 5-2. KVデータベース内のデータを確認

1. Vercelダッシュボードに戻る
2. 「Storage」タブをクリック
3. 作成した `kujibiki-sessions` データベースをクリック
4. 「Data」タブをクリック
5. `session:*` というキーが保存されていることを確認

**確認できる情報**:
- キー: `session:7HP97Y` のような形式
- 値: セッションデータのJSON
- TTL: 残り時間（秒単位）

---

## 🔧 トラブルシューティング

### 問題1: KVが接続されない

**症状**: ログに「Vercel KV not available」と表示される

**解決策**:

1. **環境変数を確認**
   ```bash
   # Vercel CLIで確認
   vercel env ls
   ```
   `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` が表示されるか確認

2. **プロジェクトが正しく接続されているか確認**
   - Storage → kujibiki-sessions → Settings → Connected Projects
   - `kujibiki` プロジェクトが表示されているか確認

3. **再デプロイ**
   ```bash
   vercel --prod --force
   ```

### 問題2: セッションが依然として切れる

**症状**: 時間が経つとセッションが404エラーになる

**解決策**:

1. **KVが正しく動作しているか確認**
   - ログに `[KVSessionStore] Saved session to KV` が表示されるか確認

2. **ハートビートが送信されているか確認**
   - ブラウザの開発者ツール → Network タブ
   - `/api/session/[sessionId]/heartbeat` のリクエストが30秒ごとに送信されているか確認

3. **TTLが更新されているか確認**
   - Vercel Storage → Data タブでセッションキーのTTLを確認
   - ページを開いたままにして、TTLが更新されるか確認

### 問題3: ローカル開発でKVを使いたい

**解決策**:

```bash
# 1. Vercel CLIでプロジェクトをリンク
vercel link

# 2. 環境変数をローカルにプル
vercel env pull .env.local

# 3. Vercel開発サーバーで起動
vercel dev
```

**注意**: `npm run dev` ではなく `vercel dev` を使用してください。

---

## 💰 料金について

### Hobby（無料プラン）の制限

- **ストレージ**: 256 MB
- **コマンド数**: 3,000 / 日
- **データ転送**: 3 GB / 月

**このアプリで必要な容量の目安**:
- 1セッション ≈ 1 KB
- 256 MBで約26万セッション保存可能
- TTL 2時間なので、実質的に制限なし

### 超過した場合

Hobbyプランで制限を超えると：
1. 新規セッションの作成ができなくなる
2. アプリはファイルストアにフォールバック（ただし本番環境では動作しない）

**対策**: Proプランにアップグレード（$20/月）

---

## 📊 モニタリング

### KVの使用状況を確認

1. Vercel Storage → kujibiki-sessions
2. 「Usage」タブをクリック

確認できる情報：
- **Storage Used**: 現在使用中のストレージ容量
- **Commands**: API呼び出し回数
- **Bandwidth**: データ転送量

---

## 🎉 セットアップ完了チェックリスト

- [ ] Vercel Storage で KV データベースを作成した
- [ ] プロジェクトに KV を接続した（Production環境）
- [ ] 環境変数が自動的に追加されたことを確認した
- [ ] 本番環境に再デプロイした
- [ ] ログで `[KVSessionStore] Saved session to KV` を確認した
- [ ] Storage → Data タブでセッションキーを確認した
- [ ] 10分以上経過後もセッションが切れないことを確認した

---

## 📚 参考リンク

- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Vercel Storage Pricing](https://vercel.com/pricing/storage)

---

## 🆘 サポートが必要な場合

上記の手順でうまくいかない場合は、以下の情報を添えて相談してください：

1. ログのスクリーンショット（Vercel Deployments → Functions → Logs）
2. 環境変数の一覧（値は隠してOK）: `vercel env ls`
3. エラーメッセージ（ブラウザの開発者ツール → Console）

---

**セットアップ頑張ってください！** 🚀
