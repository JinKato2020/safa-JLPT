-- 管理ダッシュボード用の集計ビュー(読み取り専用)。SQL Editor に貼って1回実行するだけ。
-- 生ログ(tel_snapshot/tel_event/tel_mock/user_state)を人が読みやすい形に畳む。
-- ダッシュボード(docs/supabase/dashboard.html)は service_role キーでこれらのビューを読む。
-- 登録者(メール)を含むため anon には出さない(service_role のみ)。

-- ① 全体サマリー(1行)。総ユーザー・当日/週間アクティブ・登録アカウント/同期済み・模試数・エラー数。
--    accounts=auth.users(本当の登録数) / synced=user_state(クラウドにデータを上げた数)。両者は別物。
--    列の順番を変えるため create or replace 不可(列の改名/途中挿入ができない)→ drop→create。
drop view if exists public.v_admin_summary;
create view public.v_admin_summary as
-- ★人数は「アカウント名寄せ」で数える(端末単位ではない)。同じアカウントで複数端末/再インストールしても1人。
--   端末(anon_id)が一度でもログインしたアカウント=eff_account に寄せ、未ログイン端末はその端末を1人扱い。
--   →v_admin_level(is_latest=merge_key単位)と頭数が一致する。
with snap as (
  select s.anon_id, s.day,
    coalesce((s.data->>'learned')::int, 0)                          as learned,
    coalesce(
      (select s2.account_id from public.tel_snapshot s2
         where s2.anon_id = s.anon_id and s2.account_id is not null
         order by s2.created_at desc limit 1),
      s.account_id
    )                                                                as eff_account   -- 端末が一度でもログインしたアカウント(無ければnull=純粋な匿名)
  from public.tel_snapshot s
), keyed as (
  select snap.*, coalesce(eff_account::text, anon_id) as merge_key   -- 統合単位=アカウント / 未ログインは端末
  from snap
), real_person as (   -- ★実ユーザー(名寄せ済み)。テスト由来ノイズ(未ログイン かつ 学習0)を除外。retention_geo と同じ基準。
  select merge_key
  from keyed
  group by merge_key
  having bool_or(eff_account is not null)
      or max(learned) > 0
)
select
  (select count(*) from real_person)                                                          as total_users,
  (select count(distinct merge_key) from keyed
     where day = current_date and merge_key in (select merge_key from real_person))            as dau,
  (select count(distinct merge_key) from keyed
     where day >= current_date - 6 and merge_key in (select merge_key from real_person))       as wau,
  (select count(*) from auth.users)                                                            as accounts,
  (select count(*) from public.user_state)                                                     as synced,
  (select count(*) from public.tel_mock)                                                       as total_mocks,
  (select count(*) from public.tel_event where name = 'error')                                 as total_errors;

-- ② 利用者別 最新スナップショット(1人 × 1レベル = 1行)＝ダッシュボードの主役の1表。
--    ★レベルを切り替えて使っている人(N5→N4→N3)は、レベルごとに別の行として出す。
--      同じメール/匿名IDが複数行に並ぶのは正常。行はそのレベルで最後に送ってきた日の内容。
--      is_latest = その人の「いま使っているレベル」の行(true は1人1行だけ)。
--      合計を出すビュー(③)は is_latest の行だけを見る。累計値(学習時間・履修・継続・模試)は
--      端末まるごとの通算でレベル別に分けられないため、全行に同じ数が入る=足すと重複するから。
--      レベル別に本当に分かれる値(合格率・カバー率・大問別・在庫)は行ごとに正しくそのレベルの値。
--    登録者(account_id有)も匿名も「同じ1つのカテゴリー」として並べ、種別で見分ける(ダッシュボード側でソート)。
--    passProb はアプリ側で 0〜100 の整数として保存(×100しない)。
--    カバー率は 漢字/語彙/文法 の3本を個別%で出す。大問別[習得,母数]は生JSON(daimon)＋合計を出す。
--    列を増やすため create or replace 不可 → 依存ビュー(level/exhaust)ごと drop→再作成(cascade)。
drop view if exists public.v_admin_devices cascade;
-- 統合方針: 同じ人の複数インストール/端末を1行にまとめる。
--   端末(anon_id)が「一度でもログインしたアカウント」を割り出し、その端末の全スナップショット(ログイン前=account_id null も含む)を本人に寄せる。
--   →ログインした匿名は登録者として吸収され、初回/最終/日数は本人の全記録の通算になる。
--   ※一度もログインしていない匿名端末は結び付ける相手が無いので端末単位のまま(誰の物か判定不能)。端末→アカウントは1対1想定。
create view public.v_admin_devices as
with snap as (
  select s.*,
    coalesce(
      (select s2.account_id from public.tel_snapshot s2
         where s2.anon_id = s.anon_id and s2.account_id is not null
         order by s2.created_at desc limit 1),
      s.account_id
    )                                                          as eff_account   -- 端末が一度でもログインしたアカウント(無ければnull=純粋な匿名)
  from public.tel_snapshot s
), keyed as (
  select snap.*, coalesce(eff_account::text, anon_id)          as merge_key     -- 統合単位: 端末が紐づくアカウント / 未ログイン端末はその端末
  from snap
), real_keys as (
  -- ★テスト由来ノイズ(未ログイン かつ 学習0)を除外＝実ユーザーの端末だけ。retention_geo と同じ基準。
  -- ノイズ端末はログインしないので merge_key=anon_id のまま=本人の記録を巻き添えにしない。
  select merge_key from keyed
  group by merge_key
  having bool_or(eff_account is not null)
      or max(coalesce((data->>'learned')::int, 0)) > 0
)
select
  t.*,
  (row_number() over (partition by t.merge_key order by t.last_day desc)) = 1 as is_latest,
  case when t.account_id is not null then '登録' else '匿名' end as kind,
  u.email,
  -- 友だち数(招待制・相互)。town_members は owner↔member 双方向で1友だち=2行ゆえ owner=本人 の行数=友だち人数。匿名(account_id null)=0。
  (select count(*) from public.town_members tm where tm.owner = t.account_id) as friend_count,
  -- 課金状態(アカウント単位。匿名は entitlements 行が無い=null)。
  --   pro_until=紹介/お試しで延ばした期間つきProの終了時刻 / trial_claimed_at=お試し(7日)を受け取った日時 /
  --   reward_grant_count=紹介の継続達成でのべ +7日 された回数。
  --   pro_*=有料サブスク(RevenueCat Webhookで同期)。pro_store_until が未来なら課金有効、pro_plan で 1月/1年 を判別。
  en.pro_until,
  en.trial_claimed_at,
  en.reward_grant_count,
  en.pro_plan,
  en.pro_product_id,
  en.pro_store_until,
  en.pro_will_renew,
  -- 接続国=IP由来のおおよその国(user_geo)。母語(l1)とは独立=英語話者でも日本にいれば JP。ログイン者のみ(匿名はnull)。
  ug.country as geo_country
