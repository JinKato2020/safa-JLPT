-- Cumulative set STARTS across exam/practice screens, including abandoned sets.
-- Legacy completions are a LOWER BOUND for old starts (abandoned sets are unknown).
create or replace view public.v_admin_study_sessions as
with acct as (
  select distinct on (anon_id) anon_id, account_id
  from public.tel_snapshot where account_id is not null
  order by anon_id, created_at desc, id desc
), measured as (
  select coalesce(a.account_id::text, s.account_id::text, s.anon_id) as merge_key,
    min(s.created_at) as measured_since
  from public.tel_snapshot s left join acct a on a.anon_id = s.anon_id
  where s.data->>'studyStartsMeasured' = 'true'
  group by 1
), starts as (
  select coalesce(a.account_id::text, e.account_id::text, e.anon_id) as merge_key,
    -- Replayed/offline batches must not count a route instance twice.
    count(distinct (e.anon_id, coalesce(nullif(e.props->>'sessionId', ''), e.id::text))) as study_sessions,
    min(e.created_at) as measured_since
  from public.tel_event e left join acct a on a.anon_id = e.anon_id
  where e.name = 'study_set_start'
    and e.props->>'definition' = 'set_start_v1'
    and e.props->>'source' in ('exam', 'practice')
  group by 1
), legacy as (
  select coalesce(a.account_id::text, e.account_id::text, e.anon_id) as merge_key,
    count(*) as completed_sessions
  from public.tel_event e left join acct a on a.anon_id = e.anon_id
  where e.name = 'session_complete'
    and coalesce(e.props->>'startTracked', 'false') <> 'true'
    and e.props->>'mode' in ('quiz', 'moji_goi', 'bunpou', 'dokkai', 'choukai', 'passage_grammar')
  group by 1
)
select coalesce(m.merge_key, s.merge_key, l.merge_key) as merge_key,
  (coalesce(s.study_sessions, 0) + coalesce(l.completed_sessions, 0))::bigint as study_sessions,
  least(m.measured_since, s.measured_since) as measured_since,
  coalesce(l.completed_sessions, 0)::bigint as legacy_completed_sessions
from measured m full join starts s using (merge_key)
full join legacy l on l.merge_key = coalesce(m.merge_key, s.merge_key);

revoke all on public.v_admin_study_sessions from public, anon, authenticated;
grant select on public.v_admin_study_sessions to service_role;
notify pgrst, 'reload schema';
