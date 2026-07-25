// アカウント完全削除(認証ユーザー削除)。認証済みJWTを受け、service_roleで auth.admin.deleteUser。
// user_state 行は auth.users への FK cascade で自動削除される(明示 delete も行い二重に担保)。
// service_role はこの関数のサーバ環境変数からのみ参照(アプリには絶対に置かない)。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  const admin = createClient(url, serviceRole);
  await admin.from('user_state').delete().eq('user_id', user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
