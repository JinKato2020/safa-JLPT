-- ============================================================================
-- 言葉の都・中央広場(plaza) — 非競争の「ゆるいつながり」。Supabase の SQL Editor に貼って実行(CLI不要)。
-- 原則:
--  ・参加は任意(visible で制御)。公開データは opt-in した本人のぶんだけ。
--  ・送れるのは「固定メッセージ」だけ(自由入力なし=荒らし不可・通報義務の負担を最小化)。
--    メッセージは"コード"で保存し、受け手の言語で表示する(言語中立・翻訳可)。
--  ・他人に触る操作(送信・通報)と一覧取得は SECURITY DEFINER 関数だけが行う。
--    → クライアントは直接テーブルを読み書きせず、下の RPC 関数だけを呼ぶ(なりすまし不可)。
--  ・アバターは自由画像でなく「プリセットのコード」(例 'a1')=荒らし不可。
-- クライアントからの呼び方(参考):
--   supabase.rpc('plaza_upsert', { p_nickname, p_flag, p_level, p_streak, p_today, p_avatar })  // 参加/更新
--   supabase.rpc('plaza_leave')                                    // 退出
--   supabase.rpc('plaza_sample', { p_level })                      // 広場を見る(約20人)
--   supabase.rpc('plaza_send',   { p_to, p_kind })                 // 固定メッセージを送る
--   supabase.rpc('plaza_inbox')                                    // 自分が受け取ったメッセージ
--   supabase.rpc('plaza_report', { p_reported, p_reason })         // 通報
-- ============================================================================

-- 1) 広場に立つ人(opt-in した本人=1行)。表示に必要な情報のみ保持。
create table if not exists public.plaza_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,  -- UID
  nickname text not null,                    -- 名前(自由ニックネーム<=20字・禁止語チェック済)
  flag text not null,                        -- 国(国コード 例 'NP'。絵文字はクライアントで描画)
  level text not null,                       -- JLPT: 'N5'|'N4'|'N3' ...
  streak_days int not null default 0,        -- 連続日数
  today_count int not null default 0,        -- 今日の問題数
  today_date date not null default current_date,
  avatar text not null default 'm1',         -- アバター(プリセットのコード。男子 m1..m5 / 女子 f1..f5 の10種)
  last_active timestamptz not null default now(),   -- 最後のログイン/活動
  cheers_received int not null default 0,    -- もらった応援の累計(集計はここに持つ)
  visible boolean not null default true,     -- 参加ON/OFF(=false は広場に出ない)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plaza_presence_pick on public.plaza_presence (visible, level, last_active desc);

-- 2) 固定メッセージ(応援)。同じ相手・同じ種類は1日1回まで。送信者の表示情報は送信時にスナップショット。
create table if not exists public.plaza_messages (
  from_user uuid not null,
  to_user uuid not null,
  kind text not null,                        -- 固定コード(下の whitelist)。自由文は保存しない
  day date not null default current_date,
  from_nick text not null,                   -- 送信時点の送り主 表示(退出/改名後も履歴が壊れない)
  from_flag text not null,
  from_avatar text not null default 'm1',
  created_at timestamptz not null default now(),
  primary key (from_user, to_user, kind, day) -- 同じ相手・同じ種類は1日1回だけ
);
create index if not exists plaza_messages_inbox on public.plaza_messages (to_user, created_at desc);

-- 3) 通報(相手ごと1回)。別々の一定人数から通報されたら自動的に非表示(visible=false)。
create table if not exists public.plaza_reports (
  reporter uuid not null,
  reported uuid not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (reporter, reported)
);

alter table public.plaza_presence enable row level security;
alter table public.plaza_messages enable row level security;
alter table public.plaza_reports  enable row level security;

-- クライアントの直接アクセスは不可(ポリシーを張らない)。全アクセスは下の SECURITY DEFINER 関数
-- (所有者=postgres が RLS を素通り)経由。念のため直アクセスを明示的に剥奪。
revoke all on public.plaza_presence, public.plaza_messages, public.plaza_reports from anon, authenticated;

-- --- ニックネームの最低限チェック(長さ＋ごく簡単な禁止語)。主対策は「通報→自動非表示」。 ---
create or replace function public.plaza_clean_nick(p text)
returns boolean language sql immutable as $$
  select length(btrim(p)) between 1 and 20
     and btrim(p) !~* '(fuck|shit|sex|死ね|しね)';   -- 例。必要に応じて拡充
$$;

-- --- 送れる固定メッセージの種類(whitelist)。クライアントはこのコードだけ送れる。 ---
--     表示テキストはクライアントが各言語に翻訳(例 flower=🌸 / ganbare=がんばって / issho=いっしょに /
--     sugoi=すごい / otsukare=おつかれさま / nice=いいね)。ここに無いコードは弾く。
create or replace function public.plaza_kind_ok(p text)
returns boolean language sql immutable as $$
  select p in ('flower','ganbare','issho','sugoi','otsukare','nice');
$$;

