-- ============================================================================
-- 教師専用サイト用: 学校グループ + 教師ビュー + 教師セルフ運用RPC(案C)
--   目的  : 日本語学校の先生が「自分が登録した生徒だけ」の学習状況/成長を閲覧できる。
--   運用方針(案C):
--     ・管理ダッシュボード(dashboard.html / service_role)は【学校の作成】と【先生の登録/削除】、
--       そして【学校ごとの先生数・生徒数(カウントのみ)】を扱う。生徒個々は扱わない。
--     ・生徒の登録/削除は【先生自身】が teacher.html から行う(1先生あたり最大20人)。
--       先生は認証(ログイン中のメール=auth.email())で本人確認され、専用RPC経由でのみ操作できる。
--   安全性:
--     ・生徒の学習データは v_admin_devices(service_roleのみ)に入っている。これを直接公開せず、
--       auth.email() で「ログイン中の先生が登録した生徒」に絞った専用ビュー v_teacher_students 経由で
--       のみ authenticated に見せる。無関係なログイン者が開いても 0 件。
--     ・school_members への書き込みは RLS で塞ぎ、SECURITY DEFINER の teacher_* 関数(20人上限を内蔵)
--       だけが代理で書く。クライアントは学校IDや他人の生徒を自由に操作できない。
--
--   ⚠️ 依存注意: v_teacher_students は public.v_admin_devices を参照する。dashboard_views.sql は
--      先頭で `drop view v_admin_devices cascade` を行うため、dashboard_views.sql を
--      再実行したら、この school_teacher.sql も必ず再実行すること(cascadeで一緒に消える)。
-- ============================================================================

-- 1) 学校 ---------------------------------------------------------------------
--    license_until: 団体ライセンスの有効期限。入金確認後に管理者が設定=学校の「有効化」。
--      この学校の生徒(登録済み)は license_until まで Pro 全機能が使える(entitlements.pro_until に反映)。
create table if not exists public.schools (
  id            bigint generated always as identity primary key,
  name          text not null,
  country       text,                                -- 国名(英語の正本名 or 自由入力)。管理ダッシュボードで一覧表示。
  license_until timestamptz,                         -- null=未有効化
  created_at    timestamptz not null default now()
);
alter table public.schools add column if not exists license_until timestamptz;
alter table public.schools add column if not exists country       text;

-- 2) 所属(メールで指定)
--    role: 'teacher'(閲覧できる人) / 'student'(見られる対象)
--    teacher_email: その生徒を登録した先生のメール(role='student' のときだけ入る。先生行は NULL)
--                   → 「1先生=最大20人」「先生は自分が登録した生徒だけ見える」を成立させる鍵。
create table if not exists public.school_members (
  school_id     bigint not null references public.schools(id) on delete cascade,
  email         text   not null,
  role          text   not null check (role in ('teacher','student')),
  teacher_email text,                                   -- 生徒を登録した先生(生徒行のみ)
  teacher_code  text,                                   -- 団体コード(先生行のみ)
  created_at    timestamptz not null default now(),
  primary key (school_id, email, role)
);
-- teacher_code: 先生ごとの「団体コード」(先生行だけ)。生徒はアプリでこのコードを入力すると
--               その先生の生徒として自動で紐づく(友だち紹介コードと同じ発想)。
--   → 登録方法は2通り: ①先生がメールで個別追加(teacher_add_student) ②生徒がコードで自己参加(join_school_by_code)。
-- 既存DBへの追加(列が無ければ足す。既存の案B最小版からの移行用)。
alter table public.school_members add column if not exists teacher_email text;
alter table public.school_members add column if not exists teacher_code  text;
create index if not exists ix_school_members_email         on public.school_members (lower(email));
create index if not exists ix_school_members_teacher_email on public.school_members (lower(teacher_email));
-- 団体コードは全体で一意(先生行のみ)。大文字小文字を無視して重複禁止。
create unique index if not exists ux_school_members_teacher_code
  on public.school_members (lower(teacher_code)) where teacher_code is not null;

