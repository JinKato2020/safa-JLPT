// 模試チケットの純関数(reducerから呼ぶ・副作用なし・入力は不変)。
//  ・模試はProの機能。無料ユーザーは模試ロック=チケットを持たない(常に0)。
//  ・Pro登録日(proSince)を起点に、暦月ごと(同じ日)+1枚。Pro化の直後に歓迎1枚も付与。所持上限なし(貯められる)。
//  ・貝ポイントでの購入は「累計3枚まで」(模試問題の在庫≒半年で約10回に収めるため)。Proのみ購入可。
//  ・配布(歓迎/月次)で増えた枚数は ticketNotice に載せ、ホームで「配布しました」演出を出す(出したら0へ)。
import type { AppState } from './state';
import { withUpdatedAt } from './state';
import { walletPoints } from './wallet';
import { proStatus } from '../pro/entitlement';

export const MAX_MOCK_PURCHASES = 3;    // 貝ポイントで買える累計上限(在庫保護)
export const MOCK_TICKET_PRICE = 300;   // 貝ポイント

export function mockTicketCount(state: AppState): number {
  return Math.max(0, state.mockTickets ?? 0); // 所持上限なし
}

/** 初回起動でインストール日を確定(紹介の起点等で使用)。歓迎チケットは「Pro化した時」に配るので、ここでは配らない。 */
export function ensureInstall(state: AppState, now: number): AppState {
  if (state.installedAt) return state;
  return { ...state, installedAt: now };
}

// proSince(=Pro開始日)から now までの「同じ日基準」の経過月数。
//  例: 1/2 開始 → 2/2 で1か月 / 2/1 はまだ0か月。月末日(1/31→2月)は起算日「日」に達するまで来ない扱い。
function monthsSince(fromMs: number, nowMs: number): number {
  const a = new Date(fromMs), b = new Date(nowMs);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

/**
 * 起動時＋課金同期後に呼ぶ: Pro状態に応じてチケットを整える。
 *  ・無料(非Pro): 模試ロック→所持を0にクリア(残っていた分は消す)・起点/消化もリセット。
 *  ・Pro: 初めてProになった時刻を proSince に確定。歓迎1枚＋暦月ごと+1(所持上限なし)。
 *         付与できた枚数を ticketNotice に載せる(ホームで通知)。
 */
export function syncMockTickets(state: AppState, now: number): AppState {
  const s0 = ensureInstall(state, now);
  const isPro = proStatus(s0, now).isPro;
  if (!isPro) {
    // 非Pro=模試ロック。チケットは持たせない(既存の無料チケットは消す)。既にクリア済みなら不変。
    if ((s0.mockTickets ?? 0) === 0 && s0.proSince == null && (s0.mockGrantsClaimed ?? 0) === 0 && !s0.ticketNotice) return s0;
    return { ...s0, mockTickets: 0, proSince: undefined, mockGrantsClaimed: 0, ticketNotice: 0 };
  }
  // 初めてProになった時=起点(proSince)を確定し、消化カウントも0から数え直す(旧30日方式の値は引き継がない)。
  const firstAnchor = s0.proSince == null;
  const proSince = s0.proSince ?? now;
  const claimed = firstAnchor ? 0 : (s0.mockGrantsClaimed ?? 0);
  const due = (monthsSince(proSince, now) + 1) - claimed;                // 歓迎1 + 暦月ごと1
  if (due <= 0) return firstAnchor ? { ...s0, proSince, mockGrantsClaimed: 0 } : s0;
  return {
    ...s0,
    proSince,
    mockTickets: (s0.mockTickets ?? 0) + due,        // 所持上限なし
    mockGrantsClaimed: claimed + due,
    ticketNotice: (s0.ticketNotice ?? 0) + due,      // ホームで「◯枚配布」演出
  };
}

/** チケット配布の通知を消す(ホームで演出を出した後)。 */
export function clearTicketNotice(state: AppState): AppState {
  if (!state.ticketNotice) return state;
  return { ...state, ticketNotice: 0 };
}

/** チケットを1枚消費(模試開始時など)。0枚なら不変。 */
export function spendMockTicket(state: AppState, now: number): AppState {
  const cur = state.mockTickets ?? 0;
  if (cur <= 0) return state;
  return withUpdatedAt({ ...state, mockTickets: cur - 1 }, now);
}

/** 購入可否: Proかつ累計購入 < 3 かつ残高十分。 */
export function canBuyMockTicket(state: AppState, now: number, price = MOCK_TICKET_PRICE): boolean {
  return proStatus(state, now).isPro
    && (state.mockTicketsPurchased ?? 0) < MAX_MOCK_PURCHASES
    && walletPoints(state) >= price;
}

/** 貝ポイントで1枚購入(Pro・累計3枚まで・残高必要)。不可なら不変。 */
export function buyMockTicket(state: AppState, now: number, price = MOCK_TICKET_PRICE): AppState {
  if (!canBuyMockTicket(state, now, price)) return state;
  return withUpdatedAt(
    {
      ...state,
      wallet: { points: walletPoints(state) - price },
      mockTickets: (state.mockTickets ?? 0) + 1,
      mockTicketsPurchased: (state.mockTicketsPurchased ?? 0) + 1,
    },
    now,
  );
}
