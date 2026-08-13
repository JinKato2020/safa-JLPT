-- ============================================================================
-- 友だちの通報(UGC対策・Apple Guideline 1.2) — Supabase の SQL Editor に貼って実行(CLI不要・再実行安全)。
-- 目的: 不適切なユーザー/メッセージを「アプリ内から通報」できるようにする(通報＝記録＋即ブロック)。
--  ・通報すると friend_reports に記録し、その相手を相互ブロック(town_members から双方向を削除)。
--    以後どちらもメッセージを送れない(cheer_send は町の住人にしか送れないため)。
--  ・不適切な内容は24時間以内に対処する旨を規約に明記(運用は管理者が friend_reports を確認して対処)。
-- クライアント: supabase.rpc('friend_report', { p_reported, p_reason })
-- ============================================================================

create table if not exists public.friend_reports (
  reporter   uuid not null references auth.users(id) on delete cascade,
  reported   uuid not null references auth.users(id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (reporter, reported)   -- 同じ相手への重複通報は1行に集約
);
create index if not exists friend_reports_reported on public.friend_reports (reported);

alter table public.friend_reports enable row level security;
revoke all on public.friend_reports from anon, authenticated; -- 直書き禁止(関数経由のみ)

-- --- 通報(相手ごと1回に集約)＝記録＋即ブロック(相互解除)。 ---
create or replace function public.friend_report(p_reported uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;
  if uid = p_reported then raise exception 'cannot report self'; end if;
  insert into public.friend_reports(reporter, reported, reason)
    values (uid, p_reported, left(coalesce(p_reason, ''), 200))
    on conflict (reporter, reported) do update set reason = excluded.reason, created_at = now();
  -- 通報＝即ブロック: 双方の町から相手を消す(以後メッセージ不可)。
  delete from public.town_members
   where (owner = uid and member = p_reported) or (owner = p_reported and member = uid);
end $$;

grant execute on function public.friend_report(uuid, text) to authenticated;
