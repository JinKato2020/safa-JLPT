// 接続国(IP由来)を記録する。Cloudflare(=Supabaseの前段)が付けるヘッダ cf-ipcountry から国コードだけ取り出し、
// user_geo に本人ぶん upsert する。IPアドレスは保存しない/外部の地理サービスも使わない。
// 呼び出し: アプリのログイン確立時に supabase.functions.invoke('geo-country')(Authorization=JWT 必須)。
// service_role はこの関数のサーバ環境変数からのみ参照(アプリには絶対に置かない)。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 本人特定(書き込み先 user_id)。JWT 必須。
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  if (!jwt) return json({ error: 'auth_required' }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'auth_required' }, 401);

  // Cloudflare が付ける国ヘッダ。'XX'(不明)/'T1'(Tor) は国として扱わない。IPは読まない/保存しない。
  const raw = req.headers.get('cf-ipcountry') ?? req.headers.get('x-country') ?? '';
  const cc = /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
  if (!cc || cc === 'XX' || cc === 'T1') return json({ country: null, reason: 'no_country_header' });

  const admin = createClient(url, serviceRole);
  const { error } = await admin.from('user_geo').upsert(
    { user_id: user.id, country: cc, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (error) return json({ country: cc, warning: error.message });
  return json({ country: cc });
});
