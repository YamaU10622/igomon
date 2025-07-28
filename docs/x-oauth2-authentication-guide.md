# X (Twitter) OAuth 2.0 認証実装ガイド

このドキュメントは、X (旧Twitter) の OAuth 2.0 認証をPKCEフローで実装する方法を説明します。

## 概要（要点だけ先取り）

- **X 公式ドキュメント**は Web App でも PKCE フローが使えると明言しています([docs.x.com][1])。
- 認可 URL は `https://twitter.com/i/oauth2/authorize`、トークン交換は `POST https://api.twitter.com/2/oauth2/token` ([docs.x.com][2])。
- `users.read` スコープを指定し `/2/users/me` を１回呼ぶだけでユーザー ID を取得できます（75 req/15 min × ユーザー）([docs.x.com][3])。呼ばなければ「100 Reads/月」枠は消費しません。
- PKCE 用の **code \_verifier / code \_challenge** は npm `pkce-challenge` で１行生成可([npm][4])。
- 月 300 ログイン程度は OAuth 系レート制限（例：`/oauth2/token` 100 req/30 min/ユーザー）に余裕があります([docs.x.com][1])。

---

## 前提：環境変数

```bash
CLIENT_ID=xxxxxxxxxxxxxxxx
CLIENT_SECRET=xxxxxxxxxxxxxxxx          # confidential クライアントのみ
REDIRECT_URI=https://igomon.net/auth/x/callback
SESSION_SECRET=change_me
```

> **Web App** は「confidential client」扱いなのでクライアントシークレットを送る必要があります([docs.x.com][1])。

---

## 1. 公式エンドポイントを直接叩く最小サンプル

### 1-1 依存パッケージ

```bash
npm i express express-session undici pkce-challenge dotenv
```

### 1-2 `app.js`

```js
import express from 'express'
import session from 'express-session'
import pkceChallenge from 'pkce-challenge'
import { request } from 'undici'
import dotenv from 'dotenv'
import crypto from 'node:crypto'
dotenv.config()

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, SESSION_SECRET } = process.env

const AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'

const app = express()
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  }),
)

/** Step-1: 認可エンドポイントへリダイレクト */
app.get('/auth/x', async (req, res) => {
  const { code_verifier, code_challenge } = await pkceChallenge()
  req.session.code_verifier = code_verifier
  req.session.state = crypto.randomUUID()

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'users.read', // 認証だけならこれで十分
    state: req.session.state,
    code_challenge,
    code_challenge_method: 'S256',
  })

  res.redirect(`${AUTH_URL}?${params.toString()}`)
})

/** Step-2: コールバックでコードを受け取り、トークン交換 */
app.get('/auth/x/callback', async (req, res) => {
  const { state, code } = req.query
  if (state !== req.session.state) return res.status(400).send('Invalid state')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: req.session.code_verifier,
    code,
  })

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const resp = await request(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const tokenSet = await resp.body.json()
  req.session.tokenSet = tokenSet // アプリ内で保持
  res.send('✅ Logged-in with X!')
})

app.listen(3000, () => console.log('Server on http://localhost:3000'))
```

- `access_token` の寿命は 2 時間。`offline.access` スコープを付ければ `refresh_token` が返ります([docs.x.com][1])。
- ユーザー ID が必要なら **一度だけ** `GET https://api.twitter.com/2/users/me` を呼び、戻り値 `data.id` を自分のユーザーテーブルに紐づければ OK です（75 req/15 min）([docs.x.com][3])。

---

## 2. ライブラリを使った簡易実装

### 2-1 `twitter-oauth2`（ミドルウェア一発）

```bash
npm i twitter-oauth2
```

```js
import { twitterOAuth2 } from 'twitter-oauth2'
app.use(
  twitterOAuth2({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    scope: 'users.read',
  }),
)
```

ルーティングは内部で自動生成されます。`req.session.tokenSet` にトークンが入り、そのまま `/2/users/me` も叩ける例が README にあります([GitHub][5])。

### 2-2 Passport.js 戦略

```bash
npm i passport @superfaceai/passport-twitter-oauth2
```

```js
import passport from 'passport'
import TwitterStrategy from '@superfaceai/passport-twitter-oauth2'

passport.use(
  new TwitterStrategy(
    {
      clientID: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      callbackURL: REDIRECT_URI,
      scope: ['users.read'],
    },
    (accessToken, refreshToken, profile, cb) => cb(null, { accessToken, profile }),
  ),
)
```

Passport 経由なので `app.get('/auth/x', passport.authenticate('twitter'))` だけでログインが完了します。詳細手順は公式ブログがわかりやすいです([GitHub][6], [DEV Community][7])。

---

## テストと運用のヒント

1. **Callback URL 完全一致**：開発用 (`http://localhost:3000/auth/x/callback`) と本番 (`https://igomon.net/auth/x/callback`) の両方をアプリ設定に登録([DEV Community][7])。
2. **最小スコープ**：認証だけなら `users.read` のみ。ツイート投稿等を許可しない限り、Free プランの「100 Reads/月」枠は消費しません([docs.x.com][3])。
3. **セッション管理**：`code_verifier` と `state` は必ずサーバー側で持ち、コールバック後に検証。
4. **リフレッシュトークンの更新**：`offline.access` を付与し `grant_type=refresh_token` で更新できます([docs.x.com][2])。

---

### まとめ

- **Node + Express + pkce-challenge** で 100 行弱のコードで純正 PKCE フローを実装可能。
- 「もっと楽に」なら `twitter-oauth2` ミドルウェアや Passport 戦略が便利。
- どの方法でも **Free プランで課金なし**、月 300 回程度のログインならレート制限にも余裕があります。

これで igomon.net に **「X でログイン」** ボタンを安全かつ無料で追加できます。 🎉

[1]: https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code 'OAuth 2.0 Authorization Code Flow with PKCE - X'
[2]: https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/user-access-token?utm_source=chatgpt.com 'How to connect to endpoints using OAuth 2.0 Authorization ... - X API'
[3]: https://docs.x.com/x-api/fundamentals/rate-limits?utm_source=chatgpt.com 'Rate limits - X API'
[4]: https://www.npmjs.com/package/pkce-challenge 'pkce-challenge - npm'
[5]: https://github.com/kg0r0/twitter-oauth2 'GitHub - kg0r0/twitter-oauth2: :baby_chick: Express.js middleware implementation for Twitter OAuth2 Client.'
[6]: https://github.com/superfaceai/passport-twitter-oauth2 'GitHub - superfaceai/passport-twitter-oauth2: Twitter OAuth 2.0 Strategy for Passport for accessing Twitter API v2'
[7]: https://dev.to/superface/how-to-use-twitter-oauth-20-and-passportjs-for-user-login-33fk 'How to use Twitter OAuth 2.0 and Passport.js for user login - DEV Community'
