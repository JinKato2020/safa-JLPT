-- public.user_state: 1ユーザー=1行。AppState全体をjsonbで保持(段階1・LWWバックアップ)。
-- Supabase の SQL Editor に貼り付けて実行する(CLI不要)。
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  client_updated_at int8 not null default 0,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- 自分の行のみ read/write。他人の行は一切見えない・触れない。
create policy "user_state own select" on public.user_state
  for select using (auth.uid() = user_id);
create policy "user_state own insert" on public.user_state
  for insert with check (auth.uid() = user_id);
create policy "user_state own update" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_state own delete" on public.user_state
  for delete using (auth.uid() = user_id);

-- テーブルレベルの書き込み権限(GRANT)。RLSポリシーとは別物。これが無いと authenticated の
-- upsert(同期の保存)が 42501 permission denied で黙って弾かれ、user_state が空のままになる。
-- RLSで「自分の行のみ」に限定済みなので、全CRUDを付与しても他人の行は一切触れない。
grant select, insert, update, delete on public.user_state to authenticated;


-- ============================================================================
-- 紹介制度(リファラル) — referral_codes / referrals / entitlements
-- 設計書 docs/superpowers/specs/2026-08-02-referral-program-design.md §5-§7
-- クライアントは本人 read のみ(RLS)。付与・成立判定は Edge Function(service_role)だけが書く。
-- ============================================================================

-- 紹介コード(1ユーザー1コード・発行時採番)。owner を一意にして重複発行を防ぐ。
create table if not exists public.referral_codes (
  code text primary key,                                    -- 短い一意コード(8文字・混同文字除外)
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists referral_codes_owner_uniq on public.referral_codes(owner_user_id);

-- 付与台帳。new_user_ref を一意にして「1新規=1報酬」(二重取り防止)。
-- referrer_user_id は台帳のため FK を張らない(拡散側アカウント削除後も履歴を残す)。
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  referrer_user_id uuid not null,
  new_user_ref text not null unique,                        -- 新規の匿名端末ID(後でアカウントへ昇格)
  status text not null default 'pending',                   -- pending|qualified|rewarded|rejected
  install_at timestamptz,
  qualified_at timestamptz,
  created_at timestamptz not null default now()
);

-- Pro権利(自前フラグ)。付与=pro_until = max(now, pro_until) + interval '7 days'(重ねがけ=延長)。
-- reward_grant_count は拡散側の累計付与回数(集計のみ。付与上限は当面課さない=無制限)。
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pro_until timestamptz,
  reward_grant_count int not null default 0,
  trial_claimed_at timestamptz,  -- 無料お試し(7日)をこのアカウントが受け取った日時。1回だけ発行=再ログイン/再インストールで再付与しない(Edge Function 'trial-claim' が確定)。null=未受取。
  updated_at timestamptz not null default now()
);
-- 既存テーブルへの後付けマイグレーション(列が無いと trial-claim の update が失敗する)。デプロイ前に必ず実行。
alter table public.entitlements add column if not exists trial_claimed_at timestamptz;

-- 有料サブスク(1月/1年Pro)の状態。RevenueCat Webhook(EF 'revenuecat-webhook')が service_role で更新する。
--   pro_store_until が未来 = 課金が有効。plan で 1月/1年 を見分ける。紹介/お試しの pro_until とは別物(独立)。
alter table public.entitlements add column if not exists pro_plan text;            -- 'monthly' | 'yearly' | null(商品IDから推定)
alter table public.entitlements add column if not exists pro_product_id text;       -- 店の商品ID(生)
alter table public.entitlements add column if not exists pro_store_until timestamptz; -- 課金の有効期限(store expiration)
alter table public.entitlements add column if not exists pro_will_renew boolean;     -- 自動更新が続く見込みか(解約でfalse)
alter table public.entitlements add column if not exists pro_store_event text;       -- 最後に受けたイベント種別(監査用)
alter table public.entitlements add column if not exists pro_store_updated_at timestamptz; -- 最後にWebhookで更新した時刻

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.entitlements enable row level security;

-- 本人の行だけ read。書き込みポリシーは張らない=クライアントからの insert/update/delete は不可
-- (service_role は RLS を素通りするので Edge Function からの付与は影響を受けない)。
-- 再実行しても「already exists」で止まらないよう、drop してから作り直す(冪等)。
drop policy if exists rc_read on public.referral_codes;
drop policy if exists rf_read on public.referrals;
drop policy if exists en_read on public.entitlements;
create policy rc_read on public.referral_codes for select using (owner_user_id = auth.uid());
create policy rf_read on public.referrals     for select using (referrer_user_id = auth.uid());
create policy en_read on public.entitlements  for select using (user_id = auth.uid());

-- テーブルレベルの GRANT(RLSとは別)。SQLで手作りしたテーブルは anon/authenticated/service_role へ
-- 自動GRANTされないため、これが無いと本人 read すら 42501 permission denied になる
-- ([[supabase-raw-sql-tables-need-grant]])。
-- クライアント(anon/authenticated)= select のみ(書き込みは Edge Function 経由=偽装不可)。
grant select on public.referral_codes, public.referrals, public.entitlements to anon, authenticated;
-- Edge Function(service_role)= 発行/成立判定で insert/update/select する。手作りテーブルには
-- 自動付与されないので明示。これが無いと関数のテーブル書き込みが 42501 で落ち、コード発行が失敗する。
grant select, insert, update on public.referral_codes, public.referrals, public.entitlements to service_role;
