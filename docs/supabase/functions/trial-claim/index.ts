// 無料お試し(7日Pro)の受取を「アカウント＋端末」の二重ゲートで1回だけ確定する。認証必須POST。
// ・JWT から本人(user_id)を特定 → entitlements.trial_claimed_at を service_role で確認。
// ・アカウントが既受取なら既存の受取日をそのまま返す(再付与しない)。
// ・未受取でも、body.deviceId(端末固定ID)が device_trials に既にあれば＝この端末は過去にお試し済み
//   → その初回日を受取日として記録(=もう7日は過ぎている扱い＝新規お試しは付かない)。
//   これで「再インストール＋新アカウント」でのお試し荒稼ぎ(フリーライド)を防ぐ。
// ・初回(アカウントも端末も未使用)のみ now を記録し、device_trials にも端末を刻む。
//   → アプリはこの受取日を起点に7日間だけ Pro 表示する(entitlement.ts の trialEndsAt)。
// ・pro_until には触れない(お試しは trial_claimed_at 起点で判定。紹介の pro_until とは独立)。
// ・deviceId が取れない端末(古いOS等)はアカウント単位ゲートのみ(従来動作)にフォールバック。
// service_role はこの関数のサーバ環境変数からのみ参照(アプリには絶対に置かない)。
// ※ 事前に device_trials テーブルが必要(docs/supabase/device_trials.sql を1回実行)。
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

  // 端末固定ID(任意)。再インストール＋新アカウントでのお試し再取得を防ぐ端末ゲートに使う。
  let deviceId: string | null = null;
  try { const body = await req.json(); if (body && typeof body.deviceId === 'string') deviceId = body.deviceId.slice(0, 128); } catch { /* body無し=端末ゲートなし */ }

  // ① アカウントが既受取なら、その受取日をそのまま返す(再付与しない)。
  const cur = await admin.from('entitlements').select('trial_claimed_at').eq('user_id', user.id).maybeSingle();
  let claimedAt = cur.data?.trial_claimed_at ?? null;
  if (claimedAt) return json({ trial_claimed_at: claimedAt });

  const now = new Date().toISOString();

  // ② 端末が過去にお試し済みか(別アカウントでも)。あればその初回日を採用=新規7日は付かない。
  let deviceFirst: string | null = null;
  if (deviceId) {
    const dv = await admin.from('device_trials').select('first_claimed_at').eq('device_id', deviceId).maybeSingle();
    deviceFirst = dv.data?.first_claimed_at ?? null;
  }
  claimedAt = deviceFirst ?? now;

  // ③ アカウントに受取日を記録(初回=now / 端末既使用=その初回日)。
  const upAcc = await admin.from('entitlements').upsert(
    { user_id: user.id, trial_claimed_at: claimedAt, updated_at: now },
    { onConflict: 'user_id' },
  );
  if (upAcc.error) return json({ error: upAcc.error.message }, 500);

  // ④ 端末を初めて使う時だけ device_trials に刻む(以後この端末はお試し済み)。
  if (deviceId && !deviceFirst) {
    await admin.from('device_trials').upsert(
      { device_id: deviceId, first_claimed_at: now, first_user_id: user.id, updated_at: now },
      { onConflict: 'device_id' },
    );
  }

  return json({ trial_claimed_at: claimedAt });
});
