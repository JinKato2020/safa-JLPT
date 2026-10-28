// Preview: node --import tsx tools/backfill_dashboard_profiles.mjs
// Apply only missing dashboard fields: add --apply. Never changes user_state or timestamps.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { PERSONALITIES, MOOD_MESSAGES } from '../src/plaza/persona.ts';

for (const file of [process.env.SUPABASE_PAT_FILE, 'C:/API 秘密の鍵/JLPT/.env.local', '.env.local'].filter(Boolean)) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  break;
}
const token = process.env.SUPABASE_PAT;
if (!token) throw new Error('SUPABASE_PAT is missing');
const ref = process.env.SUPABASE_PROJECT_REF || 'nxovouiqelynryumjvyq';
async function query(sql, readOnly = true) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: readOnly }),
  });
  if (!res.ok) throw new Error(`Supabase HTTP ${res.status}: ${res.status === 401 ? 'Invalid or expired management token' : 'Database request failed'}`);
  return res.json();
}

const fields = ['nickname', 'avatar', 'personality', 'mood'];
const historyColumns = fields.map(k => `(array_agg(data->'profile'->>'${k}' order by created_at desc, id desc)
  filter (where nullif(btrim(data->'profile'->>'${k}'), '') is not null))[1] as ${k}`).join(',\n');
// Identity resolution and per-level representatives match v_admin_devices.
const rows = await query(`
with acct as (
  select distinct on (anon_id) anon_id, account_id from public.tel_snapshot
  where account_id is not null order by anon_id, created_at desc, id desc
), keyed as (
  select s.*, coalesce(a.account_id, s.account_id) as owner_id,
    coalesce(coalesce(a.account_id, s.account_id)::text, s.anon_id) as merge_key
  from public.tel_snapshot s left join acct a on a.anon_id = s.anon_id
), history as (
  select merge_key, ${historyColumns} from keyed group by merge_key
), latest as (
  select distinct on (merge_key, data->>'level') * from keyed
  order by merge_key, data->>'level', day desc, created_at desc, id desc
)
select t.id::text, t.merge_key, t.owner_id::text, t.data->'profile' as profile,
  us.state->'settings' as settings, to_jsonb(fp) as friend_profile,
  to_jsonb(h) - 'merge_key' as history
from latest t left join public.user_state us on us.user_id = t.owner_id
left join public.friend_profiles fp on fp.user_id = t.owner_id
left join history h on h.merge_key = t.merge_key
where ${fields.map(k => `nullif(btrim(t.data->'profile'->>'${k}'), '') is null`).join(' or ')}
`);
const value = (...values) => values.find(v => typeof v === 'string' && v.trim()) || null;
const trait = key => PERSONALITIES.find(p => p.key === key)?.label;
const mood = key => MOOD_MESSAGES.find(m => m.key === key)?.text;
const patches = [];
const recoverablePeople = new Set();
const backup = [];
const counts = Object.fromEntries(fields.map(k => [k, 0]));
for (const row of rows) {
  const s = row.settings || {}, f = row.friend_profile || {}, h = row.history || {};
  const candidates = {
    nickname: value(s.nickname, f.nickname, h.nickname),
    avatar: value(s.avatar, f.avatar, h.avatar),
    personality: value(trait(s.personality), trait(f.personality), h.personality),
    mood: value(mood(s.moodMsg), mood(f.mood_msg), h.mood),
  };
  const patch = {};
  for (const k of fields) {
    if (!value(row.profile?.[k]) && candidates[k]) { patch[k] = candidates[k]; counts[k]++; }
  }
  if (Object.keys(patch).length) {
    patches.push({ id: row.id, patch });
    recoverablePeople.add(row.merge_key);
    backup.push({ id: row.id, profile: row.profile ?? null });
  }
}
console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview',
  missingRows: rows.length, recoverableRows: patches.length, recoverablePeople: recoverablePeople.size, fields: counts }));
if (process.argv.includes('--apply') && patches.length) {
mkdirSync('_audit_work', { recursive: true });
const backupPath = `_audit_work/profile-backfill-before-${Date.now()}.json`;
writeFileSync(backupPath, JSON.stringify(backup, null, 2));
console.log(JSON.stringify({ backup: backupPath }));
// JSON dollar quoting is chosen so names cannot become SQL. At write time recheck
// every field: a newer user-supplied nonblank value always wins over this repair.
const payload = JSON.stringify(patches);
let tag = '$profile_repair$';
while (payload.includes(tag)) tag = tag.slice(0, -1) + '_$';
const result = await query(`
with patches as (
  select * from jsonb_to_recordset(${tag}${payload}${tag}::jsonb) as p(id bigint, patch jsonb)
), updated as (
  update public.tel_snapshot s
  set data = jsonb_set(s.data, '{profile}',
    (case when jsonb_typeof(s.data->'profile') = 'object' then s.data->'profile' else '{}'::jsonb end)
    || (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
        from jsonb_each(p.patch) e
        where nullif(btrim(s.data->'profile'->>e.key), '') is null), true)
  from patches p where s.id = p.id returning s.id
)
select count(*)::int as updated_rows from updated
`, false);
console.log(JSON.stringify(result));
// Re-read through the actual dashboard view, using counts only (no personal data in logs).
console.log(JSON.stringify(await query(`select count(*)::int as registered_rows,
 count(*) filter (where nullif(btrim(nickname), '') is null)::int as missing_name,
 count(*) filter (where nullif(btrim(avatar), '') is null)::int as missing_avatar,
 count(*) filter (where nullif(btrim(personality), '') is null)::int as missing_personality,
 count(*) filter (where nullif(btrim(mood), '') is null)::int as missing_mood
 from public.v_admin_devices where account_id is not null and is_latest`)));

}
