-- ============================================================================
-- 教師専用サイト用: 学校グループ + 教師ビュー(案B 最小版)
--   目的  : 日本語学校の先生が「自校の生徒だけ」の学習状況/成長を閲覧できる。
--   方針  : (パイロット) 管理者が SQL Editor でメールを指定し、先生・生徒を学校に所属させる。
--           先生はそのメールでログインすると、自校の生徒だけが見える。
--   安全性: 生徒の学習データは v_admin_devices(service_roleのみ) に入っている。これを
--           直接公開せず、auth.email() で「ログイン中の先生の学校」に絞った専用ビュー
--           v_teacher_students 経由でのみ authenticated に見せる。
--           生徒や無関係なログイン者が開いても、教師でなければ 0 件しか返らない。
--
--   ⚠️ 依存注意: このビューは public.v_admin_devices を参照する。dashboard_views.sql は
--      先頭で `drop view v_admin_devices cascade` を行うため、dashboard_views.sql を
--      再実行したら、この school_teacher.sql も必ず再実行すること(cascadeで一緒に消える)。
-- ============================================================================

-- 1) 学校 ---------------------------------------------------------------------
create table if not exists public.schools (
  id         bigint generated always as identity primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

-- 2) 所属(メールで指定) role: 'teacher'(閲覧できる) / 'student'(見られる対象) --------
create table if not exists public.school_members (
  school_id  bigint not null references public.schools(id) on delete cascade,
  email      text   not null,
  role       text   not null check (role in ('teacher','student')),
  created_at timestamptz not null default now(),
  primary key (school_id, email, role)
);
create index if not exists ix_school_members_email on public.school_members (lower(email));

-- 直接APIから触れないように(管理はSQL Editor/管理ダッシュボード=service_roleのみ)。
-- ポリシー無し=anon/authenticatedは直接select/insert不可。所有者/service_roleはRLSを迂回。
alter table public.schools        enable row level security;
alter table public.school_members enable row level security;

-- 管理ダッシュボード(dashboard.html)は service_role で学校/所属をCRUDする。
-- RLSを迂回できても「テーブルへのGRANT」が別途必要(無いと 42501 permission denied)。
grant select, insert, update, delete on public.schools        to service_role;
grant select, insert, update, delete on public.school_members to service_role;

-- 3) 教師専用ビュー -----------------------------------------------------------
--    security_invoker=false(所有者権限)で v_admin_devices を読み、
--    WHERE を auth.email()(JWT由来=クライアント改ざん不可)で自校の生徒に限定。
drop view if exists public.v_teacher_students cascade;
create view public.v_teacher_students
with (security_invoker = false) as
select
  sm.school_id,
  sc.name                                    as school_name,
  d.email,
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
from public.v_admin_devices d
join public.school_members sm
     on sm.role = 'student'
    and lower(sm.email) = lower(d.email)
join public.schools sc on sc.id = sm.school_id
where d.is_latest                            -- 1生徒=今使っているレベルの1行
  and d.account_id is not null               -- ログイン済み(メールあり)のみ
  and sm.school_id in (
    select school_id from public.school_members
    where role = 'teacher'
      and lower(email) = lower(coalesce(auth.email(), ''))
  );

revoke all on public.v_teacher_students from anon;
grant select on public.v_teacher_students to authenticated;

-- ============================================================================
-- 【管理者の使い方】SQL Editor(service_role)で実行。メールは実物に置換。
--   前提: 生徒・先生は事前にアカウント登録(ログイン)していること。
--         先生アカウントは Supabase → Authentication → Add user で作って auto-confirm しても良い。
--
--   -- 学校を作る(返り値 id を控える)
--   insert into public.schools (name) values ('カトマンズ日本語学校') returning id;
--
--   -- 先生・生徒を登録(上で得た id を使う。例では 1)
--   insert into public.school_members (school_id, email, role) values
--     (1, 'teacher@example.com',  'teacher'),
--     (1, 'student1@example.com', 'student'),
--     (1, 'student2@example.com', 'student');
--
--   -- 所属の確認
--   select sc.name, sm.role, sm.email
--   from public.school_members sm join public.schools sc on sc.id = sm.school_id
--   order by sc.name, sm.role, sm.email;
--
--   -- 生徒を外す / 学校ごと消す
--   delete from public.school_members where school_id=1 and email='student2@example.com';
--   delete from public.schools where id=1;   -- 所属も連動削除(on delete cascade)
-- ============================================================================
