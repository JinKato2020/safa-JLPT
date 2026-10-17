-- 管理ダッシュボードの体感速度を上げる索引。
-- 目的: v_admin_* ビューは tel_event / tel_mock を anon_id で結合・集計するのに
--       anon_id の索引が無く、テーブル全体をなめていた(=時間とともに遅くなる主因)。
-- 効果: これらの結合/集計が索引参照になり、履歴が増えても速度が保たれる。
-- 安全: いずれも "if not exists"。既存データは変更しない(索引を足すだけ)。
--       Supabase の SQL Editor に貼って1回実行するだけ。CLI不要。ダウンタイムなし(concurrently不要な小規模)。
--
-- 参照元(この索引が効くビュー):
--   v_admin_facet_acc / v_admin_score_dist … tel_event を anon_id で結合
--   v_admin_mock_dist / v_admin_mock_monthly / v_admin_summary … tel_mock を anon_id で集計

create index if not exists tel_event_anon on public.tel_event (anon_id);
create index if not exists tel_mock_anon  on public.tel_mock  (anon_id);

-- 統計情報を更新して、プランナに新しい索引を使わせる。
analyze public.tel_event;
analyze public.tel_mock;
