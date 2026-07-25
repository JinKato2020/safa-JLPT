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
