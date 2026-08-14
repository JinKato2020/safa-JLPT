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
create view public.v_admin_devices as
select
  t.*,
  (row_number() over (partition by t.anon_id order by t.last_day desc)) = 1 as is_latest,
  case when t.account_id is not null then '登録' else '匿名' end as kind,
  u.email,
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
  select distinct on (anon_id, data->>'level')
    anon_id,
    account_id,
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
    -- 相対位置(本番受験者の中で上位何%相当)。v4後半〜。旧スナップショットはnull。
    (data->>'relTop')::numeric                                  as rel_top,
    (data->>'relStars')::int                                    as rel_stars,
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
    (select min(s2.day)            from public.tel_snapshot s2
       where s2.anon_id = s.anon_id and s2.data->>'level' is not distinct from s.data->>'level') as first_day,
    (select min(s2.created_at)     from public.tel_snapshot s2
       where s2.anon_id = s.anon_id and s2.data->>'level' is not distinct from s.data->>'level') as first_ts,  -- 初回「日時」
    (select count(distinct s2.day) from public.tel_snapshot s2
       where s2.anon_id = s.anon_id and s2.data->>'level' is not distinct from s.data->>'level') as days
  from public.tel_snapshot s
  order by anon_id, data->>'level', day desc, created_at desc
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
  count(*) filter (where d.passing and d.last_day >= current_date - 6)    as passing_users,
  -- 相対位置(本番受験者の中で上位何%相当)。平均＋★区分の分布(アクティブのみ)。閾値=starsFromTop(15/30/50/70%)。
  round(avg(d.rel_top) filter (where d.last_day >= current_date - 6), 1)                        as avg_rel_top,
  count(*) filter (where d.rel_top <= 15 and d.last_day >= current_date - 6)                    as rel_s5,
  count(*) filter (where d.rel_top > 15 and d.rel_top <= 30 and d.last_day >= current_date - 6) as rel_s4,
  count(*) filter (where d.rel_top > 30 and d.rel_top <= 50 and d.last_day >= current_date - 6) as rel_s3,
  count(*) filter (where d.rel_top > 50 and d.rel_top <= 70 and d.last_day >= current_date - 6) as rel_s2,
  count(*) filter (where d.rel_top > 70 and d.last_day >= current_date - 6)                     as rel_s1
from public.v_admin_devices d
left join (
  select anon_id, count(*) as sessions
  from public.tel_event where name = 'session_complete' group by anon_id
) s on s.anon_id = d.anon_id
where d.is_latest
group by coalesce(d.level, '?')
order by 1;

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

-- ⑥ 国別(接続国)。登録=user_geo(ログイン済みアカウントのIP国) / 全体=geo_country_counts(インストール概算・匿名含む)。
--    匿名の概算 = 全体 − 登録(マイナスは0に丸め)。国はIP由来のおおよその判定。
--    ※全体(geo_country_counts)はアプリ更新後に溜まる。登録(user_geo)は既にデータあり。
drop view if exists public.v_admin_geo;
create view public.v_admin_geo as
select
  coalesce(g.country, c.country)                                   as country,
  coalesce(g.registered, 0)                                        as registered,      -- ログイン済みアカウント数
  greatest(coalesce(c.total, 0), coalesce(g.registered, 0))        as total_installs,  -- 全体(概算)。登録を下回らないよう max をとる(全体≥登録)。匿名カウント未蓄積(ビルド前)は登録数を表示
  greatest(coalesce(c.total, 0) - coalesce(g.registered, 0), 0)    as anonymous_est    -- 匿名の概算=全体−登録(マイナスは0)
from (select country, count(*) as registered from public.user_geo group by country) g
full outer join (select country, sum(count) as total from public.geo_country_counts group by country) c
  on g.country = c.country
order by coalesce(c.total, 0) desc, coalesce(g.registered, 0) desc;

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
  r.new_user_ref,
  n.account_id                                    as new_user_account,
  nu.email                                        as new_user_email,
  n.nickname                                      as new_user_nickname,
  r.status,                                       -- pending|qualified|rewarded|rejected
  r.install_at,
  r.qualified_at
from public.referrals r
left join auth.users ru on ru.id = r.referrer_user_id
left join new_ident  n  on n.anon_id = r.new_user_ref
left join auth.users nu on nu.id = n.account_id
order by r.referrer_user_id, r.qualified_at desc nulls last, r.install_at desc nulls last;

-- 旧「アカウント別 横並び」ビューは撤去(登録者は上の v_admin_devices に統合済み=メール＋合格率まで1表で見える)。
drop view if exists public.v_admin_accounts;

-- 読み取り権限は service_role のみ(管理者用)。anon/authenticated には出さない=メール等が漏れない。
grant select on
  public.v_admin_summary,
  public.v_admin_devices,
  public.v_admin_level,
  public.v_admin_stock,
  public.v_admin_geo,
  public.v_admin_referrals
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
