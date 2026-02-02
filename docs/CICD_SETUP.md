# CI/CD自動化セットアップガイド

このプロジェクトに実装したCI/CDパイプラインのセットアップ方法を説明します。

## 📋 実装した内容

3つのGitHub Actionsワークフローを作成しました：

1. **CI（品質チェック）** - `.github/workflows/ci.yml`
   - PRや各ブランチへのプッシュ時に自動実行
   - ESLint（コード品質チェック）
   - TypeScript型チェック
   - ビルドの成功確認

2. **本番デプロイ** - `.github/workflows/deploy-production.yml`
   - `main`ブランチへのプッシュ時に自動実行
   - GCP Cloud Runに本番環境としてデプロイ

3. **ステージングデプロイ** - `.github/workflows/deploy-staging.yml`
   - `develop`ブランチへのプッシュ時に自動実行
   - テスト用のステージング環境にデプロイ

---

## 🚀 セットアップ手順

### 1. GCPでの準備

#### 1-1. Artifact Registryリポジトリの作成

```bash
gcloud artifacts repositories create ai-pharmacy \
    --repository-format=docker \
    --location=asia-northeast1 \
    --description="AI Pharmacy Docker images"
```

#### 1-2. Workload Identity連携の設定（推奨・安全な方法）

サービスアカウントキーを使わず、GitHub ActionsからGCPに安全に認証する方法です。

```bash
# プロジェクトID（自分のものに置き換えてください）
export PROJECT_ID="your-project-id"
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Workload Identity Poolの作成
gcloud iam workload-identity-pools create "github-pool" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Workload Identity Providerの作成
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# サービスアカウントの作成
gcloud iam service-accounts create github-actions \
  --project="${PROJECT_ID}" \
  --display-name="GitHub Actions Service Account"

# サービスアカウントに権限を付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# GitHubリポジトリとサービスアカウントを紐付け
# YOUR_GITHUB_USER/ai-pharmacyは自分のリポジトリに置き換えてください
gcloud iam service-accounts add-iam-policy-binding \
  "github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_USER/ai-pharmacy"
```

### 2. GitHub Secretsの設定

GitHubリポジトリの **Settings > Secrets and variables > Actions** で以下のシークレットを追加します：

| シークレット名 | 値 | 説明 |
|---------------|-----|------|
| `GCP_PROJECT_ID` | `your-project-id` | GCPのプロジェクトID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` | Workload Identity Providerのフルパス |
| `GCP_SERVICE_ACCOUNT` | `github-actions@your-project-id.iam.gserviceaccount.com` | サービスアカウントのメールアドレス |
| `AI_PROVIDER` | `openai` または `gemini` | 使用するAIプロバイダー |
| `OPENAI_API_KEY` | `sk-...` | OpenAI APIキー（本番用） |
| `OPENAI_API_KEY_STAGING` | `sk-...` | OpenAI APIキー（ステージング用、なければ本番と同じでもOK） |

---

## 📖 使い方

### ブランチ戦略

このCI/CDは以下のブランチ戦略を想定しています：

- **`main`ブランチ**: 本番環境。マージされると自動的に本番にデプロイされます。
- **`develop`ブランチ**: ステージング環境。マージされると自動的にステージング環境にデプロイされます。
- **フィーチャーブランチ**: 各機能開発用。PRを作成するとCIが実行されます。

### ワークフロー例

1. 新機能を開発する場合：
   ```bash
   git checkout -b feature/new-feature
   # 開発作業...
   git push origin feature/new-feature
   ```

2. GitHubでPRを作成すると、自動的にCIが実行されます（Lint、型チェック、ビルド確認）

3. レビュー後、`develop`ブランチにマージすると、自動的にステージング環境にデプロイされます

4. ステージングで動作確認後、`main`ブランチにマージすると、自動的に本番環境にデプロイされます

---

## 🔧 トラブルシューティング

### デプロイが失敗する場合

1. GitHub Secretsが正しく設定されているか確認
2. GCPのサービスアカウントに必要な権限があるか確認
3. Artifact Registryリポジトリが作成されているか確認

### CIでビルドエラーが出る場合

- ローカルで `npm run build` が成功するか確認
- TypeScriptエラーは `npx tsc --noEmit` で確認
- Lintエラーは `npm run lint` で確認

---

## 🎯 今後の改善案

- テストの追加（Jest、Playwright等）
- パフォーマンステストの自動化
- セキュリティスキャン（Dependabot、Snyk等）
- プレビュー環境の自動作成（PR毎に一時的な環境を作成）
- ロールバック機能
