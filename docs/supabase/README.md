# Supabase 設定手順（まいにちJLPT・段階1）

## 1. テーブル＋RLS（必須・CLI不要）
Supabase ダッシュボード → SQL Editor → New query に `schema.sql` の中身を貼って **Run**。
`public.user_state` テーブルと4つのRLSポリシーが作成される。

## 1b. 匿名テレメトリのテーブル（必須・CLI不要）
SQL Editor に `telemetry.sql` の中身を貼って **Run**。
`tel_snapshot` / `tel_event` / `tel_mock` と INSERT専用RLSが作成される（旧Cloudflare Workerから移管）。
未適用でもアプリは壊れない（insert失敗→キュー滞留→適用後に再送）。

## 2. 認証設定（必須）
Authentication → Sign In / Providers → **Email = 有効**。
Authentication → **Confirm email = ON**（本人確認）。
Authentication → パスワード最小長 = 8。

## 3. Edge Function `delete-account`（アカウント完全削除・任意/後追い可）
Supabase CLI が必要:

```
supabase login
supabase link --project-ref nxovouiqelynryumjvyq
supabase functions deploy delete-account
```

`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` は Supabase が自動注入する。
未デプロイでも、アプリは「自分のデータ行削除＋サインアウト」にフォールバックして動作する
（認証ユーザーの完全削除だけが後追いになる）。

## 5. 紹介制度（リファラル）— 有効化する時だけ（任意）
未デプロイでもアプリは壊れない（休眠。「紹介コード入力済み」になるまで呼ばれない）。有効化する時に:

1. **テーブル（CLI不要）**: SQL Editor に `schema.sql` を貼って **Run**（`create table if not exists` なので既存分は影響なし。末尾の referral_codes / referrals / entitlements ＋RLS＋grant が追加される）。
2. **Edge Function 2本（CLI）**:
   ```
   supabase functions deploy referral-issue-code
   supabase functions deploy referral-qualify
   ```
   `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` は自動注入。
- 付与は自前 `entitlements.pro_until`（ストア課金を通さない）。成立判定はサーバー確定・冪等・自己紹介ブロック。
- 挙動: 紹介成立で**拡散側は即時 Pro+1週**、新規側の2週目は**登録して受取**（未登録でも拡散側はブロックしない）。

## 6. 有料サブスク(1月/1年Pro)の状態をダッシュボードに出す（RevenueCat Webhook・任意）
未設定でもアプリは壊れない（課金自体はRevenueCatで動く。これは「自前DB＆管理ダッシュボードにも課金状態を持つ」ための同期）。

1. **列追加（CLI不要）**: SQL Editor に `schema.sql` を貼って **Run**（`entitlements` に `pro_plan/pro_product_id/pro_store_until/pro_will_renew/…` が `add column if not exists` で足される。既存分に影響なし）。
2. **ビュー更新（CLI不要）**: SQL Editor に `dashboard_views.sql` を貼って **Run**（`v_admin_devices` を作り直し、上記 pro_* 列を追加。grant も再付与される）。
3. **Edge Function（CLI）** — Webサインインではないので **`--no-verify-jwt` 必須**（認証は下の共有シークレットで自前に行う）:
   ```
   supabase functions deploy revenuecat-webhook --no-verify-jwt
   supabase secrets set RC_WEBHOOK_AUTH="任意の長いランダム文字列"
   ```
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` は自動注入。
4. **RevenueCat 側（管理画面）**: Project → Integrations → **Webhooks** を追加。
   - URL = `https://nxovouiqelynryumjvyq.supabase.co/functions/v1/revenuecat-webhook`
   - **Authorization header** = 手順3の `RC_WEBHOOK_AUTH` と**同じ文字列**（EFはこれを一致比較。違えば401）。
   - 「Send test event」で 200 が返ればOK。以後、購入/更新/解約/失効が自動でDBへ反映。
- app_user_id は **ログイン時 `Purchases.logIn(userId)`**（[App.tsx:307]）で実アカウントIDを使うので、Webhookはどのアカウントの課金かを特定できる。匿名IDの購入は保存せず無視（200）。
- ダッシュボードの「状態」列に **1年Pro / 1月Pro（残日数・更新有無）** が出るようになる。既存の 7日Pro（お試し/紹介）とは別表示。

## 4. 注意
- アプリに埋め込むのは anon/publishable キーのみ。**service_role は絶対にアプリへ入れない**。
- データ境界は RLS が唯一。全操作で `auth.uid() = user_id` を必須にしている。
