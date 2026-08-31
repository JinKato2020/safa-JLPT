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
  study_seconds bigint not null default 0,   -- 累計学習時間(秒)。町ステータスの「総時間」を実データで表示するため
  studying text,
  strong text,                               -- 得意分野
  personality text,                          -- 性格キー(persona.ts)
  mood_msg text,                             -- 気分(ムードメッセージのキー)
  words jsonb not null default '[]'::jsonb,  -- my単語帳(保存した語/漢字/文法の id 参照だけ。語の中身は端末の辞書で解決)
  share_words boolean not null default true, -- 単語帳を町の相手に見せてよいか(既定 true=見せる)
  updated_at timestamptz not null default now()
);
-- 既存テーブルにも列を足す(この SQL は何度でも再実行できる=新規/既存どちらでも安全)。
alter table public.friend_profiles add column if not exists study_seconds bigint not null default 0;
alter table public.friend_profiles add column if not exists words jsonb not null default '[]'::jsonb;
alter table public.friend_profiles add column if not exists share_words boolean not null default true;

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
-- 引数が増えたので旧シグネチャを落としてから作り直す(再実行しても二重定義にならない)。
drop function if exists public.friend_publish(text,text,text,text,text,int,int,int,text,text,text,text);
drop function if exists public.friend_publish(text,text,text,text,text,int,int,int,bigint,text,text,text,text);
create or replace function public.friend_publish(
  p_nickname text, p_country text, p_gender text, p_avatar text, p_level text,
  p_streak int, p_learned int, p_week_learned int, p_study_seconds bigint default 0,
  p_studying text default null, p_strong text default null,
  p_personality text default null, p_mood_msg text default null,
  p_words jsonb default '[]'::jsonb, p_share_words boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
declare v_words jsonb := case when coalesce(p_share_words,true) then coalesce(p_words,'[]'::jsonb) else '[]'::jsonb end;
begin
  if uid is null then raise exception 'auth required'; end if;
  if not public.friend_clean_nick(p_nickname) then raise exception 'invalid nickname'; end if;
  -- 単語帳は肥大化を防ぐため最大500件までに切る(id参照だけなので軽いが上限は設ける)。
  if jsonb_typeof(v_words) = 'array' and jsonb_array_length(v_words) > 500 then
    select jsonb_agg(e) into v_words from (select e from jsonb_array_elements(v_words) e limit 500) s;
  end if;
  insert into public.friend_profiles(user_id, nickname, country, gender, avatar, level,
      streak, learned, week_learned, study_seconds, studying, strong, personality, mood_msg,
      words, share_words, updated_at)
  values (uid, btrim(p_nickname), p_country, p_gender, coalesce(p_avatar,'m_boy1'), coalesce(p_level,'N5'),
      greatest(0,p_streak), greatest(0,p_learned), greatest(0,coalesce(p_week_learned,0)),
      greatest(0,coalesce(p_study_seconds,0)),
      p_studying, p_strong, p_personality, p_mood_msg,
      coalesce(v_words,'[]'::jsonb), coalesce(p_share_words,true), now())
  on conflict (user_id) do update
    set nickname=excluded.nickname, country=excluded.country, gender=excluded.gender,
        avatar=excluded.avatar, level=excluded.level, streak=excluded.streak,
        learned=excluded.learned, week_learned=excluded.week_learned, study_seconds=excluded.study_seconds,
        studying=excluded.studying,
        strong=excluded.strong, personality=excluded.personality, mood_msg=excluded.mood_msg,
        words=excluded.words, share_words=excluded.share_words, updated_at=now();
end $$;

-- --- 招待画面: 招待主(owner)の公開プロフィールを返す(誰からの招待かを表示)。未ログインでも見られる。 ---
drop function if exists public.town_inviter(uuid);
create or replace function public.town_inviter(p_owner uuid)
returns table(user_id uuid, nickname text, country text, gender text, avatar text, level text,
              streak int, learned int, week_learned int, study_seconds bigint, studying text, strong text,
              personality text, mood_msg text, words jsonb, share_words boolean)
language sql security definer set search_path = public as $$
  select f.user_id, f.nickname, f.country, f.gender, f.avatar, f.level,
         f.streak, f.learned, f.week_learned, f.study_seconds, f.studying, f.strong, f.personality, f.mood_msg,
         case when f.share_words then f.words else '[]'::jsonb end, f.share_words
  from public.friend_profiles f where f.user_id = p_owner;
$$;

-- --- 招待を受けて参加=相互登録。両方向((owner,me)と(me,owner))を作り、互いの町に相手が出る。 ---
create or replace function public.town_join(p_owner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;
  if uid = p_owner then raise exception 'cannot join own town'; end if;
  insert into public.town_members(owner, member)
    values (p_owner, uid), (uid, p_owner)
    on conflict do nothing;
end $$;

-- --- 自分の町の住人(=参加してくれた人たち)のプロフィール。 ---
drop function if exists public.town_members();
create or replace function public.town_members()
returns table(user_id uuid, nickname text, country text, gender text, avatar text, level text,
              streak int, learned int, week_learned int, study_seconds bigint, studying text, strong text,
              personality text, mood_msg text, words jsonb, share_words boolean)
language sql security definer set search_path = public as $$
  select f.user_id, f.nickname, f.country, f.gender, f.avatar, f.level,
         f.streak, f.learned, f.week_learned, f.study_seconds, f.studying, f.strong, f.personality, f.mood_msg,
         case when f.share_words then f.words else '[]'::jsonb end, f.share_words
  from public.town_members m
  join public.friend_profiles f on f.user_id = m.member
  where m.owner = auth.uid()
  order by f.updated_at desc;
$$;

-- --- 友だち解除は town_kick 1本に統合。相互なので両方向を削除=双方の町から相手が消える。 ---
--     (旧 town_leave は「自分が抜ける」入口だったが、相互化で town_kick と同一動作になり不要=drop。)
drop function if exists public.town_leave(uuid);

-- --- 相手(p_member)との友だち関係を解除(唯一の解除口)。相互なので両方向を削除。 ---
create or replace function public.town_kick(p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;
  delete from public.town_members
   where (owner = uid and member = p_member) or (owner = p_member and member = uid);
end $$;

-- --- 実行権限。テーブルへの GRANT は不要(関数が definer で代行)。 ---
grant execute on function public.friend_publish(text,text,text,text,text,int,int,int,bigint,text,text,text,text,jsonb,boolean) to authenticated;
grant execute on function public.town_inviter(uuid) to anon, authenticated; -- 招待画面はログイン前でも表示
grant execute on function public.town_join(uuid)    to authenticated;
grant execute on function public.town_members()     to authenticated;
grant execute on function public.town_kick(uuid)    to authenticated;
