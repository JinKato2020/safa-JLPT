// Proかどうかの唯一の判定(純関数・副作用なし)。画面はこの結果だけを見る。
// 優先順位: 開発スイッチ(無料→Pro) → 購入 → 地域キャンペーン → 学校ライセンス(導出) → 期限つき(紹介) → お試し7日 → 無料。
// 通信断でもProが剥がれないよう、購入状態は端末に保存した値を信じる(正本はストアのレシート)。
import type { AppState } from '../store/state';
import { isCampaignProActive } from './campaignFlag';
import { getSchoolLicenseUntil } from './schoolFlag';
import type { Level } from '../engine/engine';
import type { PurchaseAccess } from './levelPurchases';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_DAYS = 7; // 初回起動からのお試し期間

export type ProSource = 'dev' | 'purchase' | 'campaign' | 'school' | 'referral' | 'trial' | 'none';

export interface ProStatus {
  isPro: boolean;
  source: ProSource;
  until?: number;        // 期限つきのときの終了時刻(ms)。dev/purchase では undefined
  trialDaysLeft: number; // お試しの残り日数(切り上げ)。終了後は0
}

/** お試しの終了時刻。起点 trialStartedAt は「ログイン時にサーバーが確定した受取日」由来(アカウント単位)。
 *  未ログイン/未受取(=trialStartedAt無し)なら undefined=お試しなし。
 *  ※ サーバーがアカウント単位で1回だけ発行するため、再インストール→再ログインしても再付与されない(荒稼ぎ防止)。 */
export function trialEndsAt(state: AppState): number | undefined {
  return state.trialStartedAt ? state.trialStartedAt + TRIAL_DAYS * DAY_MS : undefined;
}

export function proStatus(state: AppState, now: number, level: Level = state.settings.level): ProStatus {
  const trialEnd = trialEndsAt(state);
  const trialDaysLeft = trialEnd && trialEnd > now ? Math.ceil((trialEnd - now) / DAY_MS) : 0;
  // 【開発用】無料ユーザーの見え方を確かめるための強制OFF。お試し中でも無料に落とす(devProより優先)
  if (state.settings.devFree) return { isPro: false, source: 'none', trialDaysLeft: 0 };
  if (state.settings.devPro) return { isPro: true, source: 'dev', trialDaysLeft };
  if (state.entitlements?.purchaseActive) return { isPro: true, source: 'purchase', trialDaysLeft };
  if (state.entitlements?.purchaseLevels?.includes(level)) return { isPro: true, source: 'purchase', trialDaysLeft };
  // 地域キャンペーン（例: 台湾の完全Pro無料）。端末ローカル判定（campaignFlag・同期しない）。
  // 課金者より下＝payerには出さない／紹介・お試しより上＝対象地域では一貫して campaign 表示（周知バナー用）。
  if (isCampaignProActive()) return { isPro: true, source: 'campaign', trialDaysLeft };
  // 学校(団体ライセンス)Pro=「導出型」。所属している間だけ member_status.license_until を端末ローカルの
  // ライブフラグ(schoolFlag)に反映している。名簿から外れたら次回同期で null→即PRO終了(pro_until に焼き付けない
  // ＝残骸ゼロ)。課金/キャンペーンより下・紹介/お試しより上(団体ライセンスは有効な権利)。
  const schoolLic = getSchoolLicenseUntil();
  if (schoolLic != null && schoolLic > now) return { isPro: true, source: 'school', until: schoolLic, trialDaysLeft };
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

/** Replace the COMPLETE purchase snapshot: refunds/revocations must remove old level rights. */
export function setPurchaseAccess(state: AppState, access: PurchaseAccess, now: number, ownerId?: string): AppState {
  return { ...state, entitlements: { ...state.entitlements, purchaseActive: access.allLevels,
    purchaseLevels: [...access.levels], purchaseCheckedAt: now, purchaseOwnerId: ownerId } };
}
