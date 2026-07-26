// Proかどうかの唯一の判定(純関数・副作用なし)。画面はこの結果だけを見る。
// 優先順位: 開発スイッチ(無料→Pro) → 購入(レシート同期のキャッシュ) → 期限つき(紹介) → お試し7日 → 無料。
// 通信断でもProが剥がれないよう、購入状態は端末に保存した値を信じる(正本はストアのレシート)。
import type { AppState } from '../store/state';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_DAYS = 7; // 初回起動からのお試し期間

export type ProSource = 'dev' | 'purchase' | 'referral' | 'trial' | 'none';

export interface ProStatus {
  isPro: boolean;
  source: ProSource;
  until?: number;        // 期限つきのときの終了時刻(ms)。dev/purchase では undefined
  trialDaysLeft: number; // お試しの残り日数(切り上げ)。終了後は0
}

/** お試しの終了時刻。installedAt 未確定(旧データ)なら undefined。 */
export function trialEndsAt(state: AppState): number | undefined {
  return state.installedAt ? state.installedAt + TRIAL_DAYS * DAY_MS : undefined;
}

export function proStatus(state: AppState, now: number): ProStatus {
  const trialEnd = trialEndsAt(state);
  const trialDaysLeft = trialEnd && trialEnd > now ? Math.ceil((trialEnd - now) / DAY_MS) : 0;
  // 【開発用】無料ユーザーの見え方を確かめるための強制OFF。お試し中でも無料に落とす(devProより優先)
  if (state.settings.devFree) return { isPro: false, source: 'none', trialDaysLeft: 0 };
  if (state.settings.devPro) return { isPro: true, source: 'dev', trialDaysLeft };
  if (state.entitlements?.purchaseActive) return { isPro: true, source: 'purchase', trialDaysLeft };
  const until = state.entitlements?.proUntil ?? 0;
  if (until > now) return { isPro: true, source: 'referral', until, trialDaysLeft };
  if (trialEnd && trialEnd > now) return { isPro: true, source: 'trial', until: trialEnd, trialDaysLeft };
  return { isPro: false, source: 'none', trialDaysLeft: 0 };
}

/** 紹介などで days 日ぶん延長。お試し中なら「お試し終了日」から積む(期間を二重取りさせない)。 */
export function grantProDays(state: AppState, days: number, now: number): AppState {
  const from = Math.max(state.entitlements?.proUntil ?? 0, trialEndsAt(state) ?? 0, now);
  return { ...state, entitlements: { ...state.entitlements, proUntil: from + days * DAY_MS } };
}

/** RevenueCat の同期結果を反映(Phase 1 で呼ぶ)。通信できない時はこの値が残る。 */
export function setPurchaseActive(state: AppState, active: boolean, now: number): AppState {
  return { ...state, entitlements: { ...state.entitlements, purchaseActive: active, purchaseCheckedAt: now } };
}
