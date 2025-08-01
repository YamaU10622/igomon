## 1. 事前準備（Google Cloud Console）

1. 新規プロジェクトを作成
2. **OAuth 同意画面**
   - ユーザー種別: 外部
   - 承認済みドメイン: `igomon.net`（本番）＋ `localhost`（開発用）

3. **OAuth 2.0 クライアント ID** → アプリの種類「ウェブアプリ」で発行
   - リダイレクト URI 例
     - `https://igomon.net/auth/google/callback`（本番）
     - `http://localhost:3000/auth/google/callback`（開発）

4. 表示された **Client ID / Client Secret** をメモ

> _Google はサーバーサイド Web アプリ向けに OAuth 2.0 エンドポイントと公式ライブラリの利用を推奨しています_ ([Google for Developers][1])

---

## 2. パッケージインストール

```bash
npm init -y
npm install express express-session passport passport-google-oauth20 dotenv
```

---

## 3. ソース構成

```
.
├─ .env
└─ index.js
```

### .env

```dotenv
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=yyyyyyyyyyyyyyyyyyyyyyyy
SESSION_SECRET=some-long-random-string
NODE_ENV=development   # ←本番は production
```

### index.js

```js
require('dotenv').config()

const express = require('express')
const session = require('express-session')
const passport = require('passport')
const GoogleStr = require('passport-google-oauth20').Strategy

const app = express()

/** Google ストラテジ設定 */
passport.use(
  new GoogleStr(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
      scope: ['profile', 'email'],
      state: true, // CSRF 対策
    },
    async (accessToken, refreshToken, profile, done) => {
      /* ここでユーザを DB に find-or-create する */
      return done(null, profile)
    },
  ),
)

/** セッションシリアライズ */
passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((obj, done) => done(null, obj))

/** ミドルウェア */
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // 本番は HTTPS で secure クッキー
      httpOnly: true,
    },
  }),
)
app.use(passport.initialize())
app.use(passport.session())

/** ルーティング */
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    const u = req.user
    res.send(`<h1>こんにちは、${u.displayName} さん！</h1>
              <p><a href="/logout">ログアウト</a></p>`)
  } else {
    res.send('<a href="/auth/google">Google でログイン</a>')
  }
})

app.get('/auth/google', passport.authenticate('google'))

app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    successRedirect: '/',
  }),
)

app.get('/logout', (req, res, next) => {
  req.logout((err) => (err ? next(err) : res.redirect('/')))
})

/** 起動 */
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`http://localhost:${PORT}`))
```

_Passport 用の Google ストラテジー（`passport-google-oauth20`）は Google OAuth 2.0 をラップしているため、数行で認証フローを組み込めます_ ([GitHub][2])

---

## 4. 動作確認

1. `.env` にローカル用リダイレクト URI を追加した **Client ID**／**Client Secret** を設定
2. `node index.js` → ブラウザで [http://localhost:3000](http://localhost:3000)
3. 「Google でログイン」をクリック → Google の同意画面 → localhost へ戻り、ユーザー名が表示されれば成功

---

## 5. トークン検証 & セキュリティ

- パスポートは既に Google 側で署名済み _id_token_ を検証していますが、**バックエンド API を別サーバーで呼ぶ場合**は
  `google-auth-library` の `OAuth2Client#verifyIdToken()` で再検証するのが安全です ([Google for Developers][3])
- 本番では **HTTPS を必須**にし、`cookie.secure = true` にする
- 取得するスコープは最小限（`profile email`）に絞る
- 同意画面を「本番公開」にするまでは、テスター（Google アカウント）の追加を忘れずに

---

### これで「Googleアカウント連携ログイン」の基本形は完成です 🎉

あとは

- DB で `googleId` をキーにユーザー管理
- 必要に応じて `accessToken`／`refreshToken` を使い Google API (Gmail, Drive など) を呼び出す
- Next.js や NestJS へ組み込む場合はミドルウェア部分だけ移植

などを行えば igomon.net へ簡単に統合できます。

[1]: https://developers.google.com/identity/protocols/oauth2/web-server?utm_source=chatgpt.com 'Using OAuth 2.0 for Web Server Applications | Authorization'
[2]: https://github.com/jaredhanson/passport-google-oauth2 'GitHub - jaredhanson/passport-google-oauth2: Google authentication strategy for Passport and Node.js.'
[3]: https://developers.google.com/identity/sign-in/web/backend-auth 'Authenticate with a backend server  |  Web guides  |  Google for Developers'
