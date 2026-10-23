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

-- 地域限定の完全Pro無料キャンペーンを開始（無期限＝active=true・終了日は切らない）。
-- 対象地域: 台湾(TW)・日本(JP)・タイ(TH)・インドネシア(ID)・ベトナム(VN)・韓国(KR)・アメリカ(US)・インド(IN)・イギリス(GB)・シンガポール(SG)。
--   ※イギリスのISO2は 'GB'（'UK'ではない）。端末のregionCode(ISO2)と一致させるため 'GB' で登録。
-- ※日本を含む＝本拠地市場の課金収入を一時停止する判断（ユーザー承認 2026-10-21）。
-- これ以外の国は従来どおり有料のまま。やめたい国は個別に active=false にできる（再ビルド不要）。
insert into public.free_pro_campaigns (region, active, note) values
  ('TW', true, '台湾 完全Pro無料キャンペーン（拡散テスト・将来有料化を周知）'),
  ('JP', true, '日本 完全Pro無料キャンペーン（将来有料化を周知）'),
  ('TH', true, 'タイ 完全Pro無料キャンペーン（将来有料化を周知）'),
  ('ID', true, 'インドネシア 完全Pro無料キャンペーン（将来有料化を周知）'),
  ('VN', true, 'ベトナム 完全Pro無料キャンペーン（将来有料化を周知）'),
  ('KR', true, '韓国 完全Pro無料キャンペーン（将来有料化を周知）'),
  ('US', true, 'アメリカ 完全Pro無料キャンペーン（将来有料化を周知）'),
  ('IN', true, 'インド 完全Pro無料キャンペーン（将来有料化を周知）'),
  ('GB', true, 'イギリス 完全Pro無料キャンペーン（将来有料化を周知。UKのISO2は GB）'),
  ('SG', true, 'シンガポール 完全Pro無料キャンペーン（将来有料化を周知）')
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
--
--   -- 【全世界で無料化】region='ALL' を active=true にすると、端末地域に関わらず全員が対象。
--   --   端末側は activeRegions に 'ALL' が含まれれば地域コード不問でPro（src/pro/campaignMatch.ts）。
--   --   ※ 全世界キャンペーンは大きな決断（既存の有料導線を一時停止する想定）。周知バナーと合わせて実施。
--   insert into public.free_pro_campaigns (region, active, note)
--     values ('ALL', true, '全世界 完全Pro無料キャンペーン（拡散・将来有料化を事前周知）')
--     on conflict (region) do update set active = excluded.active, note = excluded.note, updated_at = now();
--   -- 全世界キャンペーン終了（通常の無料/課金へ戻す）:
--   update public.free_pro_campaigns set active = false, updated_at = now() where region = 'ALL';
-- ----------------------------------------------------------------------------