-- 直接APIから触れないように(管理はSQL Editor/管理ダッシュボード=service_role、
-- 生徒登録は下の teacher_* 関数=SECURITY DEFINER のみ)。
-- ポリシー無し=anon/authenticatedは直接select/insert不可。所有者/service_roleはRLSを迂回。
alter table public.schools        enable row level security;
alter table public.school_members enable row level security;

-- 管理ダッシュボード(dashboard.html)は service_role で学校/所属をCRUDする。
-- RLSを迂回できても「テーブルへのGRANT」が別途必要(無いと 42501 permission denied)。
grant select, insert, update, delete on public.schools        to service_role;
grant select, insert, update, delete on public.school_members to service_role;

-- 3) 教師専用ビュー(自分が登録した生徒だけ) -----------------------------------
--    security_invoker=false(所有者権限)で v_admin_devices を読み、WHERE を auth.email()
--    (JWT由来=クライアント改ざん不可)で「ログイン中の先生が登録した生徒」に限定。
--    LEFT JOIN なので、まだログイン/学習していない生徒も「登録済み・データ—」で表示される。
drop view if exists public.v_teacher_students cascade;
create view public.v_teacher_students
with (security_invoker = false) as
select
  sm.school_id,
  sc.name                                    as school_name,
  sm.email,                                  -- 先生が登録したメール(名簿の正本)
  sm.teacher_email,                          -- 登録した先生
  (d.email is not null)                      as has_data,   -- ログイン&学習済みか
  d.nickname,
  d.level,
  d.pred_score,                              -- 予想得点
  d.pred_max,
  d.pass_total,
  d.pass_pct,                                -- 合格率(%)
  d.cov_kanji, d.cov_vocab, d.cov_grammar,   -- カバー率(漢字/語彙/文法 %)
  d.acc_kanji, d.acc_vocab, d.acc_grammar,   -- 分野別正答率(5軸 %)
  d.acc_dokkai, d.acc_choukai,
  d.study_min,                               -- 学習時間(分)
  d.study_days,                              -- 学習日数
  d.streak,                                  -- 連続日数
  d.mock_count,                              -- 模試回数
  d.first_day,                               -- 初回日
  d.last_day,                                -- 最終アクセス
  d.days                                     -- 利用日数
from public.school_members sm
join public.schools sc on sc.id = sm.school_id
left join public.v_admin_devices d
       on lower(d.email) = lower(sm.email)
      and d.is_latest                        -- 1生徒=今使っているレベルの1行
      and d.account_id is not null           -- ログイン済み(メールあり)のみ
where sm.role = 'student'
  and lower(coalesce(sm.teacher_email, '')) = lower(coalesce(auth.email(), ''));

revoke all on public.v_teacher_students from anon;
grant select on public.v_teacher_students to authenticated;

-- 4) 教師セルフ運用RPC(先生が teacher.html から呼ぶ) --------------------------
--    すべて SECURITY DEFINER(所有者権限)。本人確認は auth.email()(JWT由来)で行い、
--    クライアントが学校IDや他人の生徒を指定しても効かない(自分の所属/自分の生徒に固定)。

