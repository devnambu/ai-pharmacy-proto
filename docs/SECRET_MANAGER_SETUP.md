# Secret Manager セットアップガイド

GCP Secret Managerを使ってAPIキーなどの機密情報を安全に管理する方法を説明します。

## メリット

- 環境変数に直接APIキーを書かなくて済む
- アクセス権限を細かく制御できる
- キーのローテーションが簡単
- 監査ログが残る

## セットアップ手順

### 1. Secret Manager APIの有効化

```bash
gcloud config set project kanja-ai
gcloud services enable secretmanager.googleapis.com
```

### 2. シークレットの作成

#### OpenAI APIキーを保存

```bash
# 対話形式で入力する方法
gcloud secrets create OPENAI_API_KEY \
    --location=asia-northeast1 \
    --replication-policy=user-managed \
    --replica-locations=asia-northeast1

# 値を設定（実際のAPIキーを入力してください）
echo -n "sk-proj-your-actual-api-key-here" | \
    gcloud secrets versions add OPENAI_API_KEY --data-file=-
```

または、ファイルから読み込む方法：

```bash
# APIキーをファイルに保存
echo -n "sk-proj-your-actual-api-key-here" > /tmp/openai-key.txt

# Secret Managerに作成
gcloud secrets create OPENAI_API_KEY \
    --location=asia-northeast1 \
    --replication-policy=user-managed \
    --replica-locations=asia-northeast1 \
    --data-file=/tmp/openai-key.txt

# 一時ファイルを削除
rm /tmp/openai-key.txt
```

#### Gemini APIキーを保存する場合

```bash
gcloud secrets create GOOGLE_GENERATIVE_AI_API_KEY \
    --location=asia-northeast1 \
    --replication-policy=user-managed \
    --replica-locations=asia-northeast1

echo -n "your-gemini-api-key-here" | \
    gcloud secrets versions add GOOGLE_GENERATIVE_AI_API_KEY --data-file=-
```

### 3. Cloud Runのサービスアカウントに権限を付与

Cloud Runは、デフォルトでCompute Engine のデフォルトサービスアカウント（`PROJECT_NUMBER-compute@developer.gserviceaccount.com`）を使います。

#### 3-1. プロジェクト番号を確認

```bash
gcloud projects describe kanja-ai --format='value(projectNumber)'
```

出力された番号（例: `123456789012`）をメモしてください。

#### 3-2. Secret Managerへのアクセス権限を付与

```bash
# プロジェクト番号を環境変数に設定（上記で確認した番号に置き換え）
export PROJECT_NUMBER=123456789012

# OPENAI_API_KEYへのアクセス権限を付与
gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
    --location=asia-northeast1 \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Geminiを使う場合も同様に
gcloud secrets add-iam-policy-binding GOOGLE_GENERATIVE_AI_API_KEY \
    --location=asia-northeast1 \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 4. Cloud Runへのデプロイ

Secret Managerを使う設定でデプロイします：

```bash
gcloud run deploy ai-pharmacy \
    --source . \
    --region asia-northeast1 \
    --allow-unauthenticated \
    --set-env-vars AI_PROVIDER=openai \
    --set-env-vars USE_SECRET_MANAGER=true \
    --set-env-vars GCP_PROJECT_ID=kanja-ai
```

**重要**: このコマンドでは `OPENAI_API_KEY` を環境変数として設定していません。
アプリケーションが自動的にSecret Managerから取得します。

## 確認方法

### シークレットが作成されているか確認

```bash
gcloud secrets list --location=asia-northeast1
```

### シークレットの値を確認（テスト用）

```bash
gcloud secrets versions access latest --secret=OPENAI_API_KEY --location=asia-northeast1
```

### IAMポリシーを確認

```bash
gcloud secrets get-iam-policy OPENAI_API_KEY --location=asia-northeast1
```

## トラブルシューティング

### エラー: Permission denied

サービスアカウントに適切な権限が付与されていない可能性があります。
上記の「3-2. Secret Managerへのアクセス権限を付与」を再度実行してください。

### エラー: Secret not found

1. シークレット名が正しいか確認（大文字・小文字を区別します）
2. プロジェクトIDが正しいか確認
3. シークレットが正しいリージョンに作成されているか確認

### ローカル開発での注意

ローカル開発では、`.env.local` を使用します。
`USE_SECRET_MANAGER=true` を設定しない限り、Secret Managerは使われません。

```bash
# .env.local（ローカル開発用）
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-your-key-here
# USE_SECRET_MANAGER=true は設定しない
```

## Web UI（Google Cloud Console）での操作

コマンドラインではなく、ブラウザで操作したい場合：

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクト `kanja-ai` を選択
3. 検索バーで「Secret Manager」と入力して選択
4. 「シークレットを作成」をクリック
5. 以下を入力：
   - 名前: `OPENAI_API_KEY`
   - リージョン: `asia-northeast1`
   - シークレットの値: あなたのAPIキー
6. 「シークレットを作成」をクリック
7. 作成したシークレットをクリック → 「権限」タブ
8. 「アクセス権を付与」をクリック
9. プリンシパル: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
10. ロール: `Secret Manager のシークレット アクセサー`
11. 「保存」

## セキュリティのベストプラクティス

- シークレットは絶対にGitにコミットしない
- 本番環境とステージング環境で別々のシークレットを使用する
- 定期的にAPIキーをローテーションする
- 不要になったシークレットは削除する
