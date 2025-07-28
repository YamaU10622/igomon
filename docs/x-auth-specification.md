# X認証連携仕様書

## 概要

igomon（囲碁問題アンケートサイト）にX（旧Twitter）アカウントによるOAuth認証機能を追加する。

## 認証方式

- X OAuth 2.0 with PKCE を使用（最新の認証方式に対応）
- CSRFトークンはstateパラメータで対応

### 利用プランとコスト

- **X API Free tier**（月額0円）でOAuth 2.0認証が利用可能
- 認証のみの利用では**ツイート取得上限（100 reads/月）を消費しない**
- 無料で月300回程度のログインが可能（レート制限: ユーザーあたり30分100回のトークン取得）

### APIエンドポイント

1. `GET https://twitter.com/i/oauth2/authorize` - ユーザー認証画面
2. `POST https://api.twitter.com/2/oauth2/token` - アクセストークン取得
3. `GET https://api.twitter.com/2/users/me` - ユーザー情報取得（必要な場合のみ）

### 取得できる情報

OAuth 2.0では`/oauth2/token`のレスポンスにユーザー情報は含まれないため：

- `access_token`: アクセストークン（有効期限2時間）
- `refresh_token`: リフレッシュトークン（`offline.access`スコープ指定時）
- `token_type`: Bearer
- `expires_in`: 有効期限（秒）
- `scope`: 付与されたスコープ

**ユーザー識別には`GET /2/users/me`の呼び出しが必要**（レート制限：15分75回/ユーザー）

## 主要な変更点

### 1. 認証システムの変更

- **現在**: 自動生成トークンによる認証（初回アクセス時に自動的にユーザー作成）
- **変更後**: X OAuth認証のみ（既存の自動トークン認証は廃止）

### 2. ページごとのアクセス制御

| ページ                   | ログイン要否                     | 備考                                                       |
| ------------------------ | -------------------------------- | ---------------------------------------------------------- |
| トップページ（問題一覧） | 不要                             | ログインなしで閲覧可能                                     |
| 回答ページ               | 不要（閲覧時）<br>必要（送信時） | 問題と盤面は閲覧可能<br>送信ボタンクリック時にログイン要求 |
| 結果ページ               | 必要                             | 期限切れ・回答済みに関わらずログイン必須                   |

### 3. データベース設計の変更

#### usersテーブルの更新

既存のusersテーブルに以下のフィールドを追加：

- `xUserId`: X（Twitter）のユーザーID（必須）
  - ユーザーの一意識別子として使用
  - 同じXアカウントでの重複ログインを防ぐ
- `xAccessToken`: OAuth 2.0のアクセストークン
- `xRefreshToken`: OAuth 2.0のリフレッシュトークン（`offline.access`スコープ使用時）
- `xTokenExpiresAt`: アクセストークンの有効期限

#### userProfilesテーブルの新規作成

ユーザープロファイル情報を管理：

- `userId`: usersテーブルへの外部キー
- `name`: ユーザー名
- `rank`: 段位
- その他必要なプロファイル情報

### 4. 回答フローの変更

#### 未ログイン時の回答フロー

1. ユーザーが回答ページで問題を閲覧
2. 回答内容（座標、理由、名前、段位）を入力
3. 送信ボタンをクリック
4. 入力データをlocalStorageに一時保存
5. X OAuth認証画面へリダイレクト
6. 認証完了後、回答ページへ戻る
7. ユーザーの回答状態を確認：
   - **未回答**: 一時保存データを使用して回答を保存 → 結果ページへ遷移
   - **回答済み**: 一時保存データを破棄 → 結果ページへ遷移

#### ログイン済みの回答フロー

1. 回答ページアクセス時に回答済みチェック
2. **回答済み**: 結果ページへ自動リダイレクト
3. **未回答**: 通常通り回答可能

### 5. UI/UXの変更

#### ログインリンクの追加

- トップページと回答ページの右上にログインリンクを配置
- ログインリンクをクリックするとX OAuth認証のみ実行（その他の処理なし）

#### ログイン状態の表示

- ユーザー名等の表示は不要（ログイン状態の視覚的表示なし）

