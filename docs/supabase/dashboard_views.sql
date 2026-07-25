-- 管理ダッシュボード用の集計ビュー(読み取り専用)。SQL Editor に貼って1回実行するだけ。
-- 生ログ(tel_snapshot/tel_event/tel_mock/user_state)を人が読みやすい形に畳む。
-- ダッシュボード(docs/supabase/dashboard.html)は service_role キーでこれらのビューを読む。
-- 登録者(メール)を含むため anon には出さない(service_role のみ)。

-- ① 全体サマリー(1行)。総ユーザー・当日/週間アクティブ・登録アカウント/同期済み・模試数・エラー数。
--    accounts=auth.users(本当の登録数) / synced=user_state(クラウドにデータを上げた数)。両者は別物。
--    列の順番を変えるため create or replace 不可(列の改名/途中挿入ができない)→ drop→create。
drop view if exists public.v_admin_summary;
create view public.v_admin_summary as
select
  (select count(distinct anon_id) from public.tel_snapshot)                              as total_users,
  (select count(distinct anon_id) from public.tel_snapshot where day = current_date)      as dau,
  (select count(distinct anon_id) from public.tel_snapshot where day >= current_date - 6) as wau,
  (select count(*) from auth.users)                                                       as accounts,
  (select count(*) from public.user_state)                                                as synced,
  (select count(*) from public.tel_mock)                                                  as total_mocks,
  (select count(*) from public.tel_event where name = 'error')                            as total_errors;

-- ② 利用者別 最新スナップショット(1 anon = 最新1行)＝ダッシュボードの主役の1表。
--    登録者(account_id有)も匿名も「同じ1つのカテゴリー」として並べ、種別で見分ける(ダッシュボード側でソート)。
--    passProb はアプリ側で 0〜100 の整数として保存(×100しない)。
--    カバー率は 漢字/語彙/文法 の3本を個別%で出す。大問別[習得,母数]は生JSON(daimon)＋合計を出す。
--    列を増やすため create or replace 不可 → 依存ビュー(level/exhaust)ごと drop→再作成(cascade)。
drop view if exists public.v_admin_devices cascade;
create view public.v_admin_devices as
select
  t.*,
  case when t.account_id is not null then '登録' else '匿名' end as kind,
  u.email
from (
  select distinct on (anon_id)
    anon_id,
    account_id,
    data->>'level'                                              as level,
    data->>'exam'                                               as exam,
    data->>'platform'                                           as platform,
    data->>'uiLang'                                             as ui_lang,
    round(coalesce((data->'readiness'->>'passProb')::numeric,0)) as pass_pct,
    (data->'readiness'->>'passing')::boolean                    as passing,
    -- 折りたたみカバー率(レベル別ビュー用に残す=漢字/語彙/文法の総合)
    (select case when sum((v->>'total')::numeric) > 0
        then round(100 * sum((v->>'learned')::numeric) / sum((v->>'total')::numeric)) else 0 end
      from jsonb_each(coalesce(data->'coverage','{}'::jsonb)) as e(k, v))  as cov_pct,
    -- カバー率 3分割(漢字/語彙/文法)。母数0や旧データはnull(=表示は「—」)。
    case when (data->'coverage'->'kanji'->>'total')::numeric > 0
      then round(100*(data->'coverage'->'kanji'->>'learned')::numeric/(data->'coverage'->'kanji'->>'total')::numeric) end   as cov_kanji,
    case when (data->'coverage'->'vocab'->>'total')::numeric > 0
      then round(100*(data->'coverage'->'vocab'->>'learned')::numeric/(data->'coverage'->'vocab'->>'total')::numeric) end   as cov_vocab,
    case when (data->'coverage'->'grammar'->>'total')::numeric > 0
      then round(100*(data->'coverage'->'grammar'->>'learned')::numeric/(data->'coverage'->'grammar'->>'total')::numeric) end as cov_grammar,
    -- 私の単語帳 登録単語数(v3〜)。
    coalesce((data->>'myListCount')::int, 0)                    as mylist_count,
    -- 大問別 [習得,母数] の生JSON(8大問)＋合計(v3〜。旧データはnull)。
    data->'daimonMastery'                                       as daimon,
    (select coalesce(sum((v->>0)::numeric),0) from jsonb_each(coalesce(data->'daimonMastery','{}'::jsonb)) as e(k,v)) as daimon_learned,
    (select coalesce(sum((v->>1)::numeric),0) from jsonb_each(coalesce(data->'daimonMastery','{}'::jsonb)) as e(k,v)) as daimon_total,
    coalesce((data->>'streak')::int, 0)                         as streak,
    coalesce((data->>'studyDays')::int, 0)                      as study_days,
    round(coalesce((data->>'studySeconds')::numeric,0) / 60)    as study_min,
    coalesce((data->>'learned')::int, 0)                        as learned,
    coalesce((data->>'mockCount')::int, 0)                      as mock_count,
    data->'remaining'                                           as remaining,
    data->'exhausted'                                           as exhausted,
    day                                                         as last_day
  from public.tel_snapshot
  order by anon_id, day desc, created_at desc
) t
left join auth.users u on u.id = t.account_id
order by (t.account_id is null), t.last_day desc;

-- ③ レベル別 平均(利用者別ビューを N5/N4/N3 で集計)。
create or replace view public.v_admin_level as
select
  coalesce(level, '?')      as level,
  count(*)                  as users,
  round(avg(pass_pct))      as avg_pass_pct,
  round(avg(cov_pct))       as avg_cov_pct,
  round(avg(study_min))     as avg_study_min,
  round(avg(streak), 1)     as avg_streak,
  count(*) filter (where passing) as passing_users
from public.v_admin_devices
group by level
order by level;

-- ④ 分野別 枯渇状況(新規残数の平均・残り3問以下の端末数)。コンテンツ不足シグナル。
create or replace view public.v_admin_exhaust as
select
  e.key                                              as category,
  round(avg((e.value)::numeric), 1)                  as avg_remaining,
  count(*) filter (where (e.value)::numeric <= 3)    as exhausted_users,
  count(*)                                           as users
from public.v_admin_devices d,
     jsonb_each_text(coalesce(d.remaining, '{}'::jsonb)) as e(key, value)
group by e.key
order by e.key;

-- 旧「アカウント別 横並び」ビューは撤去(登録者は上の v_admin_devices に統合済み=メール＋合格率まで1表で見える)。
drop view if exists public.v_admin_accounts;

-- 読み取り権限は service_role のみ(管理者用)。anon/authenticated には出さない=メール等が漏れない。
grant select on
  public.v_admin_summary,
  public.v_admin_devices,
  public.v_admin_level,
  public.v_admin_exhaust
to service_role;
