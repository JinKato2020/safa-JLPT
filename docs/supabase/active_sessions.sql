-- 同時ログインは「1アカウント=1台だけ」。1行で「いまアクティブな端末」を保持する。
-- ・claim  : ログイン時に枠を取りに行く。空き / 自分 / 3分以上ハートビートが無い(=端末が落ちた/紛失) なら取得OK。
--            ほかの生きた端末が居れば ok=false（その端末ラベルを返す）。
-- ・touch  : ログイン中60秒ごとのハートビート。自分が現役なら last_seen を更新。奪われていたら revoked=true。
-- ・release: ログアウト時に自分の行を削除＝即解放（次の端末がすぐ入れる）。
-- 強制切替は用意しない（共有の抜け道になるため）。紛失/再インストールでも3分で自動解放されるので永久ロックにならない。
-- 適用方法: このファイルを Supabase の SQL Editor に貼って1回実行する。
create extension if not exists pgcrypto;

create table if not exists public.active_sessions (
  account_id   uuid primary key references auth.users(id) on delete cascade,
  device_id    text not null,
  device_label text,
  claimed_at   timestamptz not null default now(),
  last_seen    timestamptz not null default now()
);

alter table public.active_sessions enable row level security;
-- 本人だけ自分の行を読める（書き込みは下の SECURITY DEFINER 関数だけが行う）。
drop policy if exists as_select_own on public.active_sessions;
create policy as_select_own on public.active_sessions
  for select using (auth.uid() = account_id);

-- 猶予＝この時間ハートビートが無ければ「空き」とみなす。
-- claim: 取得できたら ok=true。ほかの生きた端末が居れば ok=false（active_label=その端末名）。
create or replace function public.claim_active_session(p_device_id text, p_label text)
returns table(ok boolean, active_label text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_row   public.active_sessions%rowtype;
  v_stale interval := interval '3 minutes';
begin
  if v_uid is null then
    return query select false, null::text; return;
  end if;
  select * into v_row from public.active_sessions where account_id = v_uid for update;
  if v_row.account_id is null
     or v_row.device_id = p_device_id
     or v_row.last_seen < now() - v_stale then
    insert into public.active_sessions(account_id, device_id, device_label, claimed_at, last_seen)
      values (v_uid, p_device_id, p_label, now(), now())
      on conflict (account_id) do update
        set device_id = excluded.device_id, device_label = excluded.device_label,
            claimed_at = now(), last_seen = now();
    return query select true, null::text; return;
  end if;
  -- ほかの端末が生きている＝この端末は入れない。
  return query select false, v_row.device_label;
end $$;

-- touch(ハートビート): 自分が現役なら last_seen を更新。行が無い/別端末に奪われていたら revoked=true。
create or replace function public.touch_active_session(p_device_id text)
returns table(ok boolean, revoked boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_dev text;
begin
  if v_uid is null then return query select false, false; return; end if;
  select device_id into v_dev from public.active_sessions where account_id = v_uid;
  if v_dev is null then return query select false, true; return; end if;      -- 行が消えた=解放済み
  if v_dev <> p_device_id then return query select false, true; return; end if; -- 別端末に奪われた
  update public.active_sessions set last_seen = now() where account_id = v_uid;
  return query select true, false;
end $$;

-- release(ログアウト): 自分の端末の行だけ削除＝即解放。
create or replace function public.release_active_session(p_device_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  delete from public.active_sessions where account_id = v_uid and device_id = p_device_id;
end $$;

grant select on public.active_sessions to authenticated;
grant execute on function public.claim_active_session(text, text) to authenticated;
grant execute on function public.touch_active_session(text) to authenticated;
grant execute on function public.release_active_session(text) to authenticated;
