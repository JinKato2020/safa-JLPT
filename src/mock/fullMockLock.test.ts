import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fullMockLocked } from './fullMockLock.ts';

const h = (day: string, full: boolean) => ({ day, pct: 50, full });

test('同一暦月にフル受験済み→locked、翌月1日がnext', () => {
  const now = Date.UTC(2026, 6, 15); // 2026-07-15
  const r = fullMockLocked([h('2026-07-03', true)], now);
  assert.equal(r.locked, true);
  assert.deepEqual(r.next, { y: 2026, m: 8, d: 1 });
});

test('12月受験→翌年1月1日がnext', () => {
  const now = Date.UTC(2026, 11, 20);
  const r = fullMockLocked([h('2026-12-02', true)], now);
  assert.equal(r.locked, true);
  assert.deepEqual(r.next, { y: 2027, m: 1, d: 1 });
});

test('先月のフルのみ→unlocked', () => {
  const now = Date.UTC(2026, 6, 15);
  assert.equal(fullMockLocked([h('2026-06-28', true)], now).locked, false);
});

test('ミニ(full=false)しかない→unlocked', () => {
  const now = Date.UTC(2026, 6, 15);
  assert.equal(fullMockLocked([h('2026-07-10', false)], now).locked, false);
});

test('履歴なし→unlocked', () => {
  assert.equal(fullMockLocked([], Date.UTC(2026, 6, 15)).locked, false);
});