-- 4-0) 内部: メールのメンバー(生徒/先生)に、所属する学校の有効ライセンス期限まで Pro を付与する。
--      団体ライセンス = Pro全機能解放(生徒も先生も)。コード参加/メール登録/一括付与/起動時claimから呼ぶ。
--      アカウント未作成(user_id無し)なら何もしない→本人がアプリで claim_school_entitlement() 実行時に付与。
--      既存の pro_until より短くはしない(本人が買ったProや他校の期限を縮めない)=greatest。
create or replace function public._grant_school_pro_by_email(p_email text)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_uid uuid; v_until timestamptz; v_email text := lower(trim(coalesce(p_email,'')));
begin
  if v_email = '' then return null; end if;
  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is null then return null; end if;              -- まだアカウント無し(後で claim で付与)
  select max(sc.license_until) into v_until
  from public.school_members sm
  join public.schools sc on sc.id = sm.school_id
  where sm.role in ('student','teacher') and lower(sm.email) = v_email   -- 生徒も先生も対象
    and sc.license_until is not null and sc.license_until > now();
  if v_until is null then return null; end if;            -- 有効なライセンス無し
  insert into public.entitlements (user_id, pro_until)
    values (v_uid, v_until)
    on conflict (user_id) do update
      set pro_until = greatest(public.entitlements.pro_until, excluded.pro_until), updated_at = now();
  return v_until;
end;
$$;
revoke all on function public._grant_school_pro_by_email(text) from public, anon, authenticated;

-- 4-1) 自分(先生)のホーム情報: 学校名・登録済み生徒数・上限。先生でなければ null。
create or replace function public.teacher_home()
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_me     text := lower(coalesce(auth.email(), ''));
  v_school bigint;
  v_name   text;
  v_code   text;
  v_cnt    int;
begin
  if v_me = '' then return null; end if;
  select sm.school_id, sc.name, sm.teacher_code into v_school, v_name, v_code
  from public.school_members sm
  join public.schools sc on sc.id = sm.school_id
  where sm.role = 'teacher' and lower(sm.email) = v_me
  order by sm.school_id
  limit 1;
  if v_school is null then return null; end if;
  select count(*) into v_cnt
  from public.school_members
  where role = 'student' and lower(teacher_email) = v_me;
  return json_build_object(
    'school_id',     v_school,
    'school_name',   v_name,
    'teacher_code',  v_code,            -- 団体コード(未発行なら null)
    'student_count', v_cnt,
    'student_cap',   20
  );
end;
$$;

-- 4-1b) 団体コードを取得(無ければ発行)。p_regenerate=true で作り直す。
--       生徒はこのコードをアプリで入力して自分で紐づく(join_school_by_code)。
create or replace function public.teacher_code(p_regenerate boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me     text := lower(coalesce(auth.email(), ''));
  v_school bigint;
  v_cur    text;
  v_new    text;
  v_try    int := 0;
begin
  if v_me = '' then raise exception '先生としてログインしていません。'; end if;
  select school_id, teacher_code into v_school, v_cur
  from public.school_members
  where role = 'teacher' and lower(email) = v_me
  order by school_id limit 1;
  if not found then raise exception 'この学校の先生として登録されていません。'; end if;
  if v_cur is not null and not p_regenerate then return v_cur; end if;

  -- 紛らわしい文字(0/O/1/I/L)を避けた6桁コードを一意になるまで生成。1つの先生行(1校)に付与。
  loop
    v_try := v_try + 1;
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
                             (floor(random()*31)::int)+1, 1), '')
      into v_new
      from generate_series(1, 6);
    begin
      update public.school_members
        set teacher_code = v_new
        where role = 'teacher' and lower(email) = v_me and school_id = v_school;
      return v_new;
    exception when unique_violation then
      if v_try > 20 then raise exception 'コードの発行に失敗しました。もう一度お試しください。'; end if;
    end;
  end loop;
end;
$$;

