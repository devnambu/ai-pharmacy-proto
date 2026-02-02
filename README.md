# AI Pharmacy - 服薬指導ロールプレイアプリ

薬剤師のための服薬指導練習アプリケーション。AIが患者役を演じてロールプレイをサポートします。

## 概要

このアプリケーションは、薬剤師が服薬指導のスキルを練習できるWebアプリケーションです。
AIが患者役（佐藤 健太さん、35歳男性、高血圧）として振る舞い、リアルな会話練習ができます。

### 主な機能

- 💊 患者とのチャット形式のロールプレイ
- 🤖 OpenAI (GPT-4o) または Google Gemini による自然な会話
- 📱 レスポンシブデザイン（スマホ・タブレット対応）
- 🔐 GCP Secret Manager対応（本番環境でのセキュアな運用）

## 技術スタック

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **AI SDK**: Vercel AI SDK
- **AI Provider**: OpenAI (GPT-4o) / Google Gemini 2.0
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui, Radix UI
- **Deployment**: Docker, Google Cloud Run
- **CI/CD**: GitHub Actions

## セットアップ

### 環境変数の設定

`.env.local` ファイルを作成して、以下の環境変数を設定してください：

```bash
# AIプロバイダーの選択 (openai または gemini)
AI_PROVIDER=openai

# OpenAIを使用する場合
OPENAI_API_KEY=your-openai-api-key

# Geminiを使用する場合
# AI_PROVIDER=gemini
# GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
```

### ローカル開発

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

### Dockerでの実行

```bash
# イメージのビルド
docker build -t ai-pharmacy .

# コンテナの起動
docker run -p 3000:3000 \
  -e AI_PROVIDER=openai \
  -e OPENAI_API_KEY=your-api-key \
  ai-pharmacy
```

## デプロイ

### Google Cloud Runへのデプロイ

詳細な手順は以下のドキュメントを参照してください：

- Web UI でのデプロイ: [`.agent/workflows/deploy-gcp.md`](.agent/workflows/deploy-gcp.md)
- CI/CD セットアップ: [`docs/CICD_SETUP.md`](docs/CICD_SETUP.md)

### CI/CDパイプライン

このプロジェクトには、GitHub Actionsを使用したCI/CDパイプラインが実装されています：

- **CI（品質チェック）**: すべてのPRとプッシュで自動実行
  - ESLint
  - TypeScript型チェック
  - ビルド確認

- **自動デプロイ**:
  - `main`ブランチ → 本番環境（Cloud Run）
  - `develop`ブランチ → ステージング環境

詳細なセットアップ手順は [`docs/CICD_SETUP.md`](docs/CICD_SETUP.md) を参照してください。

## プロジェクト構成

```
ai-pharmacy/
├── src/
│   ├── app/
│   │   ├── api/chat/          # AIチャットAPI
│   │   ├── layout.tsx          # ルートレイアウト
│   │   └── page.tsx            # トップページ
│   ├── components/
│   │   ├── chat/               # チャットUI
│   │   └── ui/                 # 共通UIコンポーネント
│   └── lib/
│       ├── ai-config.ts        # AIプロバイダー設定
│       ├── secrets.ts          # Secret Manager連携
│       └── utils.ts            # ユーティリティ
├── .github/workflows/          # GitHub Actions CI/CD
├── docs/                       # ドキュメント
├── Dockerfile                  # Dockerイメージ定義
└── docker-compose.yml          # Dockerローカル実行用
```

## ライセンス

このプロジェクトはプライベート使用を想定しています。

## コントリビューション

プルリクエストは歓迎します。大きな変更の場合は、まずissueで議論してください。
