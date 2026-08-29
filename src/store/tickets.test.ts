import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, type AppState } from './state';
import { syncMockTickets, ensureInstall, buyMockTicket, spendMockTicket, mockTicketCount, canBuyMockTicket, MAX_MOCK_PURCHASES, MOCK_TICKET_PRICE } from './tickets';

const base = (over: Partial<AppState> = {}): AppState => ({ ...INITIAL_STATE, ...over });
// Pro(devProで強制Pro)。settings は最後に devPro:true を上書きして確実にProにする。
const pro = (over: Partial<AppState> = {}): AppState => ({
  ...INITIAL_STATE, ...over,
  settings: { ...INITIAL_STATE.settings, ...(over.settings ?? {}), devPro: true },
});
// 暦月テスト用: 正午UTCで作り、実行環境のタイムゾーンでも日付がずれないようにする。
const ymd = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 12, 0, 0);

test('ensureInstall: インストール日を確定(歓迎チケットはここでは配らない=無料は0)', () => {
  const t0 = ymd(2026, 1, 2);
  const s = ensureInstall(base(), t0);
  assert.equal(s.installedAt, t0);
  assert.equal(mockTicketCount(s), 0);           // 無料=模試ロック=0
  assert.equal(ensureInstall(s, t0 + 999).installedAt, t0); // 確定済みは不変
});

test('syncMockTickets: 非Proは常に0(既存チケットもクリア・起点もリセット)', () => {
  const t0 = ymd(2026, 1, 2);
  const s = syncMockTickets(base({ mockTickets: 5, proSince: t0, mockGrantsClaimed: 1 }), t0);
  assert.equal(mockTicketCount(s), 0);
  assert.equal(s.proSince, undefined);
});

test('syncMockTickets: Proは登録日起点で歓迎1枚＋暦月ごと+1(所持上限なし)', () => {
  const t0 = ymd(2026, 1, 2);
  let s = syncMockTickets(pro(), t0);            // Pro化直後=歓迎1
  assert.equal(mockTicketCount(s), 1);
  assert.equal(s.proSince, t0);
  s = syncMockTickets(s, ymd(2026, 2, 2));       // 翌月2日 => +1 => 2
  assert.equal(mockTicketCount(s), 2);
  s = syncMockTickets(s, ymd(2026, 2, 20));      // 同月内(起点日以降)は増えない
  assert.equal(mockTicketCount(s), 2);
  s = syncMockTickets(s, ymd(2026, 6, 2));       // 5か月後 => 合計6
  assert.equal(mockTicketCount(s), 6);
  s = syncMockTickets(s, ymd(2027, 1, 2));       // 12か月後 => 合計13(上限なし)
  assert.equal(mockTicketCount(s), 13);
});

test('syncMockTickets: 配布枚数は ticketNotice に載り、消費してもバックログは溜めない', () => {
  const t0 = ymd(2026, 1, 2);
  let s = syncMockTickets(pro(), t0);
  assert.equal(s.ticketNotice, 1);               // 歓迎1枚ぶんを通知
  s = spendMockTicket(s, t0 + 1);                // 使う => 0
  assert.equal(mockTicketCount(s), 0);
  s = syncMockTickets(s, ymd(2026, 2, 2));       // 2月2日 => +1(1回ぶんだけ) => 1
  assert.equal(mockTicketCount(s), 1);
});

test('buyMockTicket: Proのみ・累計3枚まで・残高必要', () => {
  const t0 = ymd(2026, 1, 2);
  let s = pro({ mockTickets: 0, mockTicketsPurchased: 0, wallet: { points: MOCK_TICKET_PRICE * 5 } });
  assert.equal(canBuyMockTicket(s, t0), true);
  s = buyMockTicket(s, t0); assert.equal(mockTicketCount(s), 1);
  s = buyMockTicket(s, t0); s = buyMockTicket(s, t0);        // 累計3
  assert.equal(s.mockTicketsPurchased, MAX_MOCK_PURCHASES);
  assert.equal(canBuyMockTicket(s, t0), false);              // 4枚目は不可(累計上限)
  assert.equal(mockTicketCount(buyMockTicket(s, t0)), 3);
  // 非Proは買えない / 残高不足も不可
  assert.equal(canBuyMockTicket(base({ mockTicketsPurchased: 0, wallet: { points: 9999 } }), t0), false);
  assert.equal(canBuyMockTicket(pro({ mockTicketsPurchased: 0, wallet: { points: 10 } }), t0), false);
});

test('spendMockTicket: 0枚では減らない', () => {
  assert.equal(mockTicketCount(spendMockTicket(base({ mockTickets: 0 }), 1)), 0);
});
