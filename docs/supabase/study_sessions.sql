-- Recorded COMPLETED problem sets only. Abandoned sets and screen views are excluded.
-- Historical counts use the same completion events as new counts; no inferred starts.
create or replace view public.v_admin_study_sessions as
with acct as (
  select distinct on (anon_id) anon_id, account_id
  from public.tel_snapshot where account_id is not null
  order by anon_id, created_at desc, id desc
), people as (
  select distinct coalesce(a.account_id::text, s.account_id::text, s.anon_id) as merge_key
  from public.tel_snapshot s left join acct a on a.anon_id = s.anon_id
), completed as (
  select coalesce(a.account_id::text, e.account_id::text, e.anon_id) as merge_key,
    count(distinct (e.anon_id, coalesce(nullif(e.props->>'sessionId', ''), e.id::text))) as study_sessions,
    min(e.created_at) as measured_since
  from public.tel_event e left join acct a on a.anon_id = e.anon_id
  where e.name = 'session_complete'
    and e.props->>'mode' in ('quiz', 'moji_goi', 'bunpou', 'dokkai', 'choukai', 'passage_grammar', 'kakitori')
  group by 1
)
select coalesce(p.merge_key, c.merge_key) as merge_key,
  coalesce(c.study_sessions, 0)::bigint as study_sessions,
  c.measured_since,
  0::bigint as legacy_completed_sessions -- Kept for compatibility; all counts now mean completion.
from people p full join completed c using (merge_key);

revoke all on public.v_admin_study_sessions from public, anon, authenticated;
grant select on public.v_admin_study_sessions to service_role;
notify pgrst, 'reload schema';
