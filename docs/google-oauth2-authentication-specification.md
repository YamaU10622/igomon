# Google OAuth2認証連携 仕様書

## 1. 概要

igomonにGoogle OAuth2認証を追加し、ユーザーがX（Twitter）またはGoogleのどちらかを選択してログインできるようにする。

### 基本方針

- X認証とGoogle認証は完全に独立したユーザーとして扱う
- 同じ人物がX認証とGoogle認証の両方でアカウントを作成した場合、2つの別々のユーザーとなる
- 認証プロバイダー情報は別テーブル（auth_providers）で管理する

## 2. データベース設計

### 2.1 既存テーブルの変更

#### usersテーブル

- X認証専用カラムを削除し、汎用的な構造に変更

```sql
-- 削除するカラム
- xUserId
- xAccessToken
- xRefreshToken
- xTokenExpiresAt

-- テーブル構造（変更後）
model User {
  id              Int       @id @default(autoincrement())
  uuid            String    @unique
  isBanned        Boolean   @default(false) @map("is_banned")
  bannedReason    String?   @map("banned_reason")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  profile         UserProfile?
  authProviders   AuthProvider[]

  @@map("users")
}
```

### 2.2 新規テーブル

#### auth_providersテーブル

```sql
model AuthProvider {
  id                 Int       @id @default(autoincrement())
  userId             Int       @map("user_id")
  provider           String    // "x" or "google"
  providerUserId     String    @map("provider_user_id")
  accessToken        String?   @map("access_token")
  refreshToken       String?   @map("refresh_token")
  tokenExpiresAt     DateTime? @map("token_expires_at")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  user               User      @relation(fields: [userId], references: [id])

  @@unique([provider, providerUserId])
  @@index([userId])
  @@map("auth_providers")
}
```

### 2.3 マイグレーション戦略

1. 新規テーブル（auth_providers）を作成
2. 既存のX認証ユーザーのデータをauth_providersテーブルに移行
3. usersテーブルから旧X認証カラムを削除

## 3. 認証フロー

### 3.1 ログイン選択画面

1. 未ログイン状態でログインボタンまたは回答submitボタンをクリック
2. `/login`ページへ遷移
3. 以下の選択肢を表示：
   - Xでログイン
   - Googleでログイン

### 3.2 Google認証フロー

1. **認証開始** (`/auth/google`)
   - PKCEのcode_verifierとcode_challengeを生成
   - stateを生成（CSRF対策）
   - セッションに保存
   - 回答データやリダイレクト情報を一時保存
   - Google OAuth2認証画面へリダイレクト

2. **コールバック処理** (`/auth/google/callback`)
   - stateの検証
   - 認証コードをアクセストークンに交換
   - Googleユーザー情報を取得
   - AuthProviderテーブルでユーザーを検索/作成
   - BANチェック
   - セッションを作成
   - 適切なページへリダイレクト

3. **🚨 リダイレクト先の決定ロジック（最重要・X認証と完全同一）🚨**

   **⚠️ 以下のロジックは必ず守ること。X認証（`/server/routes/auth.ts`）と完全に同じ実装にする**

   優先順位に従って処理（上から順に評価）：

   **① 一時保存した回答データがある場合（pendingAnswer）**:
   - データベースで回答済みかチェック
   - 未回答 → 回答を保存 → `/results/${problemId}`へリダイレクト
   - 回答済み → データ破棄 → `/results/${problemId}`へリダイレクト

   **② 回答ページからログインボタンでログインした場合（fromQuestionnaire）**:
   - データベースで回答済みかチェック
   - 回答済み → `/results/${problemId}`へリダイレクト
   - 未回答 → `/questionnaire/${problemId}`へリダイレクト（元のページに戻る）

   **③ 結果ページへのリダイレクトが必要な場合（redirectToResults）**:
   - `/results/${problemId}`へリダイレクト

   **④ 上記のいずれにも該当しない場合（通常のログイン）**:
   - `/`（トップページ）へリダイレクト

## 4. APIエンドポイント

### 4.1 認証関連エンドポイント

| エンドポイント          | メソッド | 説明                      |
| ----------------------- | -------- | ------------------------- |
| `/auth/google`          | GET      | Google認証開始            |
| `/auth/google/callback` | GET      | Google認証コールバック    |
| `/auth/x`               | GET      | X認証開始（既存）         |
| `/auth/x/callback`      | GET      | X認証コールバック（既存） |
| `/auth/me`              | GET      | 現在のユーザー情報取得    |
| `/auth/logout`          | POST     | ログアウト                |