from (
  select distinct on (merge_key, data->>'level')
    anon_id,
    eff_account                                                as account_id,  -- 表示・結合は解決済みアカウント(ログインした匿名も本人=登録として1人に統合)
    merge_key,
    data->>'level'                                              as level,
    data->>'exam'                                               as exam,
    data->>'platform'                                           as platform,
    -- 「この行は誰か」を特定するための身元列(アプリ版/OS/初回日/利用日数)。
    -- 匿名IDは端末のアプリ内保存に作るUUID＝入れ直し/データ削除/別バンドルで新しいIDになる。
    data->>'app'                                                as app,
    data->>'osVersion'                                          as os_version,
    data->>'uiLang'                                             as ui_lang,
    -- プロフィール(名前/母語/国名/気分/性格/得意)。旧スナップショット(profile無し)はnull=ダッシュボードで「—」。
    data->'profile'->>'nickname'                                as nickname,
    data->'profile'->>'avatar'                                  as avatar,   -- 選んだアバターのコード(m_boy1等)。v1.1.35〜。旧データはnull。
    data->'profile'->>'l1'                                      as l1,
    data->'profile'->>'country'                                 as prof_country,
    data->'profile'->>'mood'                                    as mood,
    data->'profile'->>'personality'                             as personality,
    data->'profile'->>'strong'                                  as strong,
    round(coalesce((data->'readiness'->>'passProb')::numeric,0)) as pass_pct,
    (data->'readiness'->>'passing')::boolean                    as passing,
    -- 予想得点(アプリの主指標。旧スナップショットには無い=null→ダッシュボードで「—」)。
    (data->'readiness'->>'predScore')::int                      as pred_score,
    (data->'readiness'->>'predMax')::int                        as pred_max,
    (data->'readiness'->>'passTotal')::int                      as pass_total,
    -- 相対位置(本番受験者の中で上位何%相当)。v4後半〜。旧スナップショットはnull。※★カードは廃止したが列は互換で残す。
    (data->>'relTop')::numeric                                  as rel_top,
    (data->>'relStars')::int                                    as rel_stars,
    -- 分野別 正解率(5軸: 漢字/語彙/文法/読解/聴解の当て推量補正済み正答率 0-100)。v1.1.35〜。旧スナップショットはnull=「—」。
    (data->'facetAcc'->>'kanji')::numeric                       as acc_kanji,
    (data->'facetAcc'->>'vocab')::numeric                       as acc_vocab,
    (data->'facetAcc'->>'grammar')::numeric                     as acc_grammar,
    (data->'facetAcc'->>'dokkai')::numeric                      as acc_dokkai,
    (data->'facetAcc'->>'choukai')::numeric                     as acc_choukai,
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
    -- 自分が紹介して継続(qualified/rewarded)に達した人数(紹介制度)。旧データ/未ログインは0。
    coalesce((data->>'referredQualified')::int, 0)             as referred_qualified,
    -- 大問別 [習得,母数] の生JSON(8大問)＋合計(v3〜。旧データはnull)。
    data->'daimonMastery'                                       as daimon,
    -- 在庫 {キー: [未出題の残り, 母数]}(v4〜。8大問＋単語タブのドリル3種)。旧データはnull。
    data->'stock'                                               as stock,
    (select coalesce(sum((v->>0)::numeric),0) from jsonb_each(coalesce(data->'daimonMastery','{}'::jsonb)) as e(k,v)) as daimon_learned,
    (select coalesce(sum((v->>1)::numeric),0) from jsonb_each(coalesce(data->'daimonMastery','{}'::jsonb)) as e(k,v)) as daimon_total,
    coalesce((data->>'streak')::int, 0)                         as streak,
    coalesce((data->>'studyDays')::int, 0)                      as study_days,
    round(coalesce((data->>'studySeconds')::numeric,0) / 60)    as study_min,
    coalesce((data->>'learned')::int, 0)                        as learned,
    coalesce((data->>'mockCount')::int, 0)                      as mock_count,
    data->'remaining'                                           as remaining,
    data->'exhausted'                                           as exhausted,
    day                                                         as last_day,
    created_at                                                  as last_ts,   -- 最終「日時」= この行(最新スナップショット)の記録時刻
    -- 初回日/利用日数は「そのレベルを使っていた期間」で数える(行=レベルなので行の中で辻褄が合う)。
    (select min(s2.day)            from keyed s2
       where s2.merge_key = s.merge_key and s2.data->>'level' is not distinct from s.data->>'level') as first_day,
    (select min(s2.created_at)     from keyed s2
       where s2.merge_key = s.merge_key and s2.data->>'level' is not distinct from s.data->>'level') as first_ts,  -- 初回「日時」
    (select count(distinct s2.day) from keyed s2
       where s2.merge_key = s.merge_key and s2.data->>'level' is not distinct from s.data->>'level') as days
  from keyed s
  where s.merge_key in (select merge_key from real_keys)   -- ★テスト由来ノイズ端末を除外(利用者一覧→レベル別/相対位置/在庫も自動連動)
  order by merge_key, data->>'level', day desc, created_at desc
) t
left join auth.users u on u.id = t.account_id
left join public.entitlements en on en.user_id = t.account_id
left join public.user_geo ug on ug.user_id = t.account_id   -- 接続国(IP)を1人1件で結合
order by (t.account_id is null), t.last_day desc, t.level;

