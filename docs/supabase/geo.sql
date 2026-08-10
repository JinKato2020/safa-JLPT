-- ============================================================================
-- 接続国(IP由来のおおよその国) — Supabase の SQL Editor に貼って実行(CLI不要)。
-- 目的: 統計・課金計算のために「利用者が接続している国」を1人1件で持つ。
-- 方針(2026-08-10 変更):
--  ・国コードはアプリが Cloudflare(=safa-lang.com の前段)の trace(loc=XX)から取得し、
--    ログイン時に user_geo へ「本人ぶんの1行」を直接 upsert する(Edge Function 経由をやめた)。
--    → 外部の地理サービスを使わない/IPアドレスは保存しない(国コードだけ保存)。
--  ・旧方式(Edge Function `geo-country` が service_role で書く)は「呼び出しは来るのに書けない」不具合が続いたため撤去。
--    関数は残っていても未使用(消してよい)。
--  ・友だちには非公開(公開プロフィール friend_profiles とは別テーブル)。RLSで「本人だけが自分の行を読み書き」。
-- ============================================================================

create table if not exists public.user_geo (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country text,                              -- ISO2(例 'JP')。IP由来のおおよその国
  updated_at timestamptz not null default now()
);

alter table public.user_geo enable row level security;

-- RLS だけでは 42501(権限なし)。テーブル権限の grant が必須(このプロジェクトの既知の落とし穴)。
grant select, insert, update on public.user_geo to authenticated;
revoke all on public.user_geo from anon;   -- 未ログインには一切触らせない

-- 本人(auth.uid())の行だけ読み書きできる。他人の国は見えない/書けない。
drop policy if exists user_geo_self on public.user_geo;
create policy user_geo_self on public.user_geo
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