-- 4-2) 生徒を1人登録(最大20人)。既に自分の生徒なら冪等に成功を返す。
create or replace function public.teacher_add_student(p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me     text := lower(coalesce(auth.email(), ''));
  v_school bigint;
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_cnt    int;
begin
  if v_me = '' then raise exception '先生としてログインしていません。'; end if;
  select school_id into v_school
  from public.school_members
  where role = 'teacher' and lower(email) = v_me
  order by school_id limit 1;
  if v_school is null then raise exception 'この学校の先生として登録されていません。管理者にご確認ください。'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'メールアドレスの形式が正しくありません。'; end if;
  if v_email = v_me then raise exception '先生自身は生徒として登録できません。'; end if;  -- 教師サイトに先生自身のスコアを出さないため

  -- 既に自分の生徒 → 冪等成功(上限に二重計上しない)。
  if exists (
    select 1 from public.school_members
    where role = 'student' and school_id = v_school
      and lower(email) = v_email and lower(coalesce(teacher_email,'')) = v_me
  ) then
    select count(*) into v_cnt from public.school_members
    where role = 'student' and lower(teacher_email) = v_me;
    return json_build_object('ok', true, 'duplicate', true, 'count', v_cnt, 'cap', 20);
  end if;

  select count(*) into v_cnt from public.school_members
  where role = 'student' and lower(teacher_email) = v_me;
  if v_cnt >= 20 then raise exception '登録できる生徒は20人までです(現在20人)。'; end if;

  insert into public.school_members (school_id, email, role, teacher_email)
  values (v_school, v_email, 'student', v_me)
  on conflict (school_id, email, role)
    do update set teacher_email = excluded.teacher_email;   -- 他の先生の生徒だった場合は引き継ぐ

  perform public._grant_school_pro_by_email(v_email);       -- 団体ライセンス有効なら即Pro付与(未登録アカウントは後でclaim)

  select count(*) into v_cnt from public.school_members
  where role = 'student' and lower(teacher_email) = v_me;
  return json_build_object('ok', true, 'count', v_cnt, 'cap', 20);
end;
$$;

-- 4-3) 自分の生徒を1人削除。
create or replace function public.teacher_remove_student(p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    text := lower(coalesce(auth.email(), ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_cnt   int;
begin
  if v_me = '' then raise exception '先生としてログインしていません。'; end if;
  delete from public.school_members
  where role = 'student' and lower(email) = v_email and lower(coalesce(teacher_email,'')) = v_me;
  select count(*) into v_cnt from public.school_members
  where role = 'student' and lower(teacher_email) = v_me;
  return json_build_object('ok', true, 'count', v_cnt, 'cap', 20);
end;
$$;

-- 4-4) 生徒が「団体コード」で自分の先生に紐づく(アプリのコード入力欄から呼ぶ)。
--      本人=auth.email() を生徒として登録。先生側の20人上限をここでも守る。
create or replace function public.join_school_by_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       text := lower(coalesce(auth.email(), ''));
  v_code     text := upper(trim(coalesce(p_code, '')));
  v_school   bigint;
  v_teacher  text;
  v_name     text;
  v_cnt      int;
begin
  if v_me = '' then raise exception 'ログインしてから入力してください。'; end if;
  if v_code = '' then raise exception '団体コードを入力してください。'; end if;

  -- コードから先生(と学校)を特定。
  select sm.school_id, lower(sm.email), sc.name
    into v_school, v_teacher, v_name
  from public.school_members sm
  join public.schools sc on sc.id = sm.school_id
  where sm.role = 'teacher' and upper(sm.teacher_code) = v_code
  limit 1;
  if v_school is null then raise exception '団体コードが見つかりません。先生に確認してください。'; end if;

  -- 先生自身がコードを入れた場合は何もしない。
  if v_teacher = v_me then
    return json_build_object('ok', true, 'school_name', v_name, 'self', true);
  end if;

  -- 既にこの先生の生徒 → 冪等成功。
  if exists (
    select 1 from public.school_members
    where role = 'student' and school_id = v_school
      and lower(email) = v_me and lower(coalesce(teacher_email,'')) = v_teacher
  ) then
    return json_build_object('ok', true, 'school_name', v_name, 'duplicate', true);
  end if;

  -- 先生の20人上限。
  select count(*) into v_cnt from public.school_members
  where role = 'student' and lower(teacher_email) = v_teacher;
  if v_cnt >= 20 then raise exception 'この先生の登録枠(20人)がいっぱいです。先生に確認してください。'; end if;

  insert into public.school_members (school_id, email, role, teacher_email)
  values (v_school, v_me, 'student', v_teacher)
  on conflict (school_id, email, role)
    do update set teacher_email = excluded.teacher_email;
  perform public._grant_school_pro_by_email(v_me);          -- 団体ライセンス有効なら即Pro付与
  return json_build_object('ok', true, 'school_name', v_name);
end;
$$;

-- 4-5) 生徒の現在の所属(学校名)。アプリで「所属: 〇〇」を出すため。所属なしは null。
create or replace function public.student_home()
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_me   text := lower(coalesce(auth.email(), ''));
  v_name text;
begin
  if v_me = '' then return null; end if;
  select sc.name into v_name
  from public.school_members sm
  join public.schools sc on sc.id = sm.school_id
  where sm.role = 'student' and lower(sm.email) = v_me
  order by sm.school_id limit 1;
  if v_name is null then return null; end if;
  return json_build_object('school_name', v_name);
end;
$$;

-- 4-6) 生徒本人が、所属校の有効ライセンス分の Pro を受け取る(アプリ起動時/参加直後に呼ぶ)。
--      先生にメールで登録されたがアカウントを後から作った生徒も、これで Pro を受け取れる。
--      返り値=付与後の pro_until(epoch的にはクライアントが解釈)。対象外は null。
create or replace function public.claim_school_entitlement()
returns timestamptz
language sql
security definer
set search_path = public, auth
as $$
  select public._grant_school_pro_by_email(lower(coalesce(auth.email(), '')));