-- ③ レベル別 合計・平均(利用者別ビューを N5/N4/N3 で集計)。
--    合計＝人数・今日のアクティブ・学習回数・学習時間。平均＝合格率/カバー率/継続。
--    学習回数 = 練習を最後まで終えた回数(tel_event の session_complete)。
--    ※session_complete は結果画面を出す練習だけが送る(書き取り・カード・一覧は未送信=数に入らない)。
--    ★is_latest の行だけを数える＝1人は「いま使っているレベル」に1回だけ計上。
--      過去に使ったレベルまで足すと、人数も学習時間も同じ人を何度も数えてしまうため。
drop view if exists public.v_admin_level;
create view public.v_admin_level as
select
  coalesce(d.level, '?')                                as level,
  count(*)                                              as users,           -- 総数(is_latest)
  count(*) filter (where d.last_day >= current_date - 6) as active_users,  -- 直近7日に利用=平均の母数
  count(*) filter (where d.last_day = current_date)     as dau,
  coalesce(sum(s.sessions), 0)                          as sessions,
  coalesce(sum(d.study_min), 0)                         as study_min,
  -- ★平均は「アクティブ(直近7日に利用)」だけで計算。インストールしただけ/離脱した幽霊ユーザーで平均が薄まらないように。
  round(avg(d.pred_score) filter (where d.last_day >= current_date - 6))  as avg_pred_score,  -- 平均 予想得点(現行の主指標)
  max(d.pred_max)                                       as pred_max,        -- 満点(JLPTは180)
  round(avg(d.pass_total) filter (where d.last_day >= current_date - 6))  as pass_total,      -- 平均 合格ライン
  round(avg(d.pass_pct)  filter (where d.last_day >= current_date - 6))   as avg_pass_pct,
  round(avg(d.cov_pct)   filter (where d.last_day >= current_date - 6))   as avg_cov_pct,
  round(avg(d.study_min) filter (where d.last_day >= current_date - 6))   as avg_study_min,
  round(avg(d.streak)    filter (where d.last_day >= current_date - 6), 1) as avg_streak,
  coalesce(sum(d.referred_qualified), 0)                as referred_total,
  count(*) filter (where d.passing and d.last_day >= current_date - 6)    as passing_users
  -- ※旧「相対位置(★)」の集計列(avg_rel_top/rel_s1..s5)は廃止＝分野別正解率カード(v_admin_facet_acc)へ置き換え。
from public.v_admin_devices d
left join (
  -- 学習回数(session_complete)は★anon_id ではなく merge_key(アカウント名寄せ)で合算する。
  --   旧アプリ(v1.1.34未満)は再インストール/機種変で anon_id が変わる=同じ人の回数が別IDに散る。
  --   一度でもログインした端末は本人アカウントへ寄せて通算する(旧端末の学習回数が消えて見えない事故を防ぐ)。
  --   ※一度もログインしていない端末どうしは結び付ける相手が無いので端末単位のまま(判定不能)。
  select k.merge_key, count(*) as sessions
  from public.tel_event ev
  join (   -- anon_id → merge_key(v_admin_devices と同じ寄せ方)
    select distinct s.anon_id,
      coalesce(
        (select s2.account_id from public.tel_snapshot s2
           where s2.anon_id = s.anon_id and s2.account_id is not null
           order by s2.created_at desc limit 1)::text,
        s.anon_id
      ) as merge_key
    from public.tel_snapshot s
  ) k on k.anon_id = ev.anon_id
  where ev.name = 'session_complete'
  group by k.merge_key
) s on s.merge_key = d.merge_key
where d.is_latest
group by coalesce(d.level, '?')
order by 1;

