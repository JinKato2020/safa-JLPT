// 無料お試し(7日Pro)の受取をアカウント単位で1回だけ確定する。認証必須POST。
// ・JWT から本人(user_id)を特定 → entitlements.trial_claimed_at を service_role で確認。
// ・未受取(null)なら now を記録して返す。既受取なら既存の受取日をそのまま返す(再付与しない)。
//   → アプリはこの受取日を起点に7日間だけ Pro 表示する(entitlement.ts の trialEndsAt)。
// ・冪等: 再インストール→同じアカウントで再ログインしても、受取日は変わらない=お試しは復活しない。
// ・pro_until には触れない(お試しは trial_claimed_at 起点で判定。紹介の pro_until とは独立)。
// service_role はこの関数のサーバ環境変数からのみ参照(アプリには絶対に置かない)。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 本人特定(付与先 user_id)。JWT 必須。
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceRole);

  // 既受取なら既存の受取日を返す(再付与しない)。
  const cur = await admin.from('entitlements').select('trial_claimed_at').eq('user_id', user.id).maybeSingle();
  let claimedAt = cur.data?.trial_claimed_at ?? null;

  if (!claimedAt) {
    // 初回=now を記録。upsert は指定列だけ更新するので pro_until 等は保持される。
    claimedAt = new Date().toISOString();
    const { error } = await admin.from('entitlements').upsert(
      { user_id: user.id, trial_claimed_at: claimedAt, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (error) return json({ error: error.message }, 500);
  }

  return json({ trial_claimed_at: claimedAt });
});