$$;

revoke all on function public.teacher_home()                  from anon;
revoke all on function public.claim_school_entitlement()      from anon;
revoke all on function public.teacher_code(boolean)           from anon;
revoke all on function public.teacher_add_student(text)       from anon;
revoke all on function public.teacher_remove_student(text)    from anon;
revoke all on function public.join_school_by_code(text)       from anon;
revoke all on function public.student_home()                  from anon;
grant execute on function public.teacher_home()               to authenticated;
grant execute on function public.teacher_code(boolean)        to authenticated;
grant execute on function public.teacher_add_student(text)    to authenticated;
grant execute on function public.teacher_remove_student(text) to authenticated;
grant execute on function public.join_school_by_code(text)    to authenticated;
grant execute on function public.student_home()               to authenticated;
grant execute on function public.claim_school_entitlement()   to authenticated;

-- 5) 管理ダッシュボード用: 学校ごとの先生数・生徒数＋ライセンス期限(カウントのみ) ----
-- 旧版(license_until 無し)が既にあると create or replace は列の途中追加を許さず 42P16 になる。drop して作り直す。
drop view if exists public.v_school_counts cascade;
create view public.v_school_counts as
select
  sc.id,
  sc.name,
  sc.country,
  sc.license_until,
  count(*) filter (where sm.role = 'teacher') as teachers,
  count(*) filter (where sm.role = 'student') as students
from public.schools sc
left join public.school_members sm on sm.school_id = sc.id
group by sc.id, sc.name, sc.country, sc.license_until
order by sc.name;
grant select on public.v_school_counts to service_role;

-- 6) 管理ダッシュボード用: 学校ライセンスの有効化＋全生徒へ一括Pro付与 ----------
--    入金確認後に管理者が呼ぶ。schools.license_until を設定し、その学校の既存生徒(アカウント有り)
--    全員に license_until まで Pro を付与(greatest=既存の長いProは縮めない)。
--    まだアカウント未作成の生徒は、本人がアプリ起動時に claim_school_entitlement() で受け取る。
--    返り値: 付与できた人数 / 登録生徒数。
create or replace function public.admin_grant_school_license(p_school_id bigint, p_until timestamptz)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_total int := 0; v_granted int := 0; r record;
begin
  update public.schools set license_until = p_until where id = p_school_id;
  if not found then raise exception 'school % が見つかりません', p_school_id; end if;
  for r in
    select distinct lower(email) as email
    from public.school_members where school_id = p_school_id   -- 生徒＋先生の両方
  loop
    v_total := v_total + 1;
    if public._grant_school_pro_by_email(r.email) is not null then
      v_granted := v_granted + 1;
    end if;
  end loop;
  return json_build_object('ok', true, 'granted', v_granted, 'members', v_total, 'until', p_until);