-- --- 参加/更新: 自分の1行を upsert。user_id は auth.uid() で固定=なりすまし不可。 ---
create or replace function public.plaza_upsert(p_nickname text, p_flag text, p_level text, p_streak int, p_today int, p_avatar text default 'a1')
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;
  if not public.plaza_clean_nick(p_nickname) then raise exception 'invalid nickname'; end if;
  insert into public.plaza_presence(user_id, nickname, flag, level, streak_days, today_count, today_date, avatar, last_active, visible, updated_at)
  values (uid, btrim(p_nickname), p_flag, p_level, greatest(0, p_streak), greatest(0, p_today), current_date, coalesce(p_avatar,'m1'), now(), true, now())
  on conflict (user_id) do update
    set nickname = excluded.nickname, flag = excluded.flag, level = excluded.level,
        streak_days = excluded.streak_days, today_count = excluded.today_count, today_date = current_date,
        avatar = excluded.avatar, last_active = now(), visible = true, updated_at = now();
end $$;

-- --- 退出(広場から外れる)。行は残し visible=false に。 ---
create or replace function public.plaza_leave()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  update public.plaza_presence set visible = false, updated_at = now() where user_id = auth.uid();
end $$;

-- --- 広場を見る: 約20人(自分と「自分が通報した人」を除外・同じ級を優先・最近14日活動・シャッフル)。 ---
--     見るだけは未ログインでも可。今日以外の today_count は 0 に丸める。
create or replace function public.plaza_sample(p_level text default null, p_limit int default 20)
returns table(user_id uuid, nickname text, flag text, level text, streak_days int, today_count int, avatar text, cheers_received int, last_active timestamptz)
language sql security definer set search_path = public as $$
  select p.user_id, p.nickname, p.flag, p.level, p.streak_days,
         case when p.today_date = current_date then p.today_count else 0 end as today_count,
         p.avatar, p.cheers_received, p.last_active
  from public.plaza_presence p
  where p.visible = true
    and p.last_active > now() - interval '14 days'
    and (auth.uid() is null or p.user_id <> auth.uid())
    and not exists (select 1 from public.plaza_reports r where r.reporter = auth.uid() and r.reported = p.user_id)
  order by (case when p_level is not null and p.level = p_level then 0 else 1 end), random()
  limit greatest(1, least(p_limit, 40));
$$;

-- --- 固定メッセージを送る(1日1回/相手・種類ごと)。送るには自分も広場に参加していること。自分には送れない。 ---
create or replace function public.plaza_send(p_to uuid, p_kind text)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); me public.plaza_presence%rowtype; n int;
begin
  if uid is null then raise exception 'auth required'; end if;
  if uid = p_to then raise exception 'cannot send to self'; end if;
  if not public.plaza_kind_ok(p_kind) then raise exception 'invalid kind'; end if;
  select * into me from public.plaza_presence where user_id = uid;
  if not found then raise exception 'join the plaza first'; end if;
  insert into public.plaza_messages(from_user, to_user, kind, day, from_nick, from_flag, from_avatar)
  values (uid, p_to, p_kind, current_date, me.nickname, me.flag, me.avatar)
    on conflict do nothing;
  if found then
    update public.plaza_presence set cheers_received = cheers_received + 1 where user_id = p_to;
  end if;
  select cheers_received into n from public.plaza_presence where user_id = p_to;
  return coalesce(n, 0);
end $$;

-- --- 自分が受け取ったメッセージ(最近30件)。通報した相手からのぶんは除外。 ---
create or replace function public.plaza_inbox(p_limit int default 30)
returns table(from_nick text, from_flag text, from_avatar text, kind text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select m.from_nick, m.from_flag, m.from_avatar, m.kind, m.created_at
  from public.plaza_messages m
  where m.to_user = auth.uid()
    and not exists (select 1 from public.plaza_reports r where r.reporter = auth.uid() and r.reported = m.from_user)
  order by m.created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

-- --- 通報(相手ごと1回)。別々の3人以上から通報されたら自動的に非表示。 ---
create or replace function public.plaza_report(p_reported uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cnt int;
begin
  if uid is null then raise exception 'auth required'; end if;
  insert into public.plaza_reports(reporter, reported, reason) values (uid, p_reported, p_reason)
    on conflict do nothing;
  select count(*) into cnt from public.plaza_reports where reported = p_reported;
  if cnt >= 3 then
    update public.plaza_presence set visible = false, updated_at = now() where user_id = p_reported;
  end if;
end $$;

-- --- 実行権限(EXECUTE)。テーブルへの GRANT は不要(関数が definer で代行)。 ---
grant execute on function public.plaza_sample(text, int)                          to anon, authenticated;  -- 見るだけは未ログインでも可
grant execute on function public.plaza_upsert(text, text, text, int, int, text)   to authenticated;
grant execute on function public.plaza_leave()                                    to authenticated;
grant execute on function public.plaza_send(uuid, text)                           to authenticated;
grant execute on function public.plaza_inbox(int)                                 to authenticated;
grant execute on function public.plaza_report(uuid, text)                         to authenticated;
