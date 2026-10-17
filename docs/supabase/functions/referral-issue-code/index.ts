// 紹介コード発行。認証必須POST。呼び出しユーザーの referral_codes が無ければ8文字コードを
// 採番して返し、あれば既存を返す(1ユーザー1コード・冪等)。DB書き込みは service_role のみ。
// service_role はこの関数のサーバ環境変数からのみ参照(アプリには絶対に置かない)。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 8文字コードの英字集合。A-Z2-9 から混同しやすい I / O を除外(0/1 は数字側に元々含めない)。
// 32文字ちょうど=256 を割り切るので、byte % 32 に偏り(modulo bias)は出ない。
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode(len = 8): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 認証必須: JWT から呼び出しユーザーを特定。
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceRole);

  // 既存があれば返す(冪等)。
  const existing = await admin
    .from('referral_codes')
    .select('code')
    .eq('owner_user_id', user.id)
    .maybeSingle();
  if (existing.data?.code) return json({ code: existing.data.code });

  // 無ければ採番。code は主キーなので稀な衝突に備えて数回リトライ。
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const ins = await admin
      .from('referral_codes')
      .insert({ code, owner_user_id: user.id })
      .select('code')
      .single();

    if (!ins.error) return json({ code: ins.data.code });

    // 一意制約違反(23505)の切り分け。
    if (ins.error.code === '23505') {
      // owner 一意違反 = 競合(別リクエストが先に採番)→ 既存を読み直して返す。
      if (ins.error.message.includes('owner')) {
        const again = await admin
          .from('referral_codes')
          .select('code')
          .eq('owner_user_id', user.id)
          .maybeSingle();
        if (again.data?.code) return json({ code: again.data.code });
      }
      // code 主キー衝突 = 別文字で再試行(ループ継続)。
      continue;
    }

    // それ以外のDBエラーは即返す。
    return json({ error: ins.error.message }, 500);
  }

  return json({ error: 'code_generation_failed' }, 500);
});
