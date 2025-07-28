# いごもん（igomon）

囲碁アンケートサイト「いごもん」は、囲碁の局面における「なぜそこに打ちたいのか」という着手の理由を集めるためのWebアプリケーションです。

## 機能

- 問題の盤面表示（SGFファイル対応）
- 着手点の選択と理由の投稿
- 投票結果の可視化（得票数の色分け表示）
- リアルタイム問題更新
- 自分の投稿の削除機能
- OGP対応（SNS共有時のカード表示）

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Express.js + TypeScript
- **データベース**: SQLite + Prisma
- **囲碁盤表示**: WGo.js
- **リアルタイム通信**: Socket.io
- **OGP画像生成**: Node.js Canvas

## 開発環境のセットアップ

### 必要な環境

- Node.js 18.x
- npm

### インストール

```bash
# 依存関係のインストール
npm install

# データベースのセットアップ
npx prisma migrate dev

# 環境変数の設定
cp .env.example .env
```

### X (Twitter) OAuth認証の設定

本プロジェクトではX OAuth 2.0認証を使用してユーザーログインを実装しています。開発環境でX認証機能を利用するには以下の設定が必要です：

1. **開発用ドメインの設定**

   X OAuthのcallback URLにlocalhostは使用できないため、開発用ドメインを設定します：

   ```bash
   # /etc/hostsファイルに以下を追加（管理者権限が必要）
   sudo echo "127.0.0.1 dev.igomon.net" >> /etc/hosts
   ```

   Windowsの場合は`C:\Windows\System32\drivers\etc\hosts`に同様の設定を追加してください。

2. **X Developer Portalでアプリを作成**
   - [X Developer Portal](https://developer.twitter.com/)にアクセス
   - 新しいアプリを作成、または既存のアプリを使用
   - OAuth 2.0を有効化（Settings > User authentication settings）

3. **必要な認証情報を取得**
   - Client ID
   - Client Secret
   - 許可するCallback URLs: `http://dev.igomon.net:5173/auth/x/callback`（開発環境）

4. **環境変数の設定**

   `.env`ファイルに以下を追加：

   ```bash
   # X OAuth2認証設定
   X_CLIENT_ID=your_client_id_here
   X_CLIENT_SECRET=your_client_secret_here
   X_REDIRECT_URI=http://dev.igomon.net:5173/auth/x/callback
   ```

5. **スコープとレート制限**
   - 認証のみの場合は`users.read`スコープで十分です
   - 無料プランでも月300回程度のログインは問題なく処理可能
   - ユーザー情報取得は`/2/users/me`エンドポイントを使用（75 req/15分の制限）

詳細な実装ガイドは`docs/x-oauth2-authentication-guide.md`を参照してください。

### WGo.jsのセットアップ

1. [WGo.js公式サイト](https://wgo.waltheri.net/download)からライブラリをダウンロード
2. ダウンロードしたファイルを `/public/wgo/` ディレクトリに配置

### 開発サーバーの起動

2つのターミナルで以下を実行：

```bash
# ターミナル1: バックエンドサーバー
npm run dev:server

# ターミナル2: フロントエンド開発サーバー
npm run dev:client
```

アプリケーションは以下のURLでアクセス可能です：

- 通常のアクセス: http://localhost:5173
- X OAuth認証を使用する場合: http://dev.igomon.net:5173 （/etc/hostsの設定が必要）

## 問題の追加方法

1. `/public/problems/{問題番号}/` ディレクトリを作成
2. 以下のファイルを配置：
   - `kifu.sgf` - SGF形式の棋譜ファイル
   - `description.txt` - 問題の情報

### description.txt の形式

```
turn: black
moves: 30
description: 次の一手を考えてください。着手とその理由を回答してください。
```

- **turn**: 手番（black または white）（任意）
- **moves**: 表示する手数（任意、省略時は最終手まで）
- **description**: 問題の説明文（必須）

## ビルド

```bash
# フロントエンドのビルド
npm run build:client

# サーバーのビルド
npm run build:server
```

## プロダクション環境での起動

### 1. 環境変数の設定

本番環境用の環境変数を設定します：

```bash
# .env ファイルを編集
NODE_ENV=production
PORT=3000  # サーバーポート（必要に応じて変更）

# X OAuth2認証設定（本番環境）
X_CLIENT_ID=your_production_client_id
X_CLIENT_SECRET=your_production_client_secret
X_REDIRECT_URI=https://igomon.net/auth/x/callback
```

**注意**: X Developer PortalでCallback URLsに本番環境のURL（`https://igomon.net/auth/x/callback`）も追加する必要があります。

### 2. ビルド

```bash
# フロントエンドとサーバーをビルド
npm run build:client
npm run build:server
```

### 3. データベースのマイグレーション

```bash
# 本番環境のデータベースをセットアップ
npx prisma migrate deploy
```

### 4. アプリケーションの起動

```bash
# プロダクションサーバーを起動
npm run start
```

アプリケーションはデフォルトで http://localhost:3000 で起動します。
