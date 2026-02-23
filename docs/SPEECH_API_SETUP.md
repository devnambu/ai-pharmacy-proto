# GCP Speech-to-Text API セットアップガイド

## 1. Speech-to-Text API の有効化

Google Cloud Console または gcloud CLI で API を有効化します。

### gcloud CLI

```bash
gcloud services enable speech.googleapis.com --project=kanja-ai
```

### Web Console

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクト `kanja-ai` を選択
3. 「APIとサービス」→「ライブラリ」
4. 「Cloud Speech-to-Text API」を検索
5. 「有効にする」をクリック

## 2. サービスアカウントの権限確認

Cloud Run で使用するサービスアカウントに Speech-to-Text API の権限が必要です。

```bash
# デフォルトのCompute Engine サービスアカウントを確認
gcloud iam service-accounts list --project=kanja-ai

# 必要に応じて権限を付与
gcloud projects add-iam-policy-binding kanja-ai \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/speech.client"
```

> `SERVICE_ACCOUNT_EMAIL` は実際のサービスアカウントのメールアドレスに置き換えてください。

## 3. 動作確認

### API が有効か確認

```bash
gcloud services list --enabled --project=kanja-ai | grep speech
```

### テスト

Cloud Run にデプロイ後、ブラウザで以下の手順で動作確認できます：

1. アプリにアクセス
2. マイクボタンをクリック（マイク許可を求められたら許可）
3. 日本語で話しかける
4. 1秒の無音後、自動的に文字起こし→送信されることを確認

## 4. 料金

| プラン | 月間無料枠 | 超過料金 |
|--------|-----------|----------|
| 標準モデル | 60分/月 | $0.006/15秒 |

詳細: [Speech-to-Text の料金](https://cloud.google.com/speech-to-text/pricing)

## 5. トラブルシューティング

| エラー | 原因 | 対処 |
|-------|------|------|
| `PERMISSION_DENIED` | API 未有効化 or 権限不足 | 手順1,2を確認 |
| `UNAUTHENTICATED` | サービスアカウント認証失敗 | Cloud Run のサービスアカウント設定を確認 |
| 空の文字起こし結果 | 音声が短すぎる or 無音 | マイクの動作確認、閾値調整 |
