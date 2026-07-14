import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, type AppState } from './state';
import { syncMockTickets, ensureInstall, buyMockTicket, spendMockTicket, mockTicketCount, canBuyMockTicket, MAX_MOCK_TICKETS, MOCK_TICKET_PRICE } from './tickets';

const DAY = 24 * 60 * 60 * 1000;
const base = (over: Partial<AppState> = {}): AppState => ({ ...INITIAL_STATE, ...over });

test('ensureInstall: 初回でインストール日と歓迎1枚を確定', () => {
  const t0 = 1_000_000_000_000;
  const s = ensureInstall(base(), t0);
  assert.equal(s.installedAt, t0);
  assert.equal(mockTicketCount(s), 1);
  // 既に確定済みなら不変
  const s2 = ensureInstall(s, t0 + 999);
  assert.equal(s2.installedAt, t0);
  assert.equal(mockTicketCount(s2), 1);
});

test('syncMockTickets: 30日ごと+1、上限3でカンスト', () => {
  const t0 = 1_000_000_000_000;
  let s = syncMockTickets(base(), t0);        // 初回=1
  assert.equal(mockTicketCount(s), 1);
  s = syncMockTickets(s, t0 + 30 * DAY);      // +1 => 2
  assert.equal(mockTicketCount(s), 2);
  s = syncMockTickets(s, t0 + 60 * DAY);      // +1 => 3
  assert.equal(mockTicketCount(s), 3);
  s = syncMockTickets(s, t0 + 200 * DAY);     // 上限3
  assert.equal(mockTicketCount(s), 3);
});

test('syncMockTickets: 上限中に消費すると次の月次でまた増える(バックログを溜めない)', () => {
  const t0 = 1_000_000_000_000;
  let s = syncMockTickets(base(), t0);
  s = syncMockTickets(s, t0 + 90 * DAY);      // 3(カンスト・grantsは3消化済)
  assert.equal(mockTicketCount(s), 3);
  s = spendMockTicket(s, t0 + 91 * DAY);      // 使う => 2
  assert.equal(mockTicketCount(s), 2);
  s = syncMockTickets(s, t0 + 120 * DAY);     // 4か月目 => +1 => 3
  assert.equal(mockTicketCount(s), 3);
});

test('buyMockTicket: 貝を消費して+1、上限3・残高不足は不可', () => {
  const t0 = 1_000_000_000_000;
  let s = base({ installedAt: t0, mockTickets: 0, mockGrantsClaimed: 0, wallet: { points: MOCK_TICKET_PRICE * 2 } });
  assert.equal(canBuyMockTicket(s), true);
  s = buyMockTicket(s, t0);
  assert.equal(mockTicketCount(s), 1);
  assert.equal(s.wallet?.points, MOCK_TICKET_PRICE);
  // 残高不足
  const poor = base({ mockTickets: 0, wallet: { points: 10 } });
  assert.equal(canBuyMockTicket(poor), false);
  assert.equal(mockTicketCount(buyMockTicket(poor, t0)), 0);
  // 上限
  const full = base({ mockTickets: MAX_MOCK_TICKETS, wallet: { points: 9999 } });
  assert.equal(canBuyMockTicket(full), false);
  assert.equal(mockTicketCount(buyMockTicket(full, t0)), MAX_MOCK_TICKETS);
});

test('spendMockTicket: 0枚では減らない', () => {
  const s = base({ mockTickets: 0 });
  assert.equal(mockTicketCount(spendMockTicket(s, 1)), 0);
});
