-- ============================================================================
-- 友だちへの応援(固定6種)配信 — Supabase の SQL Editor に貼って実行(CLI不要)。
-- 方針(2026-08-09 更新):
--  ・固定6種のキー ＋ 自由メッセージ(cheer_key='custom'・80字まで)。
--  ・荒らし対策=送れるのは「自分の町の住人」だけ＋24hで10件まで＋受け手が town_kick で町から削除できる。
--  ・送れるのは「自分の町の住人」だけ(自分=owner, 相手=member)。
--  ・受信箱方式(プッシュなし)。相手はアプリを開いた時に未読を取りに行く。
--  ・クライアントはテーブルに直接触らない。全操作は SECURITY DEFINER 関数(RPC)経由=なりすまし不可。
--  ・前提: friends.sql(friend_profiles / town_members)を先に実行済みであること。
-- クライアントからの呼び方(参考):
--   supabase.rpc('cheer_send', { p_to, p_key })     // 応援を送る(関係チェック+回数制限)
--   supabase.rpc('cheer_inbox')                      // 自分宛の応援一覧(送り主付き)
--   supabase.rpc('cheer_unread_count')               // 未読数(バッジ)
--   supabase.rpc('cheer_mark_read')                  // 受信箱を開いた時に既読化
-- ============================================================================

create table if not exists public.friend_cheers (
  id         bigint generated always as identity primary key,
  from_user  uuid not null references auth.users(id) on delete cascade,  -- 送った人
  to_user    uuid not null references auth.users(id) on delete cascade,  -- 受け取る人
  cheer_key  text not null,                                              -- 'flower'|...(固定6種) or 'custom'(自由文)
  body       text,                                                       -- 自由メッセージ本文(cheer_key='custom'の時。80字まで)
  created_at timestamptz not null default now(),
  read_at    timestamptz                                                 -- null=未読
);
-- 既に旧版で作成済みのDB向け: body 列を後付け(2026-08-09 自由メッセージ対応)。
alter table public.friend_cheers add column if not exists body text;
create index if not exists friend_cheers_to  on public.friend_cheers (to_user, read_at);
create index if not exists friend_cheers_pair on public.friend_cheers (from_user, to_user, created_at);

alter table public.friend_cheers enable row level security;
revoke all on public.friend_cheers from anon, authenticated;

-- 許可する応援キー(固定6種・CHEERS と一致)。
create or replace function public.cheer_valid_key(p text)
returns boolean language sql immutable as $$
  select p in ('flower','ganbare','sugoi','issho','otsukare','nice');
$$;

-- 送信: 相手が「自分の町の住人」の時だけ。同じ相手へ24hで最大10件(スパム防止)。
--  p_text を渡すと自由メッセージ(cheer_key='custom'・80字まで)。渡さなければ固定6種のキー。
--  ※荒らし対策は「送れるのは町の住人だけ＋24h10件＋受け手が町から削除できる(town_kick)」で担保。
drop function if exists public.cheer_send(uuid, text); -- 旧2引数版を破棄して3引数版へ置き換え
create or replace function public.cheer_send(p_to uuid, p_key text, p_text text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int; msg text;
begin
  if uid is null then raise exception 'auth required'; end if;
  if uid = p_to then raise exception 'cannot cheer self'; end if;
  if not exists (select 1 from public.town_members m where m.owner = uid and m.member = p_to) then
    raise exception 'not a town member';
  end if;
  select count(*) into n from public.friend_cheers
    where from_user = uid and to_user = p_to and created_at > now() - interval '24 hours';
  if n >= 10 then raise exception 'rate limit'; end if;
  if p_text is not null and length(btrim(p_text)) > 0 then
    msg := left(btrim(p_text), 80); -- 自由メッセージは80字まで
    insert into public.friend_cheers(from_user, to_user, cheer_key, body) values (uid, p_to, 'custom', msg);
  else
    if not public.cheer_valid_key(p_key) then raise exception 'invalid cheer'; end if;
    insert into public.friend_cheers(from_user, to_user, cheer_key) values (uid, p_to, p_key);
  end if;
end $$;

-- 受信箱: 自分宛の応援(送り主のニックネーム/アバター付き)。新しい順・最大50件。body=自由メッセージ。
drop function if exists public.cheer_inbox(); -- 返り値に body を足すため作り直し
create or replace function public.cheer_inbox()
returns table(id bigint, from_user uuid, from_nick text, from_avatar text,
              cheer_key text, body text, created_at timestamptz, read_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, c.from_user, f.nickname, f.avatar, c.cheer_key, c.body, c.created_at, c.read_at
  from public.friend_cheers c
  left join public.friend_profiles f on f.user_id = c.from_user
  where c.to_user = auth.uid()
  order by c.created_at desc
  limit 50;
$$;

-- 未読数(バッジ用)。
create or replace function public.cheer_unread_count()
returns int language sql security definer set search_path = public as $$
  select count(*)::int from public.friend_cheers where to_user = auth.uid() and read_at is null;
$$;

-- 既読化(受信箱を開いた時)。
create or replace function public.cheer_mark_read()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  update public.friend_cheers set read_at = now() where to_user = auth.uid() and read_at is null;
end $$;

grant execute on function public.cheer_send(uuid,text,text) to authenticated;
grant execute on function public.cheer_inbox()             to authenticated;
grant execute on function public.cheer_unread_count()      to authenticated;
grant execute on function public.cheer_mark_read()         to authenticated;
