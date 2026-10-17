-- 管理用: メールアドレスでアカウントを恒久/期限つきProにする(entitlements.pro_until を書込)。
-- ダッシュボードの「Pro付与」ボタンが service_role で rpc('admin_grant_pro') を呼ぶ。
-- email→user_id を auth.users で解決 → public.entitlements.pro_until を upsert。
-- SECURITY DEFINER=所有者権限で auth.users を参照。実行は service_role のみに限定(anon/authenticated からは呼べない)。
-- 反映: 対象アカウントがログイン中にアプリ起動/再起動で SyncProvider が pro_until を取り込む(課金=RevenueCatとは別系統)。
--   ・恒久 = timestamptz '2999-12-31 00:00:00+00'
--   ・期限つき = now() + interval 'N days'
--   ・失効 = 過去日時(now() - interval '1 day')。null ではなく過去日時にする(クライアントは null を「未取得」として無視)。
create or replace function public.admin_grant_pro(p_email text, p_until timestamptz)
returns table(user_id uuid, email text, pro_until timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
-- RETURNS TABLE の出力名(user_id/pro_until)が entitlements の列名と衝突し、ON CONFLICT (user_id) が
-- 「変数か列か」曖昧(42702)になるのを防ぐ。曖昧な名前は列側に確定させる(出力列名は変えない=DL側 row.user_id 維持)。
#variable_conflict use_column
declare uid uuid;
begin
  select id into uid from auth.users where lower(auth.users.email) = lower(p_email);
  if uid is null then
    raise exception 'no user for email %', p_email;
  end if;
  insert into public.entitlements (user_id, pro_until)
    values (uid, p_until)
    on conflict (user_id) do update set pro_until = excluded.pro_until, updated_at = now();
  return query select uid, p_email, p_until;
end;
$$;

revoke all on function public.admin_grant_pro(text, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_grant_pro(text, timestamptz) to service_role;
