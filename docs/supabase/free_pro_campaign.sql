-- ============================================================================
-- 地域キャンペーン: 指定した端末地域を「完全Pro無料（広告なし）」にするリモートフラグ。
--   ・判定は端末側（アプリ）が Localization の regionCode とこの表を突き合わせて行う。
--     →「ログイン不要」で即Pro（アカウント作成を求めない＝拡散向け）。
--   ・このテーブルは誰でも読める（anon 可）。書込みは service_role（ダッシュボード/SQL）だけ。
--   ・開始 = 対象 region の active=true。終了 = active=false（再ビルド不要・次回起動で反映）。
--   ・サーバーの付与（entitlements）ではなく“端末で導出”なので、同一アカウントでも
--     台湾端末だけ無料／日本端末は有料、という地域差が正しく出る（クラウド同期で漏れない）。
--   方針メモ: 無期限で開始し「将来有料化・事前通知」をアプリ内で周知。有料化時は
--             active=false にし、同時にストアのProサブスク提供地域へ台湾を戻す。
-- 依存: なし（単独で再実行安全）。
-- ============================================================================

create table if not exists public.free_pro_campaigns (
  region     text primary key,                 -- 端末地域 ISO2（大文字。例 'TW'）
  active     boolean not null default true,     -- true=無料Pro有効 / false=終了（＝通常の無料/課金に戻す）
  note       text,                              -- 管理メモ（任意）
  updated_at timestamptz not null default now()
);

-- 既存DBへの列追加（将来の移行用。無ければ足す）。
alter table public.free_pro_campaigns add column if not exists active     boolean not null default true;
alter table public.free_pro_campaigns add column if not exists note       text;
alter table public.free_pro_campaigns add column if not exists updated_at timestamptz not null default now();

-- 読み取りは全員に開放（未ログインの端末でも地域キャンペーンを判定できるように）。
alter table public.free_pro_campaigns enable row level security;
drop policy if exists fpc_read on public.free_pro_campaigns;
create policy fpc_read on public.free_pro_campaigns for select using (true);

-- anon/authenticated は SELECT のみ。書込みは service_role（RLS 迂回）だけ。
revoke all on public.free_pro_campaigns from anon, authenticated;
grant select on public.free_pro_campaigns to anon, authenticated;
grant select, insert, update, delete on public.free_pro_campaigns to service_role;

-- 台湾の完全Pro無料キャンペーンを開始（無期限＝active=true・終了日は切らない）。
insert into public.free_pro_campaigns (region, active, note)
  values ('TW', true, '台湾 完全Pro無料キャンペーン（拡散テスト・将来有料化を周知）')
  on conflict (region) do update
    set active = excluded.active, note = excluded.note, updated_at = now();

-- ----------------------------------------------------------------------------
-- 運用コマンド（必要時にSQL Editorで実行）
--   -- いま有効な無料地域を確認
--   select region, active, updated_at from public.free_pro_campaigns order by region;
--
--   -- 台湾を「有料化」＝キャンペーン終了（端末は次回起動で通常状態へ）
--   update public.free_pro_campaigns set active = false, updated_at = now() where region = 'TW';
--
--   -- 別地域も同じ仕組みで追加可能（例: 香港）
--   insert into public.free_pro_campaigns (region, active, note)
--     values ('HK', true, '香港 無料キャンペーン') on conflict (region) do nothing;
-- ----------------------------------------------------------------------------