### 6. 初回ログイン時の処理

回答ページから初めてXアカウントでログインした場合：

1. X OAuth 2.0認証完了（PKCEフロー）
2. `GET /2/users/me`でユーザー情報取得
3. usersテーブルに新規ユーザー作成（xUserId、アクセストークン等を保存）
4. 入力された名前と段位をuserProfilesテーブルに保存
5. 回答データを保存
6. 結果ページへ遷移

### 7. コールバックURL

OAuth 2.0ではアプリケーション設定にコールバックURLを登録：

- 本番環境: `https://igomon.net/auth/x/callback`
- 開発環境: `http://localhost:5173/auth/x/callback`（ポート番号は環境に応じて調整）

## セキュリティ考慮事項

1. **CSRF対策**: stateパラメータとPKCEのcode_verifierで二重に対策
2. **トークン管理**: アクセストークン・リフレッシュトークンをデータベースに暗号化して保存
3. **HTTPS**: 本番環境では必須
4. **PKCEによる認証コード横取り対策**: code_challengeとcode_verifierで検証
5. **クライアントシークレット**: サーバー側で安全に管理（環境変数）

## 実装順序（参考）

1. データベーススキーマの更新（users、userProfilesテーブル）
2. X OAuth 2.0 PKCE認証の実装（エンドポイント、ミドルウェア）
3. 既存の認証システムの置き換え
4. UI更新（ログインリンク追加、フロー変更）
5. 回答データの一時保存機能
6. テストとデバッグ

## 推奨ライブラリ

### 方法1: 手動実装（推奨）

- **pkce-challenge**: PKCE用のcode_verifier/code_challenge生成
- **undici**: HTTPリクエスト用
- **express-session**: セッション管理

### 方法2: ライブラリ利用

- **twitter-oauth2**: Express用OAuth 2.0ミドルウェア
- **@superfaceai/passport-twitter-oauth2**: Passport.js用Twitter OAuth 2.0戦略

## 注意事項

- 既存ユーザーデータの移行は行わない
- X APIの利用にはX Developer Accountの作成とアプリケーション登録が必要
- OAuth 2.0ではClient IDとClient Secretが必要（Webアプリは機密クライアント）
- レート制限（30分100回/ユーザー）があるが、月300ログイン程度なら問題なし
- アクセストークンの有効期限は2時間（リフレッシュトークンで更新可能）

## 実装例

### 環境変数設定

```bash
# .env
CLIENT_ID=xxxxxxxxxxxxxxxx
CLIENT_SECRET=xxxxxxxxxxxxxxxx
REDIRECT_URI=https://igomon.net/auth/x/callback
SESSION_SECRET=your_session_secret_here
```

### 基本的な実装（Express + PKCE）