-- ③b 分野別 正解率の分布(各レベル × 5軸 × 10%帯)。旧「相対位置(★)」カードの置き換え。
--    5軸=漢字/語彙/文法/読解/聴解の当て推量補正済み正答率(0-100)。行=レベル×軸／帯=0-9,10-19,…,90-100(100は90帯へ)。
--    母集団=is_latest かつ直近7日アクティブ(★カードと同じ・ノイズ除外済み)。測定値のある人だけ数える(未測定=null は除外)。
--    ※アプリ v1.1.35〜が facetAcc を送る。旧スナップショットは null=measured 0=帯はすべて「—」。
drop view if exists public.v_admin_facet_acc;
create view public.v_admin_facet_acc as
with u as (
  select coalesce(level,'?') as level, last_day,
    acc_kanji, acc_vocab, acc_grammar, acc_dokkai, acc_choukai
  from public.v_admin_devices
  where is_latest and last_day >= current_date - 6
), unpiv as (
  select u.level, f.ord, f.facet, f.acc
  from u
  cross join lateral (values
    (1,'漢字',u.acc_kanji),(2,'語彙',u.acc_vocab),(3,'文法',u.acc_grammar),
    (4,'読解',u.acc_dokkai),(5,'聴解',u.acc_choukai)
  ) as f(ord, facet, acc)
)
select
  coalesce(level, '*') as level, ord, facet,
  count(*) filter (where acc is not null)         as measured,   -- その軸に測定値がある人数(＝各帯割合の分母)
  count(*) filter (where acc >= 0  and acc < 10)  as b0,
  count(*) filter (where acc >= 10 and acc < 20)  as b1,
  count(*) filter (where acc >= 20 and acc < 30)  as b2,
  count(*) filter (where acc >= 30 and acc < 40)  as b3,
  count(*) filter (where acc >= 40 and acc < 50)  as b4,
  count(*) filter (where acc >= 50 and acc < 60)  as b5,
  count(*) filter (where acc >= 60 and acc < 70)  as b6,
  count(*) filter (where acc >= 70 and acc < 80)  as b7,
  count(*) filter (where acc >= 80 and acc < 90)  as b8,
  count(*) filter (where acc >= 90)               as b9          -- 90-100(100含む)
from unpiv
group by grouping sets ((level, ord, facet), (ord, facet))   -- level=NULL の行＝全レベル合算('*')
order by level, ord;

-- ③c 日次の成長推移(時系列)。行=日付 × レベル(+ '*'=全レベル)。ダッシュボードの折れ線グラフ用。
--    ★人数は「アカウント名寄せ」で数える(端末単位ではない)。同じアカウントの複数端末/再インストールは1人。
--    tel_snapshot(1日1行)＋tel_event(session_complete)から日ごとに集計。テスト由来ノイズ(未ログイン+学習0)は除外。
--    ・active_users=その日に記録した実ユーザー数(名寄せ) / new_users=その日がインストール日(全端末の最小)の人数
--    ・sessions=その日に完了した練習回数(イベント数=人数化しない) / study_min=その日の学習時間(累計studySecondsの前日差の合計・分)
--    ※tel_snapshot は自動削除しない＝過去も残り、今日以降も自然に伸びる。
drop view if exists public.v_admin_daily;
create view public.v_admin_daily as
with base as (   -- 端末×スナップショット + 名寄せキー
  select s.anon_id, s.day, s.created_at,
    coalesce(s.data->>'level','?')                            as level,
    coalesce((s.data->>'studySeconds')::numeric,0)            as study_sec,
    coalesce((s.data->>'learned')::int,0)                     as learned,
    coalesce(nullif(s.data->>'installDay','')::date, s.day)   as install_day,
    coalesce(
      (select s2.account_id from public.tel_snapshot s2
         where s2.anon_id = s.anon_id and s2.account_id is not null
         order by s2.created_at desc limit 1),
      s.account_id
    )                                                          as eff_account
  from public.tel_snapshot s
), keyed as (
  select base.*, coalesce(eff_account::text, anon_id) as merge_key   -- 統合単位=アカウント / 未ログインは端末
  from base
), realk as (    -- ★実ユーザー(名寄せ済み)。テスト由来ノイズを除外。retention_geo と同じ基準。
  select merge_key from keyed
  group by merge_key
  having bool_or(eff_account is not null) or max(learned) > 0
), amap as (   -- anon_id → merge_key マップ(day1 と同じ寄せ方)。session_complete はイベント自体が level を持たないため、その人のその日のレベルへ寄せる。
  select distinct anon_id, merge_key from keyed
), pins as (     -- 人ごとの真のインストール日(全端末の最小)
  select merge_key, min(install_day) as install_day
  from keyed where merge_key in (select merge_key from realk)
  group by merge_key
), day1 as (     -- 人×日で1行(その日の最新レベル・studySecondsはその日の最大)
  select k.merge_key, k.day,
    (array_agg(k.level order by k.created_at desc))[1]        as level,
    max(k.study_sec)                                          as study_sec
  from keyed k
  where k.merge_key in (select merge_key from realk)
  group by k.merge_key, k.day
), d as (
  select day1.*, p.install_day,
    day1.study_sec - lag(day1.study_sec) over (partition by day1.merge_key order by day1.day) as study_delta
  from day1 join pins p using (merge_key)
), agg as (
  select day, level,
    count(distinct merge_key)                                        as active_users,
    count(distinct merge_key) filter (where install_day = day)       as new_users,
    round(sum(greatest(coalesce(study_delta, study_sec), 0)) / 60.0) as study_min
  from d
  group by grouping sets ((day, level), (day))   -- level=NULL の行＝全レベル合算
), sess_raw as (   -- ★session_complete をレベルへ紐づけ。イベントは level 未送信ゆえ、送信元の人がその日使っていたレベル(day1)を採用。
  select ev.created_at::date as day, coalesce(d1.level, '?') as lvl
  from public.tel_event ev
  join amap a on a.anon_id = ev.anon_id
  left join day1 d1 on d1.merge_key = a.merge_key and d1.day = ev.created_at::date
  where ev.name = 'session_complete' and a.merge_key in (select merge_key from realk)
), sess as (
  select day, lvl, count(*) as sessions
  from sess_raw
  group by grouping sets ((day, lvl), (day))   -- lvl=NULL の行＝全レベル合算('*')
)
select
  coalesce(a.day, s.day)                        as day,
  coalesce(a.level, s.lvl, '*')                 as level,   -- rollup(NULL)→'*'
  coalesce(a.active_users, 0)                   as active_users,
  coalesce(a.new_users, 0)                      as new_users,
  coalesce(a.study_min, 0)                      as study_min,
  coalesce(s.sessions, 0)                       as sessions
