-- ============================================================================
-- 接続国(IP由来のおおよその国) — Supabase の SQL Editor に貼って実行(CLI不要)。
-- 目的: 統計・課金計算のために「利用者が接続している国」を1人1件で持つ。
-- 方針:
--  ・国は Edge Function `geo-country` が Cloudflare(=Supabaseの前段)の国ヘッダ(cf-ipcountry)から判定して書く。
--    → 外部の地理サービスを使わない/IPアドレスは保存しない(国コードだけ保存)。
--  ・友だちには非公開(公開プロフィール friend_profiles とは別テーブル)。クライアントからは読み書き不可。
--    書き込みは Edge Function(service_role)のみ=RLSを素通り。
-- ============================================================================

create table if not exists public.user_geo (
  user_id uuid primary key references auth.users(id) on delete cascade,
  country text,                              -- ISO2(例 'JP')。IP由来のおおよその国
  updated_at timestamptz not null default now()
);

alter table public.user_geo enable row level security;
-- クライアント(anon/authenticated)からは一切触らせない。ポリシーを作らない=全拒否。
-- Edge Function は service_role で実行=RLSを素通りするので書き込みできる。
revoke all on public.user_geo from anon, authenticated;
