-- コホート別リテンション（install週 × 国別に D1/D7/D30）＋ 国×利用×課金 の集計ビュー。
-- Supabase の SQL Editor にこのファイルをまるごと貼って1回実行するだけ（CLI不要）。再実行しても安全（drop→create）。
-- 既存の dashboard_views.sql と同じ流儀：v_admin_* / 端末→アカウント名寄せ / 読み取りは service_role のみ。
--
-- 【元データ】public.tel_snapshot（1ユーザー/日・data は jsonb）。
--   data->>'installDay'      … インストール日 'YYYY-MM-DD'（旧スナップショットは無い→当日で代用）
--   data->>'geoCountry'      … 接続国（IP由来・旧版は無い→'??'）
--   day(date)                … その日アクティブだった証拠（1人1日1行）
-- 【課金】public.entitlements（user_id 基準・RevenueCat Webhook / trial-claim EF が書く）。
--
-- ★重要な限界（締め判断で誤読しないため）
--  ・匿名ID(anon_id)は再インストールで別IDになる → 純粋な匿名端末の「install数」は実際の人数より多め・
--    リテンションは低めに出やすい。ログインした端末は eff_account で本人に名寄せするので影響が小さい。
--  ・課金(転換率)は「ログイン済みアカウントのみ」見える。未ログイン購入は原理上ここに出ない
--    → 購入総数の一次情報は必ず RevenueCat ダッシュボード。ここは「ログイン者の中での転換」を見る用。


-- ============================================================================
-- ① コホート別リテンション（install週 × 国別・D1/D7/D30）
--    定義＝ローリング・リテンション（「少なくとも N 日目まで生き残ったか」＝最終アクティブ日 − install日 >= N）。
--    初期はサンプルが小さく“ちょうど N 日目に開いた”式(クラシック)は0が多く不安定なため、ローリングを既定にする。
--    分母は「N日目に到達する時間が経ったユーザーだけ(_base)」＝まだ日が浅いコホートで薄まらないようにする。
-- ============================================================================
drop view if exists public.v_admin_retention;
create view public.v_admin_retention as
with snap as (
  select
    s.anon_id, s.day, s.created_at,
    nullif(s.data->>'installDay','')                              as install_day_raw,
    nullif(s.data->>'geoCountry','')                              as country,
    coalesce(
      (select s2.account_id from public.tel_snapshot s2
         where s2.anon_id = s.anon_id and s2.account_id is not null
         order by s2.created_at desc limit 1),
      s.account_id
    )                                                             as eff_account  -- 一度でもログインした端末は本人へ名寄せ
  from public.tel_snapshot s
), keyed as (
  select snap.*, coalesce(eff_account::text, anon_id) as merge_key                -- 統合単位（未ログインは端末のまま）
  from snap
), agg as (
  select
    merge_key,
    min(coalesce(install_day_raw::date, day))                     as install_day,  -- インストール日（無ければ最初のアクティブ日）
    max(day)                                                      as last_day,     -- 最終アクティブ日
    (array_agg(country order by created_at desc)
       filter (where country is not null))[1]                     as country       -- 直近の接続国
  from keyed
  group by merge_key
)
select
  date_trunc('week', install_day)::date                           as cohort_week,  -- インストール週（月曜起点）
  coalesce(country, '??')                                         as country,
  count(*)                                                        as installs,     -- そのコホートの端末/人数
  -- N日目に到達できるだけ時間が経った母数（分母）
  count(*) filter (where install_day + 1  <= current_date)        as d1_base,
  count(*) filter (where install_day + 7  <= current_date)        as d7_base,
  count(*) filter (where install_day + 30 <= current_date)        as d30_base,
  -- ローリング・リテンション％（少なくとも N 日目まで生き残った割合）
  round(100.0 * count(*) filter (where last_day - install_day >= 1  and install_day + 1  <= current_date)
        / nullif(count(*) filter (where install_day + 1  <= current_date), 0), 1) as d1_pct,
  round(100.0 * count(*) filter (where last_day - install_day >= 7  and install_day + 7  <= current_date)
        / nullif(count(*) filter (where install_day + 7  <= current_date), 0), 1) as d7_pct,
  round(100.0 * count(*) filter (where last_day - install_day >= 30 and install_day + 30 <= current_date)
        / nullif(count(*) filter (where install_day + 30 <= current_date), 0), 1) as d30_pct
from agg
group by 1, 2
order by cohort_week desc, installs desc;
-- ※「ちょうどN日目に開いた」クラシック式が欲しい時は last_day を使わず、
--   keyed から「offset = day - install_day」を作り、offset = N の存在で判定するビューを別途作る。


-- ============================================================================
-- ② 国×利用×課金（ログイン済みアカウント 1人1行）＝ entitlements ↔ tel_snapshot を account_id で結合
-- ============================================================================
-- cascade＝依存する v_admin_conversion_geo も一緒に落とす（このあと下で作り直す）。再実行時の依存エラー回避。
drop view if exists public.v_admin_monetization cascade;
create view public.v_admin_monetization as
with acc as (   -- アカウントの最新スナップショット（1アカウント1行）
  select distinct on (account_id)
    account_id,
    day                                              as last_day,
    coalesce(nullif(data->>'geoCountry',''), '??')   as country,
    data->>'level'                                   as level,
    coalesce((data->>'learned')::int, 0)             as learned,
    coalesce((data->>'streak')::int, 0)              as streak,
    (data->'readiness'->>'predScore')::int           as pred_score
  from public.tel_snapshot
  where account_id is not null
  order by account_id, day desc, created_at desc
), fs as (      -- アカウントの初回日・利用日数
  select account_id,
         min(coalesce(nullif(data->>'installDay','')::date, day)) as install_day,
         count(distinct day)                                      as active_days
  from public.tel_snapshot
  where account_id is not null
  group by account_id
)
select
  a.account_id,
  u.email,
  a.country, a.level, a.learned, a.streak, a.pred_score,
  f.install_day, f.active_days, a.last_day,
  (e.trial_claimed_at is not null)                                 as trial_claimed,     -- 7日お試しを受け取った
  e.trial_claimed_at,
  (e.pro_store_until is not null and e.pro_store_until > now())     as paid_active,       -- 有料サブスク有効（RevenueCat）
  e.pro_plan, e.pro_will_renew, e.pro_store_until,
  (e.pro_until is not null and e.pro_until > now())                as bonus_pro_active    -- 紹介/お試し由来のPro（課金とは別）
