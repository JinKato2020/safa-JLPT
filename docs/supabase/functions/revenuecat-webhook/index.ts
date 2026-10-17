// RevenueCat の課金イベント(Webhook)を受けて、有料サブスク(1月/1年Pro)の状態を entitlements へ保存する。
// これで管理ダッシュボードに「どのアカウントがどの課金ユーザーか」を出せる(RevenueCat管理画面と同じ情報を自前DBにも持つ)。
//
// ■ 認証: RevenueCat の Webhook 設定で決めた固定文字列を Authorization ヘッダで送ってくる。
//         それを環境変数 RC_WEBHOOK_AUTH と一致比較する(合わなければ 401)。JWT ではないので
//         このEFは verify_jwt=false でデプロイすること(下の README 手順参照)。
// ■ 書き込み: service_role でDBを更新(RLS素通り)。触るのは新設の pro_* 列だけ。
//   ・pro_until(紹介/お試し)や trial_claimed_at には一切触れない=既存の付与ロジックと独立。
// ■ 冪等: 同じイベントを2回受けても結果は同じ(期限を上書きするだけ)。RevenueCat は 2xx 以外だと再送する。
// ■ app_user_id: アプリはログイン時 Purchases.logIn(userId) で実アカウントIDを使う(App.tsx:307)。
//   匿名ID($RCAnonymousID:...)やUUIDでないIDは「アカウント未ログインの購入」なので保存せず 200 で無視。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 商品IDから「1月Pro/1年Pro」を推定(店の商品IDは自由文字列なので語で判定)。不明なら null=ダッシュボードは商品IDをそのまま表示。
function planOf(productId: string | null | undefined): string | null {
  const p = (productId ?? '').toLowerCase();
  if (/year|annual|yr|12\s*month|1y|年/.test(p)) return 'yearly';
  if (/month|mo\b|1m|30\s*day|月/.test(p)) return 'monthly';
  return null;
}

// イベント種別ごとに「自動更新が続く見込みか」。期限(expiration_at_ms)自体は全イベントでそのまま保存する。
function willRenewOf(type: string): boolean {
  switch (type) {
    case 'CANCELLATION':          // 自動更新OFF(だが期限までは有効)
    case 'EXPIRATION':            // 失効
    case 'BILLING_ISSUE':         // 支払い失敗(猶予)
    case 'SUBSCRIPTION_PAUSED':   // 一時停止
    case 'NON_RENEWING_PURCHASE': // 買い切り(更新なし)
      return false;
    default:                      // INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE / UNCANCELLATION など
      return true;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // 認証(RevenueCat が送る固定 Authorization 文字列)。
  const expected = Deno.env.get('RC_WEBHOOK_AUTH') ?? '';
  const got = req.headers.get('Authorization') ?? '';
  if (!expected || got !== expected) return json({ error: 'unauthorized' }, 401);

  let payload: { event?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const ev = payload?.event ?? {};
  const type = String(ev['type'] ?? '');
  if (!type) return json({ ok: true, skipped: 'no event type' });

  // 送金(TRANSFER)は app_user_id 単一でないので今は無視(必要になれば transferred_to を処理)。
  if (type === 'TRANSFER') return json({ ok: true, skipped: 'transfer' });

  const appUserId = String(ev['app_user_id'] ?? '');
  // 未ログイン購入(匿名ID)やUUIDでないIDは、どのアカウントか特定できない=保存しない(200で正常応答)。
  if (!UUID_RE.test(appUserId)) return json({ ok: true, skipped: 'anonymous or non-account user' });

  const productId = (ev['product_id'] as string | undefined) ?? null;
  const expMs = Number(ev['expiration_at_ms'] ?? 0);
  const proStoreUntil = expMs > 0 ? new Date(expMs).toISOString() : null;
  const nowIso = new Date().toISOString();

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceRole);

  // 新設 pro_* 列だけを upsert(既存の pro_until / trial_claimed_at は指定しない=保持)。
  const { error } = await admin.from('entitlements').upsert(
    {
      user_id: appUserId,
      pro_plan: planOf(productId),
      pro_product_id: productId,
      pro_store_until: proStoreUntil,
      pro_will_renew: willRenewOf(type),
      pro_store_event: type,
      pro_store_updated_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    // FK違反(23503)=そのuser_idが auth.users に居ない=テストイベントや未登録ユーザーの購入。
    // DBには保存できないが、200で受け流してRevenueCatの無限リトライを防ぐ(本物のログイン済み購入は通る)。
    if ((error as { code?: string }).code === '23503') {
      return json({ ok: true, skipped: 'unknown account (fk)', user_id: appUserId });
    }
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, user_id: appUserId, event: type, plan: planOf(productId), until: proStoreUntil });
});
