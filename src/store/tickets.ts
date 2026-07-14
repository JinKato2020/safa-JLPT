// 模試チケットの純関数(reducerから呼ぶ・副作用なし・入力は不変)。
//  ・保有上限=3枚(月次付与・購入いずれも合わせて最大3)。
//  ・ダウンロード(初回起動)日を起点に30日ごと+1枚。初回起動で歓迎の1枚。
//  ・貝ポイントで購入可(上限3・残高必要)。
import type { AppState } from './state';
import { withUpdatedAt } from './state';
import { walletPoints } from './wallet';

export const MAX_MOCK_TICKETS = 3;
export const MOCK_TICKET_PRICE = 300; // 貝ポイント
const GRANT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30日

export function mockTicketCount(state: AppState): number {
  return Math.max(0, Math.min(MAX_MOCK_TICKETS, state.mockTickets ?? 0));
}

/** 初回起動でインストール日と歓迎チケット(1枚)を確定。既に設定済みなら不変。 */
export function ensureInstall(state: AppState, now: number): AppState {
  if (state.installedAt) return state;
  return { ...state, installedAt: now, mockTickets: state.mockTickets ?? 1, mockGrantsClaimed: 0 };
}

/**
 * 起動時に呼ぶ: 初回確定＋月次付与の適用。
 *  経過月数(=floor((now-installedAt)/30日))と消化済み数の差だけ付与(上限3でカンスト)。
 *  上限で余った付与も「消化済み」に数え、無限バックログを作らない。
 */
export function syncMockTickets(state: AppState, now: number): AppState {
  const s0 = ensureInstall(state, now);
  const installedAt = s0.installedAt ?? now;
  const months = Math.floor((now - installedAt) / GRANT_INTERVAL_MS);
  const claimed = s0.mockGrantsClaimed ?? 0;
  const due = months - claimed;
  if (due <= 0) return s0;
  let tickets = s0.mockTickets ?? 0;
  for (let i = 0; i < due; i++) if (tickets < MAX_MOCK_TICKETS) tickets++;
  return { ...s0, mockTickets: tickets, mockGrantsClaimed: months };
}

/** チケットを1枚消費(模試開始時など)。0枚なら不変。 */
export function spendMockTicket(state: AppState, now: number): AppState {
  const cur = state.mockTickets ?? 0;
  if (cur <= 0) return state;
  return withUpdatedAt({ ...state, mockTickets: cur - 1 }, now);
}

/** 購入可否: 上限未満かつ残高十分。 */
export function canBuyMockTicket(state: AppState, price = MOCK_TICKET_PRICE): boolean {
  return mockTicketCount(state) < MAX_MOCK_TICKETS && walletPoints(state) >= price;
}

/** 貝ポイントで1枚購入(上限3・残高必要)。不可なら不変。 */
export function buyMockTicket(state: AppState, now: number, price = MOCK_TICKET_PRICE): AppState {
  if (!canBuyMockTicket(state, price)) return state;
  return withUpdatedAt(
    { ...state, wallet: { points: walletPoints(state) - price }, mockTickets: (state.mockTickets ?? 0) + 1 },
    now,
  );
}
