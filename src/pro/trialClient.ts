// 無料お試し(7日Pro)の受取をアカウント単位でサーバーに要求する境界(副作用)。
// ・ログイン中のみ呼ぶ。Edge Function 'trial-claim' が「このアカウントの受取日(trial_claimed_at)」を確定/返却。
// ・初回=now を記録して返す / 2回目以降=既存の受取日をそのまま返す(再インストール→再ログインでも再付与しない)。
// ・戻り値=受取日 epoch ms。ここを起点に proStatus が7日間を判定する。失敗/未ログイン/未デプロイは null(安全側=お試しなし)。
import { supabase } from '../config/supabase';
import { getDeviceId } from '../telemetry/deviceId';
import { isTestLab } from '../telemetry/testLab';

export async function claimTrial(): Promise<number | null> {
  try {
    if (isTestLab()) return null; // Test Lab(自動試験)ではお試しを要求しない=device_trialsを汚さない
    // 端末固定IDを添える＝再インストール＋新アカウントでもお試しを取り直せないようサーバーが端末で判定する。
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.functions.invoke('trial-claim', { body: { deviceId } });
    if (error) return null;
    const at = (data as { trial_claimed_at?: string | number })?.trial_claimed_at;
    const ms = typeof at === 'number' ? at : at ? Date.parse(at) : NaN;
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}
