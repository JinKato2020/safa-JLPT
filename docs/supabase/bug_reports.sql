-- ============================================================================
-- バグ・不具合の報告(ユーザーがアプリ内から症状を送る) — Supabase の SQL Editor に貼って実行(CLI不要・再実行安全)。
-- 目的: 気づいた不具合・問題の間違いを「アプリ内フォーム」から運営へ送れるようにする。
--  ・未ログインでも送れる(バグ報告にログイン必須は不便)＝関数は anon にも実行許可。
--  ・返信はしない前提(送信者も期待しない)。連絡先メールは集めない。
--  ・クライアントはテーブルに直接触らない(RLSで直書き禁止)。書き込みは SECURITY DEFINER 関数のみ。
--    読み取りはクライアントに許可しない(運営がダッシュボード/service_roleで確認)。
-- クライアント: supabase.rpc('submit_bug_report', { p_message, p_kind, p_context })
-- 参考: friend_reports.sql / plaza.sql と同じ「関数(RPC)経由・直書き禁止」方式。
-- ============================================================================

create table if not exists public.bug_reports (
  id         uuid not null default gen_random_uuid() primary key,
  account_id uuid references auth.users(id) on delete set null, -- ログイン中のみ紐づく(anonはnull)
  kind       text,                     -- 'bug'(アプリ不具合) | 'content'(問題の間違い) | 'other'
  message    text not null,            -- 症状・内容(ユーザー自由記入)
  context    jsonb,                    -- 版/OS/級/母語/問題ID/大問/画面/匿名ID など
  created_at timestamptz not null default now()
);
create index if not exists bug_reports_created on public.bug_reports (created_at desc);

alter table public.bug_reports enable row level security;
revoke all on public.bug_reports from anon, authenticated; -- 直書き・読み取り禁止(関数経由のみ)

-- --- 報告を1件記録する。auth.uid() があれば account_id に紐づく(anonはnull)。 ---
create or replace function public.submit_bug_report(
  p_message text,
  p_kind    text default null,
  p_context jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
declare msg text := left(coalesce(p_message, ''), 4000);
begin
  if length(btrim(msg)) = 0 then raise exception 'empty message'; end if;
  insert into public.bug_reports(account_id, kind, message, context)
    values (
      auth.uid(),
      case when p_kind in ('bug', 'content', 'other') then p_kind else 'other' end,
      msg,
      coalesce(p_context, '{}'::jsonb)
    );
end $$;

-- 未ログイン(anon)でも送れるように、anon と authenticated の両方へ実行を許可する。
grant execute on function public.submit_bug_report(text, text, jsonb) to anon, authenticated;
