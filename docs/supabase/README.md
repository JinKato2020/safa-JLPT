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

## 4. 注意
- アプリに埋め込むのは anon/publishable キーのみ。**service_role は絶対にアプリへ入れない**。
- データ境界は RLS が唯一。全操作で `auth.uid() = user_id` を必須にしている。