from agg a
full join sess s
  on s.day = a.day and coalesce(s.lvl,'*') = coalesce(a.level,'*')
order by day, level;

-- ③d 予想得点・カバー率の分布(各レベル × 2指標 × 10帯)。ヒートマップ表示用(分野別正解率カードと同じ見せ方)。
--    予想得点=満点(180)比%に正規化して10%帯へ / カバー率=そのまま%。母集団=is_latest × 直近7日アクティブ(ノイズ除外済)。
drop view if exists public.v_admin_score_dist;
create view public.v_admin_score_dist as
with u as (
  select coalesce(level,'?') as level,
    case when coalesce(pred_max,0) > 0 then 100.0 * pred_score / pred_max end as pred_pct,
    cov_pct
  from public.v_admin_devices
  where is_latest and last_day >= current_date - 6
), unpiv as (
  select u.level, f.ord, f.metric, f.val
  from u
  cross join lateral (values
    (1,'予想得点', u.pred_pct),
    (2,'カバー率', u.cov_pct)
  ) as f(ord, metric, val)
)
select
  coalesce(level, '*') as level, ord, metric,
  count(*) filter (where val is not null)     as measured,
  count(*) filter (where val>=0  and val<10)  as b0,
  count(*) filter (where val>=10 and val<20)  as b1,
  count(*) filter (where val>=20 and val<30)  as b2,
  count(*) filter (where val>=30 and val<40)  as b3,
  count(*) filter (where val>=40 and val<50)  as b4,
  count(*) filter (where val>=50 and val<60)  as b5,
  count(*) filter (where val>=60 and val<70)  as b6,
  count(*) filter (where val>=70 and val<80)  as b7,
  count(*) filter (where val>=80 and val<90)  as b8,
  count(*) filter (where val>=90)             as b9
from unpiv
group by grouping sets ((level, ord, metric), (ord, metric))   -- level=NULL の行＝全レベル合算('*')
order by level, ord;

-- ④ レベル別 在庫(枯渇状況)。行=レベル / 列=大問・単語タブの学習。
--    data->'stock' の {キー: [残り,母数]}(v4〜)。文字語彙5＋文法3、読解4区分＋聴解5区分(＋各合計)、単語タブ3種。
--    旧アプリ版(v3以前)は stock を持たないので、読解/聴解の合計だけ旧 remaining で埋める(同じキーは新しい方を優先)。
--
--    ★在庫の基準＝「いちばん学習が進んでいる人」(min_left)。
--      在庫 = 母数 − その大問を最も多く学習した人の学習数。
--      誰も学習していなければ 母数そのもの(=アプリの問題数)、誰か1人が全部やり切れば 0 になる。
--      平均(avg_left)は参考値としてツールチップに残す。
--    残り3以下＝先頭の人に出せる新規が尽きた＝コンテンツ不足のサイン。
drop view if exists public.v_admin_exhaust;
drop view if exists public.v_admin_stock;
create view public.v_admin_stock as
select
  level,
  unit,
  min(left_n)                                 as min_left,   -- ★表示の主役=最も進んだ人から見た残り
  round(avg(left_n))                          as avg_left,   -- 参考: 全員の平均
  max(total_n)                                as total,      -- アプリが持つ問題数(最新版の母数)
  count(*) filter (where left_n <= 3)         as exhausted_users,
  count(*)                                    as users
