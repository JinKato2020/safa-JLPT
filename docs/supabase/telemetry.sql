-- 匿名テレメトリ(利用状況分析)。Cloudflare Workerから移管。PIIなし・匿名UUIDのみ。
-- クライアント(anon=未ログイン / authenticated=ログイン中)は INSERT のみ許可。
-- 読み取り(分析)はダッシュボード/service_roleで。Supabase の SQL Editor に貼って実行(CLI不要)。

-- 到達度スナップショット(1ユーザー/日 目安。複数行可・分析時に最新を採用)
create table if not exists public.tel_snapshot (
  id bigint generated always as identity primary key,
  anon_id text not null,
  account_id uuid,               -- ログイン中のみ(認証ユーザーID)。未ログインはnull=匿名。
  day date not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists tel_snapshot_anon_day on public.tel_snapshot (anon_id, day);

-- 行動イベント(answers/error/session/mock補助など)
create table if not exists public.tel_event (
  id bigint generated always as identity primary key,
  anon_id text not null,
  account_id uuid,               -- ログイン中のみ(認証ユーザーID)。未ログインはnull=匿名。
  name text not null,
  props jsonb,
  level text,
  created_at timestamptz not null default now()
);
create index if not exists tel_event_name on public.tel_event (name, created_at);

-- 模試結果
create table if not exists public.tel_mock (
  id bigint generated always as identity primary key,
  anon_id text not null,
  account_id uuid,               -- ログイン中のみ(認証ユーザーID)。未ログインはnull=匿名。
  level text,
  is_full boolean,
  pct numeric,
  sections jsonb,
  timed_out boolean,
  elapsed_sec int,
  created_at timestamptz not null default now()
);

-- 既存テーブルへの account_id 後付けマイグレーション(v1.2)。列が無いとログイン中のinsertが
-- 「column account_id does not exist」で失敗し、テレメトリが全停止するので、ビルド出荷前に必ず実行。
alter table public.tel_snapshot add column if not exists account_id uuid;
alter table public.tel_event    add column if not exists account_id uuid;
alter table public.tel_mock     add column if not exists account_id uuid;
create index if not exists tel_snapshot_account on public.tel_snapshot (account_id);

alter table public.tel_snapshot enable row level security;
alter table public.tel_event enable row level security;
alter table public.tel_mock enable row level security;

-- クライアントは INSERT のみ(select/update/deleteなし=書き込み専用)。
create policy "tel_snapshot insert" on public.tel_snapshot for insert to anon, authenticated with check (true);
create policy "tel_event insert"    on public.tel_event    for insert to anon, authenticated with check (true);
create policy "tel_mock insert"     on public.tel_mock     for insert to anon, authenticated with check (true);

-- テーブルレベルの書き込み権限(GRANT)。RLSポリシーとは別。これが無いと anon は 42501 permission denied。
-- SQLで手作りしたテーブルは anon/authenticated へ自動GRANTされないため明示が必要(Table Editor作成時は自動付与)。
grant insert on public.tel_snapshot to anon, authenticated;
grant insert on public.tel_event    to anon, authenticated;
grant insert on public.tel_mock     to anon, authenticated;
