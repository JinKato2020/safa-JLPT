// 継続トリガー成立の確定と両者Pro付与。service_role で実行。
// リクエスト: { code, new_user_ref, qualifying_days: string[], install_at }
// 新規側は Authorization(JWT)で本人特定する(付与先の user_id が必要なため)。
//   - コード存在確認 / 自己紹介ブロック / new_user_ref 一意(1新規1報酬)
//   - サーバー側で「14日以内に別々7日」をクライアント値から再計算(自己申告のboolを信用しない)
//   - 成立: 拡散側+新規側の entitlements.pro_until += 7日 / referrals.status='rewarded'
//   - 冪等(同じ new_user_ref が既に rewarded なら何もしない)
// 付与上限は当面チェックしない(reward_grant_count は集計のみ+1)。
// service_role はこの関数のサーバ環境変数からのみ参照(アプリには絶対に置かない)。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DAY = 86400000;
const WINDOW_DAYS = 14; // install_date から +14日
const NEED_DAYS = 7;    // 別々7日
const REWARD_DAYS = 7;  // 付与=+1週間

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// クライアントの trigger.ts と同一ロジックをサーバーで再計算(値は信用せず再判定)。
// install_date を含む日〜+14日の窓内で、適格学習日(YYYY-MM-DD)の distinct 日数 >= 7。
function isTriggerMet(installAtMs: number, qualifyingDays: unknown): boolean {
  if (!Number.isFinite(installAtMs)) return false;
  const startDay = new Date(installAtMs).toISOString().slice(0, 10);
  const endDay = new Date(installAtMs + WINDOW_DAYS * DAY).toISOString().slice(0, 10);
  const days = Array.isArray(qualifyingDays) ? qualifyingDays : [];
  const inWindow = new Set(
    days.filter((d): d is string => typeof d === 'string' && d >= startDay && d <= endDay),
  );
  return inWindow.size >= NEED_DAYS;
}

// pro_until = max(now, pro_until) + REWARD_DAYS。拡散側のみ reward_grant_count を +1。
// 冪等ガードは referrals.new_user_ref(rewarded)側で担保するため、ここは read-modify-write でよい。
async function grantPro(admin: SupabaseClient, userId: string, bumpCount: boolean): Promise<void> {
  const now = new Date();
  const cur = await admin
    .from('entitlements')
    .select('pro_until, reward_grant_count')
    .eq('user_id', userId)
    .maybeSingle();

  const curUntil = cur.data?.pro_until ? new Date(cur.data.pro_until) : null;
  const base = curUntil && curUntil.getTime() > now.getTime() ? curUntil : now;
  const proUntil = new Date(base.getTime() + REWARD_DAYS * DAY).toISOString();
  const count = (cur.data?.reward_grant_count ?? 0) + (bumpCount ? 1 : 0);

  const { error } = await admin
    .from('entitlements')
    .upsert(
      { user_id: userId, pro_until: proUntil, reward_grant_count: count, updated_at: now.toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let payload: { code?: string; new_user_ref?: string; qualifying_days?: unknown; install_at?: string | number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const code = typeof payload.code === 'string' ? payload.code.trim() : '';
  const newUserRef = typeof payload.new_user_ref === 'string' ? payload.new_user_ref.trim() : '';
  const installAtMs = new Date(payload.install_at ?? NaN).getTime();
  if (!code || !newUserRef) return json({ error: 'missing_params' }, 400);

  const admin = createClient(url, serviceRole);

  // 新規側の本人特定(付与先 user_id)。JWT があれば getUser で確定。
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  let newUserId: string | null = null;
  if (jwt) {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: { user } } = await userClient.auth.getUser();
    newUserId = user?.id ?? null;
  }

  // 1) コード存在確認 → 拡散側(owner)を取得。
  const codeRow = await admin
    .from('referral_codes')
    .select('owner_user_id')
    .eq('code', code)
    .maybeSingle();
  const referrerId = codeRow.data?.owner_user_id ?? null;
  if (!referrerId) return json({ status: 'rejected', reason: 'code_not_found' }, 400);

  // 3) 冪等: 既に rewarded なら何もしない(new_user_ref は一意)。
  const prior = await admin
    .from('referrals')
    .select('status')
    .eq('new_user_ref', newUserRef)
    .maybeSingle();
  if (prior.data?.status === 'rewarded') {
    return json({ status: 'rewarded', idempotent: true });
  }

  // 2) 自己紹介ブロック(実装できる範囲: 新規=拡散側 本人 / new_user_ref が owner 自身)。
  //    端末/課金/IP ヒューリスティックはフェーズ2(ここでは本人一致のみ弾く)。
  if (newUserId && newUserId === referrerId) {
    await admin.from('referrals').upsert(
      { code, referrer_user_id: referrerId, new_user_ref: newUserRef, status: 'rejected', install_at: payload.install_at ?? null },
      { onConflict: 'new_user_ref' },
    );
    return json({ status: 'rejected', reason: 'self_referral' }, 403);
  }
  if (newUserRef === referrerId) {
    return json({ status: 'rejected', reason: 'self_referral' }, 403);
  }

  // 4) サーバー側で7日成立を再計算(クライアントの自己申告boolは使わない)。
  const met = isTriggerMet(installAtMs, payload.qualifying_days);
  if (!met) {
    // まだ足りない → pending で記録(後日 再報告で成立し得る。rejected にはしない)。
    await admin.from('referrals').upsert(
      { code, referrer_user_id: referrerId, new_user_ref: newUserRef, status: 'pending', install_at: payload.install_at ?? null },
      { onConflict: 'new_user_ref' },
    );
    return json({ status: 'pending', reason: 'trigger_not_met' });
  }

  // 新規側の付与にはアカウント(uuid)が必要。未ログインなら受取導線で登録を促す(ソフト誘導)。
  // ここでは rewarded にせず pending のまま置き、登録後の再報告で確定させる。
  if (!newUserId) {
    await admin.from('referrals').upsert(
      { code, referrer_user_id: referrerId, new_user_ref: newUserRef, status: 'qualified', install_at: payload.install_at ?? null, qualified_at: new Date().toISOString() },
      { onConflict: 'new_user_ref' },
    );
    return json({ status: 'pending', reason: 'new_user_account_required' });
  }

  // 5) 成立: 両者に +7日。付与を先に行い、成功したら rewarded で確定(冪等ガードは上の prior 判定)。
  try {
    await grantPro(admin, referrerId, true);   // 拡散側 +7日 / reward_grant_count +1
    await grantPro(admin, newUserId, false);    // 新規側 +7日
  } catch (e) {
    return json({ status: 'pending', error: String((e as Error)?.message ?? e) }, 500);
  }

  const { error: refErr } = await admin.from('referrals').upsert(
    {
      code,
      referrer_user_id: referrerId,
      new_user_ref: newUserRef,
      status: 'rewarded',
      install_at: payload.install_at ?? null,
      qualified_at: new Date().toISOString(),
    },
    { onConflict: 'new_user_ref' },
  );
  if (refErr) return json({ status: 'rewarded', warning: refErr.message });

  return json({ status: 'rewarded' });
});