from (
  select coalesce(d.level,'?') as level, e.key as unit,
         (e.value->>0)::numeric as left_n, (e.value->>1)::numeric as total_n
  from public.v_admin_devices d, jsonb_each(coalesce(d.stock, '{}'::jsonb)) as e(key, value)
  union all
  -- 旧版のみの救済。stock に同じキーがある端末は除く(=二重計上しない)。母数は旧版が送っていないので null。
  select coalesce(d.level,'?'), e.key, (e.value)::numeric, null::numeric
  from public.v_admin_devices d, jsonb_each_text(coalesce(d.remaining, '{}'::jsonb)) as e(key, value)
  where e.key in ('dokkai', 'choukai')
    and not (coalesce(d.stock, '{}'::jsonb) ? e.key)
) x
group by level, unit;

-- ⑥ 国別(接続国)。★アカウント名寄せ済みの「人」単位で最新スナップショットの接続国(data.geoCountry=IP由来)を数える(端末単位ではない)。
--    登録 = その人が一度でもログインしたアカウントを持つ / 匿名 = 一度もログインしていない端末。全体 = 実人数。
--    ★利用者一覧(tel_snapshot)を消すと、その人は国別からも自動で消える(削除と完全連動)。
--    旧方式(user_geo + 匿名累計 geo_country_counts)は個人非紐付けで削除連動できなかったため廃止。
--    ※アプリ旧版のスナップショットは geoCountry を持たない→ '??'(アプリ更新後に本当の国へ移る)。
drop view if exists public.v_admin_geo;
create view public.v_admin_geo as
with snap as (
  select s.anon_id, s.created_at, s.day, s.data,
         nullif(s.data->>'geoCountry','')                          as country,
         coalesce((s.data->>'learned')::int, 0)                    as learned,
         coalesce(
           (select s2.account_id from public.tel_snapshot s2
              where s2.anon_id = s.anon_id and s2.account_id is not null
              order by s2.created_at desc limit 1),
           s.account_id
         )                                                          as eff_account   -- 端末が一度でもログインしたアカウント(無ければ匿名)
  from public.tel_snapshot s
), keyed as (
  select snap.*, coalesce(eff_account::text, anon_id) as merge_key   -- 統合単位=アカウント / 未ログインは端末
  from snap
), real_person as (   -- ★実ユーザー(名寄せ済み)。テスト由来ノイズ(未ログイン かつ 学習0)を除外。retention_geo と同じ基準。
  select merge_key from keyed
  group by merge_key
  having bool_or(eff_account is not null) or max(learned) > 0
), amap as (     -- anon_id → merge_key(模試/学習回数を人・国へ寄せる。ノイズ端末は real_person に無い=除外)
  select distinct anon_id, merge_key from keyed
), person as (   -- 名寄せした人ごと最新スナップショット(接続国＋指標の元 data＋最終利用日)
  select distinct on (merge_key) merge_key, country, eff_account, data, day as last_day
  from keyed
  where merge_key in (select merge_key from real_person)           -- ★ノイズ端末を除外(利用者一覧と連動=実ユーザーだけ)
  order by merge_key, created_at desc                               -- 名寄せした人ごと最新スナップショット(=最終利用日)
), pmock as (    -- 人ごと 模試回数・得点合計(国×窓での平均算出用)
  select a.merge_key, count(*) as mock_cnt, sum(m.pct) as mock_pct_sum
  from public.tel_mock m join amap a on a.anon_id = m.anon_id
  where m.pct is not null and a.merge_key in (select merge_key from real_person)
  group by a.merge_key
), psess as (    -- 人ごと 学習回数(session_complete)
  select a.merge_key, count(*) as sess_cnt
  from public.tel_event ev join amap a on a.anon_id = ev.anon_id
  where ev.name = 'session_complete' and a.merge_key in (select merge_key from real_person)
  group by a.merge_key
), pbase as (    -- 集計元=人単位(最新スナップショット指標＋本人の模試/学習回数＋最終利用日)
  select p.merge_key, p.eff_account, coalesce(p.country,'??') as country, p.data, p.last_day,
         coalesce(pm.mock_cnt,0) as mock_cnt, pm.mock_pct_sum, coalesce(ps.sess_cnt,0) as sess_cnt
  from person p
  left join pmock pm on pm.merge_key = p.merge_key
  left join psess ps on ps.merge_key = p.merge_key
), win(win, days) as (   -- ★集計母集団の窓: all=全実ユーザー / 7=直近7日アクティブ / 30=直近30日アクティブ(幽霊ユーザーで平均がぼやけないように)
  values ('all', null::int), ('7', 6), ('30', 29)
)
select
  w.win,                                                            -- ★母集団の窓(ダッシュボードで既定=7)
  b.country,
  count(*) filter (where b.eff_account is not null)  as registered,      -- ログイン済みの人(名寄せ済み)
  count(*)                                           as total_installs,  -- 実人数(名寄せ済み)
  count(*) filter (where b.eff_account is null)      as anonymous_est,   -- 一度もログインしていない端末=匿名
  round(avg((b.data->'readiness'->>'predScore')::numeric))                          as avg_pred_score,   -- 予想得点(平均)
  round(avg((b.data->'facetAcc'->>'kanji')::numeric))                               as acc_kanji,        -- 分野別平均正解率(5軸)
  round(avg((b.data->'facetAcc'->>'vocab')::numeric))                               as acc_vocab,
  round(avg((b.data->'facetAcc'->>'grammar')::numeric))                             as acc_grammar,
  round(avg((b.data->'facetAcc'->>'dokkai')::numeric))                              as acc_dokkai,
  round(avg((b.data->'facetAcc'->>'choukai')::numeric))                             as acc_choukai,
  round(avg(case when (b.data->'coverage'->'kanji'->>'total')::numeric > 0          -- 学習分野別カバー率(平均)
      then 100*(b.data->'coverage'->'kanji'->>'learned')::numeric/(b.data->'coverage'->'kanji'->>'total')::numeric end))   as cov_kanji,
  round(avg(case when (b.data->'coverage'->'vocab'->>'total')::numeric > 0
      then 100*(b.data->'coverage'->'vocab'->>'learned')::numeric/(b.data->'coverage'->'vocab'->>'total')::numeric end))   as cov_vocab,
  round(avg(case when (b.data->'coverage'->'grammar'->>'total')::numeric > 0
      then 100*(b.data->'coverage'->'grammar'->>'learned')::numeric/(b.data->'coverage'->'grammar'->>'total')::numeric end)) as cov_grammar,
  sum(b.mock_cnt)                                                                   as mock_total,       -- 模試回数(合計)
  case when sum(b.mock_cnt) > 0 then round(sum(b.mock_pct_sum) / sum(b.mock_cnt)) end as avg_mock_pct,   -- 模試得点(平均%・回数加重)
  sum(b.sess_cnt)                                                                   as sessions,         -- 学習回数(合計)
  round(sum(coalesce((b.data->>'studySeconds')::numeric,0)) / 60)                  as study_min         -- 学習時間(合計・分)
