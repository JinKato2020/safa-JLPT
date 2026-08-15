-- ============================================================================
-- 運営からのお知らせ(全員一律のブロードキャスト) — Supabase の SQL Editor に貼って実行(CLI不要)。
-- 方針:
--  ・運営(あなた)が1件書くと、全ユーザーの受信箱(ホーム上部の🔔)に同じお知らせが並ぶ。
--  ・未ログインの人にも表示する(誰でも読めるテーブル=select は anon/authenticated に開放)。
--  ・書き込みは service_role だけ(=この SQL Editor / ダッシュボードから)。アプリ内に投稿画面は無い。
--  ・多言語: ja は必須。en/ne は任意(未入力なら ja にフォールバックして表示)。
--  ・既読管理はアプリ側で端末ローカルに持つ(未ログインでも動くように)。サーバーに既読テーブルは作らない。
-- クライアントからの読み方(参考):
--   supabase.from('announcements').select('*').eq('active', true).order('created_at', { ascending:false })
-- ============================================================================

create table if not exists public.announcements (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  active     boolean     not null default true,   -- false にすると全員から即座に消える(取り下げ)
  emoji      text,                                 -- 先頭に出す絵文字(任意。例 '📣' '🎁' '🛠️')
  title_ja   text not null,
  body_ja    text not null,
  title_en   text,
  body_en    text,
  title_ne   text,
  body_ne    text
);

-- 新しい順に引く用のインデックス(active な最新を素早く)。
create index if not exists announcements_active_created_idx on public.announcements (active, created_at desc);

alter table public.announcements enable row level security;

-- 全員(未ログイン含む)が active なお知らせを読める。書き込みポリシーは作らない=service_role 以外は書けない。
drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements
  for select to anon, authenticated
  using (active);

-- RLS を有効にしても、テーブルへの select 権限が無いと 42501 で読めない(RLSは「絞り込み」で「許可」ではない)。
grant select on public.announcements to anon, authenticated;

-- ============================================================================
-- 【お知らせの投稿テンプレート】必要な時にこの1文を編集して実行する。
--   ・ja は必ず入れる。en/ne は空でもよい(その言語のユーザーには ja が出る)。
--   ・取り下げたい時: update public.announcements set active = false where id = <番号>;
-- ============================================================================
-- insert into public.announcements (emoji, title_ja, body_ja, title_en, body_en, title_ne, body_ne) values (
--   '📣',
--   'アップデートのお知らせ', '新しい聴解問題を追加しました。ぜひ挑戦してください。',
--   'What''s new', 'We added new listening questions. Give them a try!',
--   'नयाँ अपडेट', 'हामीले नयाँ श्रवण प्रश्नहरू थप्यौं। प्रयास गर्नुहोस्!'
-- );
