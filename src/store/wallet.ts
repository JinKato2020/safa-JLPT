// 桜貝(内部通貨)の付与・購入・装備の純関数。reducerから呼ぶ。副作用なし・入力は不変。
import type { AppState } from './state';
import { dayStr, withUpdatedAt } from './state';

// 装備スロット/種別: 着せ替え(髪型/服/筆)・仲間(companion)・道具(tool)。背景テーマ・フォントは設定画面へ移設。
export type ShopKind = 'hair' | 'outfit' | 'brush' | 'companion' | 'tool';

export const EARN = {
  answer: 2, dailyCap: 300, completion: 15, mock: 50, kanjiMaster: 5,
  dailyFirst: 10, streak7: 50, streak30: 200,
  tierUp: 100, passMilestone: 150, learnedPer100: 30,
} as const;

export function walletPoints(state: AppState): number { return state.wallet?.points ?? 0; }

export function addPoints(state: AppState, amount: number, now: number, opts?: { cap?: boolean }): AppState {
  const amt = Math.max(0, Math.floor(amount || 0));
  if (amt === 0) return state;
  let add = amt;
  let dailyEarn = state.dailyEarn;
  if (opts?.cap) {
    const day = dayStr(now);
    const cur = dailyEarn && dailyEarn.day === day ? dailyEarn.amount : 0;
    add = Math.max(0, Math.min(amt, EARN.dailyCap - cur));
    dailyEarn = { day, amount: cur + add };
    if (add === 0) return { ...state, dailyEarn };
  }
  return { ...state, wallet: { points: walletPoints(state) + add }, ...(opts?.cap ? { dailyEarn } : {}) };
}

export function awardOnce(state: AppState, key: string, amount: number): AppState {
  const claimed = state.claimedMilestones ?? [];
  if (claimed.includes(key)) return state;
  const s = addPoints(state, amount, 0); // 節目は上限対象外
  return { ...s, claimedMilestones: [...claimed, key] };
}

export function isOwned(state: AppState, id: string): boolean { return (state.owned ?? []).includes(id); }
export function isEquipped(state: AppState, item: { id: string; kind: ShopKind }): boolean { return state.equipped?.[item.kind] === item.id; }
export function canBuy(state: AppState, item: { id: string; price: number }): boolean {
  return walletPoints(state) >= item.price && !isOwned(state, item.id);
}
export function buy(state: AppState, item: { id: string; price: number }, now: number): AppState {
  if (!canBuy(state, item)) return state;
  return withUpdatedAt({ ...state, wallet: { points: walletPoints(state) - item.price }, owned: [...(state.owned ?? []), item.id] }, now);
}
export function equip(state: AppState, item: { id: string; kind: ShopKind }): AppState {
  if (!isOwned(state, item.id)) return state;
  return { ...state, equipped: { ...(state.equipped ?? {}), [item.kind]: item.id } };
}