from pbase b cross join win w
where w.days is null or b.last_day >= current_date - w.days          -- ★窓でアクティブな人だけに絞って統計
group by w.win, b.country
order by w.win, total_installs desc;

-- ⑦ 紹介(誰が誰を紹介したか)。referrals の new_user_ref はテレメトリ匿名IDと同じキーなので、
--    紹介された人の身元(アカウント/メール/名前)まで辿れる。紹介者はメールで表示。
--    ※紹介された人がログインしていれば new_user_email が出る。未ログインなら匿名IDの先頭＋名前(あれば)。
--    ※名前(nickname)はアプリ更新後のスナップショットから。メール/状態/日時はいまのデータで出る。
drop view if exists public.v_admin_referrals;
create view public.v_admin_referrals as
with new_ident as (      -- 匿名IDごとに最新スナップショットの身元(アカウント/名前)
  select distinct on (anon_id) anon_id, account_id, data->'profile'->>'nickname' as nickname
  from public.tel_snapshot
  order by anon_id, created_at desc
)
select
  r.referrer_user_id,
  ru.email                                        as referrer_email,
  -- 友だち数(相互・招待制)。owner=本人 の town_members 行数=友だち人数。紹介と友だちは別制度なので両方見える。
  (select count(*) from public.town_members tm where tm.owner = r.referrer_user_id) as referrer_friends,   -- 紹介した人の友だち数
  r.new_user_ref,
  n.account_id                                    as new_user_account,
  nu.email                                        as new_user_email,
  n.nickname                                      as new_user_nickname,
  (select count(*) from public.town_members tm where tm.owner = n.account_id)       as new_user_friends,    -- 紹介された人の友だち数(未ログインは0)
  r.status,                                       -- pending|qualified|rewarded|rejected
  r.install_at,
  r.qualified_at
from public.referrals r
left join auth.users ru on ru.id = r.referrer_user_id
left join new_ident  n  on n.anon_id = r.new_user_ref
left join auth.users nu on nu.id = n.account_id
order by r.referrer_user_id, r.qualified_at desc nulls last, r.install_at desc nulls last;

-- ⑧ 友だち(誰と誰が友だちか)。招待制・相互ゆえ town_members は owner↔member の双方向2行=1ペア。owner<member で1ペアに畳む。
--    ※招待した側/された側の区別は town_members に残らない(相互に同時登録)ため、無向のペアとして出す。
--    身元=メール(auth.users)＋ニックネーム(friend_profiles)。どちらか未設定なら null=ダッシュボードで「—」。
drop view if exists public.v_admin_friends;
create view public.v_admin_friends as
select
  m.owner                              as user_a,
  ua.email                             as email_a,
  fa.nickname                          as nick_a,
  m.member                             as user_b,
  ub.email                             as email_b,
  fb.nickname                          as nick_b,
  m.created_at                         as since
from public.town_members m
left join auth.users ua             on ua.id = m.owner
left join auth.users ub             on ub.id = m.member
left join public.friend_profiles fa on fa.user_id = m.owner
left join public.friend_profiles fb on fb.user_id = m.member
where m.owner < m.member               -- 相互2行を1ペアに畳む(無向)
order by m.created_at desc;