from acc a
join fs f            on f.account_id = a.account_id
left join auth.users u          on u.id = a.account_id
left join public.entitlements e on e.user_id = a.account_id
order by a.last_day desc;


-- ============================================================================
-- ③ 国別 転換サマリー（②を国で畳む）＝「締め判断」用の1枚
--    ※ログイン済みアカウントのみ。購入総数の正本は RevenueCat。
-- ============================================================================
drop view if exists public.v_admin_conversion_geo;
create view public.v_admin_conversion_geo as
select
  country,
  count(*)                                       as accounts,        -- この国のログイン済みアカウント
  count(*) filter (where trial_claimed)          as trial_claimed,   -- お試しを受け取った数
  count(*) filter (where paid_active)            as paid_active,     -- 有料課金が有効な数
  count(*) filter (where bonus_pro_active)       as bonus_pro,       -- 紹介/お試し由来Pro（参考）
  round(100.0 * count(*) filter (where paid_active)
        / nullif(count(*) filter (where trial_claimed), 0), 1)      as trial_to_paid_pct,  -- お試し→課金 転換率
  round(100.0 * count(*) filter (where paid_active)
        / nullif(count(*), 0), 1)                                   as acct_to_paid_pct    -- ログイン→課金 転換率
from public.v_admin_monetization
group by country
order by accounts desc;


-- ============================================================================
-- ④ 国別リテンション（D1/D7/D30・テスト由来を除外）＝管理ダッシュボードにそのまま表示する用。
--    週をまたいで国で畳む＋「テスト由来ノイズ（未ログイン かつ 学習0）」を除外＝実ユーザーだけ。
--    Googleのテスト前レポート(ロボット試験)等はアカウントを作らず学習も進めないので、この条件で概ね除ける。
-- ============================================================================
drop view if exists public.v_admin_retention_geo;
create view public.v_admin_retention_geo as
with snap as (
  select s.anon_id, s.day,
    nullif(s.data->>'installDay','')                as install_raw,
    nullif(s.data->>'geoCountry','')                as country,
    coalesce((s.data->>'learned')::int,0)           as learned,
    coalesce(
      (select s2.account_id from public.tel_snapshot s2
         where s2.anon_id=s.anon_id and s2.account_id is not null
         order by s2.created_at desc limit 1),
      s.account_id)                                 as eff
  from public.tel_snapshot s
), keyed as (
  select *, coalesce(eff::text, anon_id) as merge_key from snap
), agg as (
  select merge_key,
    min(coalesce(install_raw::date, day))                              as install_day,
    max(day)                                                           as last_day,
    max(learned)                                                       as learned,
    bool_or(eff is not null)                                           as logged_in,
    (array_agg(country order by day desc) filter (where country is not null))[1] as country
  from keyed
  group by merge_key
)
select
  coalesce(country,'??')                                              as country,
  count(*)                                                            as installs,
  round(100.0*count(*) filter (where last_day-install_day>=1  and install_day+1 <=current_date)
        /nullif(count(*) filter (where install_day+1 <=current_date),0),1) as d1_pct,
  round(100.0*count(*) filter (where last_day-install_day>=7  and install_day+7 <=current_date)
        /nullif(count(*) filter (where install_day+7 <=current_date),0),1) as d7_pct,
  round(100.0*count(*) filter (where last_day-install_day>=30 and install_day+30<=current_date)
        /nullif(count(*) filter (where install_day+30<=current_date),0),1) as d30_pct,
  count(*) filter (where install_day+7 <=current_date)               as d7_base,
  count(*) filter (where install_day+30<=current_date)               as d30_base
from agg
where logged_in or learned > 0   -- ★テスト由来(未ログイン＋学習0)を除外＝実ユーザーだけ
group by country
order by installs desc;


-- 読み取りは管理者(service_role)のみ。メールを含むため anon/authenticated には出さない。
grant select on
  public.v_admin_retention,
  public.v_admin_retention_geo,
  public.v_admin_monetization,
  public.v_admin_conversion_geo
to service_role;


-- ============================================================================
-- 使い方（SQL Editor でそのまま SELECT）
-- ============================================================================
-- ▼ 週×国のリテンション（新しい週が上）
-- select * from public.v_admin_retention;
--
-- ▼ 国だけで見たい（週をまたいで合算した D7 の目安を国別に）
-- select country,
--        sum(installs)                                   as installs,
--        sum(d7_base)                                    as d7_base,
--        round(100.0*sum( (d7_pct/100.0)*d7_base )/nullif(sum(d7_base),0),1) as d7_pct_weighted
--   from public.v_admin_retention group by country order by installs desc;
--
-- ▼ 国別 転換サマリー（締め判断の1枚）
-- select * from public.v_admin_conversion_geo;
--
-- ▼ 個人を確認（誰がお試し→課金したか）
-- select email, country, level, learned, active_days, trial_claimed, paid_active, pro_plan
--   from public.v_admin_monetization order by paid_active desc, last_day desc;
