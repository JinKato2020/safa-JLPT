// 「同時ログインは1台だけ」の端末セッション境界(副作用)。Supabase の active_sessions RPC を叩く薄い層。
//  ・claim   : ログイン確立時に枠を取りに行く。取れれば {ok:true}、別端末が使用中なら {ok:false, activeLabel}。
//  ・heartbeat: ログイン中60秒ごと。枠を奪われていたら {revoked:true}（=この端末はログアウトすべき）。
//  ・release : ログアウト時に自分の枠を解放（即・次の端末が入れる）。※認証が切れる前に呼ぶこと。
// 【安全側=fail-open】端末IDが取れない/RPC未デプロイ/通信失敗のときはブロックしない（従来どおり使える）。
//  → active_sessions.sql を Supabase に適用するまでは、この機能は実質OFFで既存挙動を壊さない。
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { getDeviceId } from '../telemetry/deviceId';

export type ClaimResult = { ok: true } | { ok: false; activeLabel: string | null };

function deviceLabel(): string {
  return Platform.OS === 'ios' ? 'iPhone / iPad' : Platform.OS === 'android' ? 'Android' : 'PC';
}

/** ログイン確立時に枠を取る。取れれば {ok:true}。別端末が使用中なら {ok:false, activeLabel}。失敗時は安全側で {ok:true}。 */
export async function claimDeviceSession(): Promise<ClaimResult> {
  try {
    const deviceId = await getDeviceId();
    if (!deviceId) return { ok: true }; // 端末IDが取れない=締め出さない(安全側)
    const { data, error } = await supabase.rpc('claim_active_session', { p_device_id: deviceId, p_label: deviceLabel() });
    if (error) return { ok: true }; // RPC未デプロイ/失敗=ブロックしない
    const row = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; active_label?: string | null } | undefined;
    if (row && row.ok === false) return { ok: false, activeLabel: row.active_label ?? null };
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/** ログイン中の心拍。枠を奪われていたら {revoked:true}。失敗時は {revoked:false}（誤ログアウトを避ける安全側）。 */
export async function heartbeatDeviceSession(): Promise<{ revoked: boolean }> {
  try {
    const deviceId = await getDeviceId();
    if (!deviceId) return { revoked: false };
    const { data, error } = await supabase.rpc('touch_active_session', { p_device_id: deviceId });
    if (error) return { revoked: false };
    const row = (Array.isArray(data) ? data[0] : data) as { revoked?: boolean } | undefined;
    return { revoked: row?.revoked === true };
  } catch {
    return { revoked: false };
  }
}

/** ログアウト時に自分の枠を解放。認証が切れる前(signOut の前)に呼ぶこと。 */
export async function releaseDeviceSession(): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    if (!deviceId) return;
    await supabase.rpc('release_active_session', { p_device_id: deviceId });
  } catch {
    /* noop */
  }
}