end;
$$;
revoke all on function public.admin_grant_school_license(bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_grant_school_license(bigint, timestamptz) to service_role;

-- 6b) 管理ダッシュボード用: 学校ライセンスを停止＝全生徒の付与Proを失効させる ----
--     license_until を過去にし、その学校の生徒(アカウント有り)の entitlements.pro_until を過去に落とす。
--     ※ greatest を使う付与と違い、ここは「下げる」= 実際にProを止める。
--     ※ ストア課金(RevenueCatのpurchaseActive)はここでは触れない=別途購入した生徒はPro維持。
--       pro_until は紹介/お試し由来とも共用の1列なので、それらも一緒に失効する点は許容(パイロット前提)。
--     返り値: 実際に失効させた人数 / 登録生徒数。
create or replace function public.admin_revoke_school_pro(p_school_id bigint)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_total int := 0; v_revoked int := 0; r record; v_uid uuid; v_past timestamptz := now() - interval '1 day';
begin
  update public.schools set license_until = v_past where id = p_school_id;
  if not found then raise exception 'school % が見つかりません', p_school_id; end if;
  for r in
    select distinct lower(email) as email
    from public.school_members where school_id = p_school_id   -- 生徒＋先生の両方
  loop
    v_total := v_total + 1;
    select id into v_uid from auth.users where lower(email) = r.email;
    if v_uid is not null then
      update public.entitlements
        set pro_until = v_past, updated_at = now()
        where user_id = v_uid and pro_until > v_past;   -- 現在Pro中の人だけ落とす
      if found then v_revoked := v_revoked + 1; end if;
    end if;
  end loop;
  return json_build_object('ok', true, 'revoked', v_revoked, 'members', v_total);
end;
$$;
revoke all on function public.admin_revoke_school_pro(bigint) from public, anon, authenticated;
grant execute on function public.admin_revoke_school_pro(bigint) to service_role;

-- 7) 団体ライセンス「1ヶ月無料お試し」の自己登録(公開フォーム → 承認なしで即開始) ----
--    運用前提: このフォームのURLは【日本語学校の公式メールアドレス宛てにだけ】配布する。
--    よって管理者の承認は挟まず、送信した瞬間に学校を作成(国も保存)→先生を登録→1ヶ月の
--    お試しライセンスを開始→先生に即Proを付与する。school_applications は「誰がいつ登録したか」の
--    記録(ログ)として残し、管理ダッシュボードに一覧表示する。
--    乱用対策: お試し期限は【学校ごとに1回だけ】開始(最初の登録から1ヶ月)。同じ学校名への再登録は
--    期限を延長せず、先生の追加とPro付与だけ行う(=再送信で無限に延長できない)。
create table if not exists public.school_applications (
  id            bigint generated always as identity primary key,
  country       text,                                           -- 国名
  school_name   text not null,                                  -- 学校名
  teacher_name  text,                                           -- 先生の氏名
  teacher_email text not null,                                  -- アプリで登録したメール(=先生として登録)
  note          text,                                           -- 連絡事項(任意)
  status        text not null default 'active'
                  check (status in ('active','rejected')),
  school_id     bigint references public.schools(id) on delete set null,  -- 作成/紐づけた学校
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz                                     -- 自動承認/手動却下した時刻
);
create index if not exists ix_school_apps_created on public.school_applications (created_at desc);
-- 1先生×1校につき記録は1行(再送信は上書き)。
create unique index if not exists ux_school_apps_email_school
  on public.school_applications (lower(teacher_email), school_id);

