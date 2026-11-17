-- 管理ダッシュボードの「コンテンツ利用」。既存の screen_view に追加した分類だけを集計する。
create or replace view public.v_admin_content_usage as
with recent as (
  select anon_id, account_id, level, props->>'content' as content
  from public.tel_event
  where name = 'screen_view'
    and created_at >= now() - interval '30 days'
    and nullif(props->>'content', '') is not null
    and level in ('N3', 'N4', 'N5')
), devices as (
  select distinct anon_id from recent
), accounts as (
  select distinct on (s.anon_id) s.anon_id, s.account_id
  from devices d
  join public.tel_snapshot s on s.anon_id = d.anon_id and s.account_id is not null
  order by s.anon_id, s.created_at desc
)
select r.content, r.level, count(*) as opens,
  count(distinct coalesce(r.account_id::text, a.account_id::text, r.anon_id)) as users
from recent r
left join accounts a using (anon_id)
group by r.content, r.level;

revoke all on public.v_admin_content_usage from public, anon, authenticated;
grant select on public.v_admin_content_usage to service_role;