### 4.2 ログイン画面

| パス     | 説明                     |
| -------- | ------------------------ |
| `/login` | ログイン選択画面（新規） |

## 5. 環境変数

以下の環境変数を追加：

```env
# Google OAuth2
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REDIRECT_URI=https://igomon.net/auth/google/callback

# 開発環境では
# GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
```

## 6. フロントエンド変更点

### 6.1 AuthContext

- login関数を修正し、`/login`ページへ遷移するように変更

### 6.2 LoginButtonコンポーネント

- ログインボタンクリック時の処理を修正

### 6.3 新規コンポーネント

- Loginページコンポーネントを作成（`/client/src/pages/Login.tsx`）
- X/Googleの選択UI

## 7. セキュリティ考慮事項

1. **PKCE（Proof Key for Code Exchange）** を使用
2. **state**パラメータでCSRF対策
3. **最小限のスコープ**のみ要求（profile, email）
4. **HTTPSでの通信**を必須とする（本番環境）
5. **セキュアなCookie設定**（httpOnly, secure, sameSite）

## 8. エラーハンドリング

### 8.1 認証エラー

- ユーザーが認証をキャンセル：トップページへリダイレクト
- API制限エラー：適切なエラーメッセージを表示
- トークン取得失敗：エラーページへリダイレクト

### 8.2 BANユーザー対応

- X認証と同様に、BANされたユーザーはログインできない
- auth_providersテーブルを通じてuserIdを特定し、User.isBannedをチェック

## 9. 実装順序

1. データベーススキーマの更新（auth_providersテーブル作成）
2. 既存データのマイグレーション
3. ログイン選択画面（/login）の実装
4. Google認証バックエンドの実装
   - **⚠️ 重要**: リダイレクトロジックは`/server/routes/auth.ts`のX認証実装を完全にコピーして使用すること
5. フロントエンドの認証フロー修正
6. テストとデバッグ
   - **⚠️ 必須テスト**: リダイレクトロジックの全パターンを確認
     - 回答データありでの認証
     - 回答ページからのログインボタン経由
     - 結果ページへのリダイレクト
     - 通常ログイン

## 10. 互換性維持

- 既存のX認証ユーザーは引き続きログイン可能
- セッション構造は変更なし（userIdベース）
- API応答形式も変更なし

## 11. 将来の拡張性

- 他の認証プロバイダー（GitHub、Discordなど）も同じ構造で追加可能
- auth_providersテーブルのproviderカラムに新しい値を追加するだけ

## 12. セッション管理の詳細

### 12.1 セッションデータの構造

```javascript
// 認証開始時のセッションデータ
req.session = {
  // PKCE & CSRF対策
  codeVerifier: string,
  state: string,

  // 回答ページからの一時データ
  pendingAnswer: {
    problemId: number,
    coordinate: string,
    reason: string,
    playerName: string,
    playerRank: string,
  },

  // ログインボタンからのリダイレクト情報
  fromQuestionnaire: boolean,
  questionnaireProblemId: string,

  // 結果ページへのリダイレクト情報
  redirectToResults: boolean,
  redirectProblemId: string,
}

// 認証完了後のセッションデータ
req.session = {
  userId: number, // 内部ユーザーID
  googleUserId: string, // GoogleユーザーID（表示用）
}
```

### 12.2 Cookieの利用

- GoogleユーザーIDをCookieに保存（30日間有効）
- API呼び出し回数を削減するため、既存ユーザーの特定に使用

## 13. 🔴 実装時の最重要確認事項

### ⚠️ 必ず守るべきポイント

1. **リダイレクトロジックは X認証の実装を完全にコピーする**
   - `/server/routes/auth.ts` の265行目〜302行目のロジックを参考に実装
   - 条件分岐の順序も完全に同じにする

2. **セッションデータの扱いも X認証と同一にする**
   - 一時データの保存・削除タイミング
   - セッション保存の確実な実行（`req.session.save()`）

3. **エラーハンドリングも X認証と同じパターンを使用**
   - 24時間ユーザー制限
   - レート制限
   - 一般的な認証エラー

これらを守ることで、ユーザー体験の一貫性を保証します。