-- 直接の読み書きは塞ぐ(service_role=管理ダッシュボードはRLSを迂回+下のGRANTで一覧)。
-- 公開フォームからの登録は SECURITY DEFINER の register_school_trial のみ(匿名でも可)。
alter table public.school_applications enable row level security;
grant select, insert, update, delete on public.school_applications to service_role;

-- 7-1) 公開フォームからの自己登録(匿名でも呼べる)。承認なしで1ヶ月お試しを即開始する。
--      返り値: school_id / お試し期限 until / 新規学校か new_school。
create or replace function public.register_school_trial(
  p_country text, p_school_name text, p_teacher_name text, p_teacher_email text,
  p_note text default null, p_trial_days int default 30)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email      text := lower(trim(coalesce(p_teacher_email, '')));
  v_school     text := trim(coalesce(p_school_name, ''));
  v_country    text := nullif(trim(coalesce(p_country, '')), '');
  v_name       text := nullif(trim(coalesce(p_teacher_name, '')), '');
  v_note       text := nullif(trim(coalesce(p_note, '')), '');
  v_days       int  := greatest(1, coalesce(p_trial_days, 30));
  v_sid        bigint;
  v_until      timestamptz;
  v_new_school boolean := false;
begin
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'メールアドレスの形式が正しくありません。'; end if;
  if v_school = '' then raise exception '学校名を入力してください。'; end if;

  select id, license_until into v_sid, v_until from public.schools where lower(name) = lower(v_school) limit 1;
  if v_sid is null then
    -- 新しい学校 → 今から1ヶ月のお試しを開始。
    v_until := now() + make_interval(days => v_days);
    insert into public.schools (name, country, license_until)
      values (v_school, v_country, v_until)
      returning id into v_sid;
    v_new_school := true;
  else
    -- 既存の学校 → 国名を補完。お試し期限は【既存を尊重=延長しない】。未設定の時だけ開始。
    if v_until is null then v_until := now() + make_interval(days => v_days); end if;
    update public.schools
      set country       = coalesce(v_country, country),
          license_until = greatest(coalesce(license_until, v_until), v_until)
      where id = v_sid;
    select license_until into v_until from public.schools where id = v_sid;
  end if;

  -- 先生を登録(冪等)。
  insert into public.school_members (school_id, email, role)
    values (v_sid, v_email, 'teacher')
    on conflict (school_id, email, role) do nothing;

  -- 先生に即Pro(アカウント未作成なら、本人がアプリ起動時に claim_school_entitlement() で受け取る)。
  perform public._grant_school_pro_by_email(v_email);

  -- 登録ログ(ダッシュボード表示用)。1先生×1校は1行に上書き。
  insert into public.school_applications (country, school_name, teacher_name, teacher_email, note, status, school_id, reviewed_at)
    values (v_country, v_school, v_name, v_email, v_note, 'active', v_sid, now())
  on conflict (lower(teacher_email), school_id) do update
    set country = excluded.country, school_name = excluded.school_name,
        teacher_name = excluded.teacher_name, note = excluded.note,
        status = 'active', created_at = now(), reviewed_at = now();

  return json_build_object('ok', true, 'school_id', v_sid, 'until', v_until, 'new_school', v_new_school);
end;
$$;
revoke all on function public.register_school_trial(text, text, text, text, text, int) from public;
grant execute on function public.register_school_trial(text, text, text, text, text, int) to anon, authenticated;
-- ※ お試しを止めるには管理ダッシュボードの「全員のPro停止」(admin_revoke_school_pro)を使う。