-- ⑨ 模試の得点分布(各レベル × 得点10帯 × 回数・合算)。行=レベル(+'*'=全レベル合算)。tel_mock の pct を10%帯へ。
--    測定=模試の実施「回数」(人単位ではなく回数を合算)。分野別正解率カードと同じヒートマップ描画で表示。
--    ※生データ tel_mock(created_at付き・自動削除しない)に貯まる=下の月次ビューで推移も追える。
drop view if exists public.v_admin_mock_dist;
create view public.v_admin_mock_dist as
with m as (
  select coalesce(level, '?') as level, pct
  from public.tel_mock
  where pct is not null
)
select
  coalesce(level, '*')                            as level,   -- rollup(NULL)→'*'(全レベル合算)
  1                                               as ord,
  '模試得点'                                       as label,
  count(*)                                        as measured,   -- その帯グループの母数=模試回数
  count(*) filter (where pct >= 0  and pct < 10)  as b0,
  count(*) filter (where pct >= 10 and pct < 20)  as b1,
  count(*) filter (where pct >= 20 and pct < 30)  as b2,
  count(*) filter (where pct >= 30 and pct < 40)  as b3,
  count(*) filter (where pct >= 40 and pct < 50)  as b4,
  count(*) filter (where pct >= 50 and pct < 60)  as b5,
  count(*) filter (where pct >= 60 and pct < 70)  as b6,
  count(*) filter (where pct >= 70 and pct < 80)  as b7,
  count(*) filter (where pct >= 80 and pct < 90)  as b8,
  count(*) filter (where pct >= 90)               as b9          -- 90-100(100含む)
from m
group by grouping sets ((level), ())               -- () = 全レベル合算(level=NULL→'*')
order by level;

-- ⑩ 月次 模試サマリー(推移グラフ用の実例)。tel_mock は1回1行(created_at付き)＝月×レベルでそのまま集計できる。
--    →「1ヶ月ごとの時間変化」はこの形で出せる(回数と平均得点)。同様に日次は v_admin_daily、生データは各 tel_* に蓄積。
drop view if exists public.v_admin_mock_monthly;
create view public.v_admin_mock_monthly as
with m as (
  select date_trunc('month', created_at)::date as mon, coalesce(level,'?') as level, pct
  from public.tel_mock
  where pct is not null
)
select
  to_char(mon, 'YYYY-MM')          as month,
  coalesce(level, '*')             as level,        -- rollup(NULL)→'*'
  count(*)                         as mocks,        -- その月の模試回数
  round(avg(pct))                  as avg_pct       -- その月の平均得点%
from m
group by grouping sets ((mon, level), (mon))        -- (mon) = 全レベル合算
order by mon, level;

-- 旧「アカウント別 横並び」ビューは撤去(登録者は上の v_admin_devices に統合済み=メール＋合格率まで1表で見える)。
drop view if exists public.v_admin_accounts;

-- 読み取り権限は service_role のみ(管理者用)。anon/authenticated には出さない=メール等が漏れない。
grant select on
  public.v_admin_summary,
  public.v_admin_devices,
  public.v_admin_level,
  public.v_admin_facet_acc,
  public.v_admin_daily,
  public.v_admin_score_dist,
  public.v_admin_stock,
  public.v_admin_geo,
  public.v_admin_referrals,
  public.v_admin_friends,
  public.v_admin_mock_dist,
  public.v_admin_mock_monthly
to service_role;

-- ダッシュボードの「ごみ箱」ボタンは、これらの元表を service_role で REST DELETE する。
-- (service_role は通常フル権限だが、環境差で消せない事故を防ぐため明示的に付与しておく。)
grant select, delete on public.tel_event, public.tel_mock, public.tel_snapshot, public.user_state to service_role;

-- ⑤ 手入れ用(コピーして使う): テスト端末など、要らない利用者を完全に消す。
--    ビューからは消せない(v_admin_devices は集計ビュー=読み取り専用)。必ず元の表から消す。
--    ⚠ 取り消せません。先に select で中身を確かめてから delete すること。
--
-- (1) まず確認: 何者で何件あるか。account_id が出たら「登録アカウント」も持っている。
-- select anon_id, account_id, data->>'level' as level, count(*) as snapshots, min(day) as first, max(day) as last
--   from public.tel_snapshot where anon_id like 'e28ed898-%' group by 1,2,3 order by 3;
--
-- (2) 利用ログを消す(＝ダッシュボードの利用者一覧・在庫・レベル別から消える)。
-- delete from public.tel_event    where anon_id like 'e28ed898-%';
-- delete from public.tel_mock     where anon_id like 'e28ed898-%';
-- delete from public.tel_snapshot where anon_id like 'e28ed898-%';
--
-- (3) 登録アカウントも消す場合だけ追加で実行((1)で account_id が出た時のみ)。
--     user_state=クラウド同期データ。auth.users=ログインそのもの(消すとログインできなくなる)。
-- delete from public.user_state where user_id in (
--   select distinct account_id from public.tel_snapshot where anon_id like 'e28ed898-%' and account_id is not null);
-- -- auth.users は Dashboard の Authentication > Users から消すのが安全(SQLで消すと関連行が残ることがある)。
