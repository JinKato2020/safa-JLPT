// 「今日あと何回練習できるか」の唯一の判定(純関数・副作用なし)。
// 数え方: 練習画面に入った時に1消費する。
// 対象外(いつでも無制限): 辞書・単語カード閲覧・成績表示・模試(チケット制で独立)。
import type { AppState } from '../store/state';
import { dayStr } from '../store/state';
import { proStatus } from './entitlement';

export const FREE_SESSIONS_PER_DAY = 3; // 無料の1日あたり回数
export const AD_BONUS_PER_DAY_MAX = 2;  // 広告で足せる回数の上限(=1日に見られる本数)

export interface Quota {
  unlimited: boolean;  // Pro
  limit: number;       // 今日の上限(Proは Infinity)
  used: number;        // 今日すでに始めた回数
  left: number;        // 残り(Proは Infinity)
  bonus: number;       // 今日 広告で足した回数
  canPractice: boolean;
  canWatchAd: boolean; // 残り0 かつ 広告枠が残っている(無料のみ true)
}

/** 当日ぶんに正規化。日付が変わっていれば0とみなす(保存は次の書き込み時)。 */
function todayCounts(state: AppState, now: number): { used: number; bonus: number } {
  const q = state.dailyQuota;
  if (!q || q.day !== dayStr(now)) return { used: 0, bonus: 0 };
  return { used: Math.max(0, q.used ?? 0), bonus: Math.max(0, q.bonus ?? 0) };
}

export function quotaFor(state: AppState, now: number): Quota {
  const { used, bonus } = todayCounts(state, now);
  if (proStatus(state, now).isPro) {
    return { unlimited: true, limit: Infinity, used, left: Infinity, bonus, canPractice: true, canWatchAd: false };
  }
  const limit = FREE_SESSIONS_PER_DAY + Math.min(bonus, AD_BONUS_PER_DAY_MAX);
  const left = Math.max(0, limit - used);
  return {
    unlimited: false, limit, used, left, bonus,
    canPractice: left > 0,
    canWatchAd: left === 0 && bonus < AD_BONUS_PER_DAY_MAX,
  };
}

/** 練習を1回始めた。Proなら記録しない(不変)。 */
export function consumeSession(state: AppState, now: number): AppState {
  if (proStatus(state, now).isPro) return state;
  const { used, bonus } = todayCounts(state, now);
  return { ...state, dailyQuota: { day: dayStr(now), used: used + 1, bonus } };
}

/** 広告を最後まで見た報酬: 今日の回数を+1。上限に達していれば不変。 */
export function grantAdBonus(state: AppState, now: number): AppState {
  const { used, bonus } = todayCounts(state, now);
  if (bonus >= AD_BONUS_PER_DAY_MAX) return state;
  return { ...state, dailyQuota: { day: dayStr(now), used, bonus: bonus + 1 } };
}
