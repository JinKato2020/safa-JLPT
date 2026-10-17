-- ============================================================================
-- プッシュ通知の端末トークン — Supabase の SQL Editor に貼って実行(CLI不要)。
-- 目的: 友だちの応援などを、アプリを閉じていてもスマホへ通知するために、端末のExpoプッシュトークンを持つ。
-- 方針:
--  ・アプリがログイン時に自分のトークンを push_tokens へ直接 upsert(RLSで本人の行のみ)。1ユーザー複数端末OK(tokenが主キー)。
--  ・送信は Edge Function `cheer-notify`(service_role)が受信者のトークンを引いて Expo Push API へ。トークンはクライアントに出さない。
--  ・実配信には EAS 側の APNs(iOS)/FCM(Android) 資格情報が別途必要(手動設定)。
-- ============================================================================

create table if not exists public.push_tokens (
  token      text primary key,                 -- ExpoPushToken(端末+アプリで一意)
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text,                             -- 'ios' | 'android'
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- RLS だけでは 42501。テーブル権限の grant が必須(このプロジェクトの既知の落とし穴)。
grant select, insert, update, delete on public.push_tokens to authenticated;
revoke all on public.push_tokens from anon;

-- 本人(auth.uid())の行だけ読み書きできる。
drop policy if exists push_tokens_self on public.push_tokens;
create policy push_tokens_self on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
