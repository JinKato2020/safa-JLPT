-- ============================================================================
-- 友だち(招待制) — Supabase の SQL Editor に貼って実行(CLI不要)。
-- 方針(ユーザー確定 2026-08-07):
--  ・検索はしない。招待リンク(SNS)を送り、相手が「町に参加/断る」を選ぶ。
--  ・参加を選ぶと、招待を出した側(owner)の町にだけ その人(member)が住人として現れる(片方向)。
--  ・参加する側はアカウント(ログイン)必須。プロフィールは friend_publish で公開される。
--  ・クライアントはテーブルに直接触らない。全操作は SECURITY DEFINER 関数(RPC)経由=なりすまし不可。
-- クライアントからの呼び方(参考):
--   supabase.rpc('friend_publish', { ...自分の公開プロフィール... })   // 参加/表示に使う自分の情報
--   supabase.rpc('town_inviter', { p_owner })   // 招待画面: 招待主のプロフィール(誰からの招待か)
--   supabase.rpc('town_join',    { p_owner })   // 招待を受けて owner の町に参加
--   supabase.rpc('town_members')                // 自分の町の住人(=参加してくれた人たち)
--   supabase.rpc('town_leave',   { p_owner })   // owner の町から自分が抜ける
--   supabase.rpc('town_kick',    { p_member })  // 自分の町から member を外す
-- ============================================================================

-- 1) 公開プロフィール(町のステータス表示に使う本人の情報)。本人=1行。
create table if not exists public.friend_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  country text,                              -- 国コード(ISO2, 例 'VN')
  gender text,                               -- 'm' | 'f'
  avatar text not null default 'm_boy1',     -- アバターコード(m_boy1..f_g5)
  level text not null default 'N5',
  streak int not null default 0,
  learned int not null default 0,            -- 覚えた語数
  week_learned int not null default 0,
  studying text,
  strong text,                               -- 得意分野
  personality text,                          -- 性格キー(persona.ts)
  mood_msg text,                             -- 気分(ムードメッセージのキー)
  updated_at timestamptz not null default now()
);

-- 2) 町の住人(片方向)。owner の町に member が出る。owner が招待し member が参加した関係。
create table if not exists public.town_members (
  owner uuid not null references auth.users(id) on delete cascade,   -- 町の持ち主(招待した人)
  member uuid not null references auth.users(id) on delete cascade,  -- 参加した人(owner の町に出る)
  created_at timestamptz not null default now(),
  primary key (owner, member)
);
create index if not exists town_members_owner on public.town_members (owner);

alter table public.friend_profiles enable row level security;
alter table public.town_members    enable row level security;
revoke all on public.friend_profiles, public.town_members from anon, authenticated;

-- --- ニックネームの最低限チェック。 ---
create or replace function public.friend_clean_nick(p text)
returns boolean language sql immutable as $$ select length(btrim(p)) between 1 and 20; $$;

-- --- 自分の公開プロフィールを upsert(検索対象ではないが、町に表示するために必要)。 ---
create or replace function public.friend_publish(
  p_nickname text, p_country text, p_gender text, p_avatar text, p_level text,
  p_streak int, p_learned int, p_week_learned int,
  p_studying text default null, p_strong text default null,
  p_personality text default null, p_mood_msg text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;
  if not public.friend_clean_nick(p_nickname) then raise exception 'invalid nickname'; end if;
  insert into public.friend_profiles(user_id, nickname, country, gender, avatar, level,
      streak, learned, week_learned, studying, strong, personality, mood_msg, updated_at)
  values (uid, btrim(p_nickname), p_country, p_gender, coalesce(p_avatar,'m_boy1'), coalesce(p_level,'N5'),
      greatest(0,p_streak), greatest(0,p_learned), greatest(0,coalesce(p_week_learned,0)),
      p_studying, p_strong, p_personality, p_mood_msg, now())
  on conflict (user_id) do update
    set nickname=excluded.nickname, country=excluded.country, gender=excluded.gender,
        avatar=excluded.avatar, level=excluded.level, streak=excluded.streak,
        learned=excluded.learned, week_learned=excluded.week_learned, studying=excluded.studying,
        strong=excluded.strong, personality=excluded.personality, mood_msg=excluded.mood_msg, updated_at=now();
end $$;

-- --- 招待画面: 招待主(owner)の公開プロフィールを返す(誰からの招待かを表示)。未ログインでも見られる。 ---
create or replace function public.town_inviter(p_owner uuid)
returns table(user_id uuid, nickname text, country text, gender text, avatar text, level text,
              streak int, learned int, week_learned int, studying text, strong text,
              personality text, mood_msg text)
language sql security definer set search_path = public as $$
  select f.user_id, f.nickname, f.country, f.gender, f.avatar, f.level,
         f.streak, f.learned, f.week_learned, f.studying, f.strong, f.personality, f.mood_msg
  from public.friend_profiles f where f.user_id = p_owner;
$$;

-- --- 招待を受けて owner の町に参加(片方向)。自分の町には owner は出ない。 ---
create or replace function public.town_join(p_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;
  if uid = p_owner then raise exception 'cannot join own town'; end if;
  insert into public.town_members(owner, member) values (p_owner, uid) on conflict do nothing;
end $$;

-- --- 自分の町の住人(=参加してくれた人たち)のプロフィール。 ---
create or replace function public.town_members()
returns table(user_id uuid, nickname text, country text, gender text, avatar text, level text,
              streak int, learned int, week_learned int, studying text, strong text,
              personality text, mood_msg text)
language sql security definer set search_path = public as $$
  select f.user_id, f.nickname, f.country, f.gender, f.avatar, f.level,
         f.streak, f.learned, f.week_learned, f.studying, f.strong, f.personality, f.mood_msg
  from public.town_members m
  join public.friend_profiles f on f.user_id = m.member
  where m.owner = auth.uid()
  order by f.updated_at desc;
$$;

-- --- owner の町から自分が抜ける。 ---
create or replace function public.town_leave(p_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  delete from public.town_members where owner = p_owner and member = auth.uid();
end $$;

-- --- 自分の町から member を外す。 ---
create or replace function public.town_kick(p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  delete from public.town_members where owner = auth.uid() and member = p_member;
end $$;

-- --- 実行権限。テーブルへの GRANT は不要(関数が definer で代行)。 ---
grant execute on function public.friend_publish(text,text,text,text,text,int,int,int,text,text,text,text) to authenticated;
grant execute on function public.town_inviter(uuid) to anon, authenticated; -- 招待画面はログイン前でも表示
grant execute on function public.town_join(uuid)    to authenticated;
grant execute on function public.town_members()     to authenticated;
grant execute on function public.town_leave(uuid)   to authenticated;
grant execute on function public.town_kick(uuid)    to authenticated;
