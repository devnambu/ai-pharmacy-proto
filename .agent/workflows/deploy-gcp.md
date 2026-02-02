---
description: Google Cloud Console (Web UI) based deployment via GitHub
---
# Google Cloud Console (Web画面) でのデプロイ手順

ターミナルでのコマンド操作ではなく、ブラウザ上のGoogle Cloud Console画面を使ってデプロイする方法です。
この方法では、**GitHub**を経由してソースコードをGCPに連携させます。

## 1. 準備：GitHubへのコードのアップロード

まず、ローカルのコードをGitHubリポジトリにアップロードする必要があります。
※ GitHubアカウントが必要です。

1. GitHubで新しいリポジトリ（例: `ai-pharmacy`）を作成します。
2. ターミナルで以下のコマンドを実行して、コードをGitHubに送ります。
   （`YOUR_GITHUB_USER` はあなたのユーザー名に置き換えてください）

```bash
# gitの初期化（まだの場合）
git init
git add .
git commit -m "Initial commit"

# リモートリポジトリを追加してプッシュ
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USER/ai-pharmacy.git
git push -u origin main
```

## 2. GCPコンソールでの設定

ここからはブラウザでの操作になります。

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスします。
2. 左上のプロジェクト選択プルダウンから、使用するプロジェクトを選択（または新規作成）します。
3. 検索バーに「Cloud Run」と入力して選択します。

## 3. サービスの作成

1. 画面上部の **[サービスの作成]** をクリックします。
2. **「リポジトリから継続的にデプロイする」** を選択し、**[CLOUD BUILD のセットアップ]** をクリックします。

### Cloud Build のセットアップ画面
1. **リポジトリ プロバイダ**: GitHub を選択
2. **リポジトリ**: 先ほど作成した `ai-pharmacy` リポジトリを選択（初回は認証が必要です）
3. **次へ** をクリック
4. **ビルド構成**:
   - **ビルドタイプ**: Dockerfile
   - **ソースの場所**: `/Dockerfile` (デフォルトのまま)
5. **[保存]** をクリック

## 4. サービス設定

元の画面に戻ったら、以下の設定を行います。

1. **サービス名**: `ai-pharmacy` (自動入力されます)
2. **リージョン**: `asia-northeast1` (東京) を選択するのがおすすめです。
3. **認証**:
   - Webアプリとして公開する場合: **[未認証の呼び出しを許可]** を選択
4. **コンテナ、変数、シークレット...** のタブを開きます（重要！）
   - **変数とシークレット** タブを選択
   - **[変数を追加]** をクリックして環境変数を追加します：
     - 名前: `AI_PROVIDER` / 値: `openai`
     - 名前: `OPENAI_API_KEY` / 値: `あなたのAPIキー`
5. **[作成]** ボタンをクリックします。

## 5. 完了

デプロイが自動的に開始されます。数分待つと、画面上部に「URL」が表示されます。
そのURLをクリックすれば、アプリにアクセスできます！

### 今後の更新方法
この設定をしておけば、今後はパソコンでコードを修正してGitHubにプッシュ(`git push`)するだけで、自動的にGCPに新しいバージョンがデプロイされるようになります。
