-- 管理用: メールアドレスでアカウントの開発モード(開発用セクション等)を on/off する(entitlements.dev_tools を書込)。
-- ダッシュボードの「開発モード付与」ボタンが service_role で rpc('admin_grant_dev') を呼ぶ。
-- email→user_id を auth.users で解決 → public.entitlements.dev_tools を upsert。
-- SECURITY DEFINER=所有者権限で auth.users を参照。実行は service_role のみに限定(anon/authenticated からは呼べない)。
-- 反映: 対象アカウントがログイン中にアプリ起動/再起動で SyncProvider が dev_tools を取り込む。
--   ・解禁 = p_on true / 取消 = p_on false。
-- 旧「バージョン7回タップ」の自己解禁は廃止。開発モードの解禁経路はこの管理付与だけ(__DEV__ ビルドは常時解禁)。
create or replace function public.admin_grant_dev(p_email text, p_on boolean)
returns table(user_id uuid, email text, dev_tools boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
-- RETURNS TABLE の出力名(user_id/dev_tools)が entitlements の列名と衝突し、ON CONFLICT (user_id) が
-- 「変数か列か」曖昧(42702)になるのを防ぐ。曖昧な名前は列側に確定させる(出力列名は変えない=DL側 row.user_id 維持)。
#variable_conflict use_column
declare uid uuid;
begin
  select id into uid from auth.users where lower(auth.users.email) = lower(p_email);
  if uid is null then
    raise exception 'no user for email %', p_email;
  end if;
  insert into public.entitlements (user_id, dev_tools)
    values (uid, p_on)
    on conflict (user_id) do update set dev_tools = excluded.dev_tools, updated_at = now();
  return query select uid, p_email, p_on;
end;
$$;

revoke all on function public.admin_grant_dev(text, boolean) from public, anon, authenticated;
grant execute on function public.admin_grant_dev(text, boolean) to service_role;
