-- ============================================================================
-- 国ごとの人数カウント(匿名含む) — Supabase の SQL Editor に貼って実行(CLI不要)。
-- 目的: ログインしていない人も含めて「どの国から何人使っているか」の概算を、
--       個人を一切特定せずに集計する。
-- プライバシー方針(審査に安全=追跡にならない):
--  ・保存するのは「国コード・日付・件数」だけ。端末IDもユーザーIDも一切持たない。
--  ・アプリは1インストールにつき1回だけ RPC geo_count_bump(country) を呼ぶ
--    (重複防止は端末内のローカルフラグのみ。サーバー側に識別子を残さない)。
--  ・テーブルは直書き禁止(anon/authenticated からは触れない)。増分は SECURITY DEFINER の関数経由のみ。
--  ・ログイン済みの詳細(1人1件)は別テーブル user_geo(docs/supabase/geo.sql)。こちらは匿名も含む概算カウント。
-- ============================================================================

create table if not exists public.geo_country_counts (
  country text   not null,                       -- ISO2(例 'JP')。IP由来のおおよその国
  day     date   not null,                        -- 集計日(UTC基準)
  count   bigint not null default 0,
  primary key (country, day)
);

alter table public.geo_country_counts enable row level security;
-- クライアントからの直接アクセスは一切許可しない(増分は関数経由のみ・集計の読取は管理者が SQL Editor で)。
revoke all on public.geo_country_counts from anon, authenticated;

-- 国コード(ISO2)を1件 +1 する。個人情報は受け取らない。不正な国コードは無視。
create or replace function public.geo_count_bump(p_country text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_country is null or p_country !~ '^[A-Z]{2}$' then
    return;                                        -- 不正・空は無視
  end if;
  insert into public.geo_country_counts as g (country, day, count)
  values (p_country, (now() at time zone 'utc')::date, 1)
  on conflict (country, day) do update set count = g.count + 1;
end;
$$;

-- 実行権限は関数だけに与える(テーブルは隠したまま)。未ログインでも呼べる=匿名も数えられる。
revoke all on function public.geo_count_bump(text) from public;
grant execute on function public.geo_count_bump(text) to anon, authenticated;

-- ── 集計の見方(管理者が SQL Editor で) ──────────────────────────────────
-- 国ごとの累計:
--   select country, sum(count) as total
--   from public.geo_country_counts group by country order by total desc;
-- 直近7日(日本時間の日付でまとめたい場合は day をそのまま UTC 日付として扱う):
--   select country, sum(count) as last7
--   from public.geo_country_counts
--   where day >= (now() at time zone 'utc')::date - 6
--   group by country order by last7 desc;