-- ============================================================================
-- 【管理者の使い方】SQL Editor(service_role)で学校と先生を用意する(生徒は先生がサイトで登録)。
--   前提: 先生は事前にアプリ(またはteacher.html)でアカウント登録(ログイン)していること。
--
--   -- 学校を作る(返り値 id を控える)。※ダッシュボードの「学校を作成」でも可。
--   insert into public.schools (name) values ('カトマンズ日本語学校') returning id;
--
--   -- 先生を登録(上で得た id を使う。例では 1)。※ダッシュボードの「先生を追加」でも可。
--   insert into public.school_members (school_id, email, role) values
--     (1, 'teacher@example.com', 'teacher');
--
--   -- 学校ごとの先生数・生徒数
--   select * from public.v_school_counts;
--
--   -- 先生を外す / 学校ごと消す(所属・生徒も連動削除)
--   delete from public.school_members where school_id=1 and email='teacher@example.com' and role='teacher';
--   delete from public.schools where id=1;
--
--   -- (移行)案B最小版でダッシュボードから直接入れた旧・生徒行は teacher_email=NULL のため
--   --   どの先生にも表示されない。必要なら担当の先生へ割り当てる:
--   --   update public.school_members set teacher_email='teacher@example.com'
--   --     where school_id=1 and role='student' and teacher_email is null;
-- ============================================================================

-- ============================================================================
-- 8) 【一元化】会員ステータスの正本(キー=メール) ------------------------------
--    所属表示・Pro(学校由来)を"同じ1関数 member_status()"から導出する。これまで
--    所属=email / 名簿=teacher_email / Pro=user_id と判定キーが3つに割れていて、
--    「所属は出るのにProにならない/名簿に出ない」というズレが起きていた。正本を
--    school_members×schools(キー=メール)に一本化してこれを構造的に無くす。
--    ・user_id に依存しない → 同じメールの別ログイン(Google/Apple/メール登録で
--      user_id が別でも)同じ所属・同じProになる。重複アカウントでズレない。
--    ・返す license_until は生値(null=未有効化 / 過去=失効)。クライアントは
--      「保存値(紹介/管理=entitlements) と license_until の大きい方」を有効Pro期限にする
--      (src/pro/entitlement.ts mergeProUntil)。所属○ ⇔ 同じ行から導いたPro、で必ず一致。
create or replace function public.member_status()
returns json
language sql
security definer
set search_path = public, auth
stable
as $$
  select json_build_object(
    'school_id',     sm.school_id,
    'school_name',   sc.name,
    'role',          sm.role,
    'teacher_email', sm.teacher_email,
    'license_until', sc.license_until   -- 生値(null=未有効化/過去=失効)。学校Proの導出元。
  )
  from public.school_members sm
  join public.schools sc on sc.id = sm.school_id
  where lower(sm.email) = lower(coalesce(auth.email(), ''))
  order by sc.license_until desc nulls last, (sm.role = 'student') desc, sm.school_id
  limit 1;
$$;
revoke all on function public.member_status() from anon;
grant execute on function public.member_status() to authenticated;

-- 8-1) teacher_email 必須化(student行)。所属と名簿がズレる唯一の原因=NULLを禁止。
--      NOT VALID=新規/更新に適用(既存の歴史データでの一括検証はしない=安全)。
--      書込み経路は join_school_by_code / teacher_add_student だけで、両者とも必ず
--      teacher_email を入れる。ダッシュボードからの直挿入(teacher_email無し)はこの制約で弾く。
alter table public.school_members drop constraint if exists student_needs_teacher;
alter table public.school_members
  add constraint student_needs_teacher
  check (role <> 'student' or teacher_email is not null) not valid;

-- 8-2) 既存の teacher_email=NULL の生徒行を、同じ学校の先生(1人に定まる場合のみ)へ割り当てる。
--      これで「所属○/名簿×」の旧行が名簿にも出るようになる。先生が複数いる学校は
--      自動では決められないので手動(上のコメント例)で割り当てる。
update public.school_members s
  set teacher_email = (
    select min(t.email) from public.school_members t
    where t.school_id = s.school_id and t.role = 'teacher')
  where s.role = 'student' and s.teacher_email is null
    and (select count(*) from public.school_members t
         where t.school_id = s.school_id and t.role = 'teacher') = 1;
-- ============================================================================