```javascript
import express from 'express'
import session from 'express-session'
import pkceChallenge from 'pkce-challenge'
import { request } from 'undici'
import crypto from 'node:crypto'
import dotenv from 'dotenv'

dotenv.config()

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, SESSION_SECRET } = process.env

const AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const USER_URL = 'https://api.twitter.com/2/users/me'

const app = express()

// セッション設定
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // 本番環境ではHTTPS必須
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24時間
    },
  }),
)

// Step 1: 認証開始エンドポイント
app.get('/auth/x', async (req, res) => {
  // PKCE用のcode_verifierとcode_challengeを生成
  const { code_verifier, code_challenge } = await pkceChallenge()

  // CSRF対策用のstateを生成
  const state = crypto.randomUUID()

  // セッションに保存
  req.session.code_verifier = code_verifier
  req.session.state = state

  // 回答ページからのリダイレクトの場合、回答データを一時保存
  if (req.query.answer_data) {
    req.session.pendingAnswer = JSON.parse(req.query.answer_data)
  }

  // 認可URLのパラメータ
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'users.read offline.access', // offline.accessでリフレッシュトークン取得
    state: state,
    code_challenge,
    code_challenge_method: 'S256',
  })

  // X認証画面へリダイレクト
  res.redirect(`${AUTH_URL}?${params.toString()}`)
})

// Step 2: コールバックエンドポイント
app.get('/auth/x/callback', async (req, res) => {
  const { state, code, error } = req.query

  // エラーチェック
  if (error) {
    console.error('認証エラー:', error)
    return res.redirect('/login?error=auth_failed')
  }

  // CSRF対策：stateの検証
  if (state !== req.session.state) {
    return res.status(400).send('Invalid state parameter')
  }

  try {
    // アクセストークンの取得
    const tokenData = await exchangeCodeForToken(code, req.session.code_verifier)

    // ユーザー情報の取得
    const userData = await fetchUserInfo(tokenData.access_token)

    // ユーザーの作成または更新
    const user = await createOrUpdateUser(userData, tokenData)

    // セッションにユーザー情報を保存
    req.session.userId = user.id
    req.session.xUserId = userData.id

    // 一時保存した回答データがある場合の処理
    if (req.session.pendingAnswer) {
      const answerData = req.session.pendingAnswer
      delete req.session.pendingAnswer

      // 回答を保存
      await saveAnswer(user.id, answerData)

      // 結果ページへリダイレクト
      return res.redirect(`/results/${answerData.problemId}`)
    }

    // 通常のログイン完了
    res.redirect('/')
  } catch (error) {
    console.error('トークン交換エラー:', error)
    res.status(500).send('認証処理中にエラーが発生しました')
  }
})

// トークン交換関数
async function exchangeCodeForToken(code, codeVerifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
    code,
  })

  // Basic認証ヘッダー（Webアプリは機密クライアント）
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (response.statusCode !== 200) {
    const error = await response.body.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return await response.body.json()
}

// ユーザー情報取得関数
async function fetchUserInfo(accessToken) {
  const response = await request(USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.statusCode !== 200) {
    throw new Error('Failed to fetch user info')
  }

  const { data } = await response.body.json()
  return data
}

// ユーザー作成/更新関数
async function createOrUpdateUser(xUserData, tokenData) {
  // 既存ユーザーの確認
  const existingUser = await db.users.findOne({ xUserId: xUserData.id })

  if (existingUser) {
    // トークン情報を更新
    await db.users.update(existingUser.id, {
      xAccessToken: tokenData.access_token,
      xRefreshToken: tokenData.refresh_token,
      xTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    })
    return existingUser
  }

  // 新規ユーザー作成
  const newUser = await db.users.create({
    xUserId: xUserData.id,
    xAccessToken: tokenData.access_token,
    xRefreshToken: tokenData.refresh_token,
    xTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
  })

  return newUser
}

// リフレッシュトークンを使用したアクセストークン更新
async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  })

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (response.statusCode !== 200) {
    throw new Error('Token refresh failed')
  }

  return await response.body.json()
}

// 認証チェックミドルウェア
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  next()
}

// ログアウトエンドポイント
app.post('/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.json({ success: true })
  })
})

export default app
```

### フロントエンド側の実装例（回答ページ）

```javascript
// 回答送信時の処理
async function submitAnswer() {
  const answerData = {
    problemId: currentProblemId,
    coordinate: selectedCoordinate,
    reason: document.getElementById('reason').value,
    name: document.getElementById('name').value,
    rank: document.getElementById('rank').value,
  }

  try {
    // 回答送信API呼び出し
    const response = await fetch('/api/answers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(answerData),
    })

    if (response.status === 401) {
      // 未認証の場合、回答データを含めてX認証へリダイレクト
      const encodedData = encodeURIComponent(JSON.stringify(answerData))
      window.location.href = `/auth/x?answer_data=${encodedData}`
      return
    }

    if (response.ok) {
      // 回答成功、結果ページへ
      window.location.href = `/results/${currentProblemId}`
    }
  } catch (error) {
    console.error('回答送信エラー:', error)
    alert('回答の送信に失敗しました')
  }
}
```

### データベーススキーマ例（PostgreSQL）

```sql
-- usersテーブル
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  x_user_id VARCHAR(255) UNIQUE NOT NULL,
  x_access_token TEXT,
  x_refresh_token TEXT,
  x_token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_users_x_user_id ON users(x_user_id);

-- userProfilesテーブル
CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  rank VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
