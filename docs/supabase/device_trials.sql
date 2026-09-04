-- お試し(7日Pro)の「端末ゲート」用テーブル。Edge Function 'trial-claim' が service_role で読み書きする。
-- 目的: 再インストール＋新アカウントでもお試しを取り直せないようにする(フリーライド防止)。
-- Supabase の SQL Editor に貼って1回実行するだけ。クライアントは触らない(RLSは既定deny=それでよい)。

create table if not exists public.device_trials (
  device_id        text primary key,           -- 端末固定ID(iOS=Keychain UUID / Android=ANDROID_ID)。PIIではない。
  first_claimed_at timestamptz not null,        -- この端末が最初にお試しを受けた日時(=以後の7日判定の起点)
  first_user_id    uuid,                         -- 参考: 最初に受けたアカウント(監査用・FKは張らない=アカウント削除後も履歴保持)
  updated_at       timestamptz not null default now()
);

alter table public.device_trials enable row level security;
-- ポリシーを作らない=anon/authenticated は全拒否。service_role(Edge Function)だけが素通りで読み書きする。

grant select, insert, update on public.device_trials to service_role;

-- 確認用: 端末ごとのお試し初回日
-- select device_id, first_claimed_at, first_user_id from public.device_trials order by first_claimed_at desc;
