import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idBand, idNumber, practicePool } from './pool';

test('idBand: ID帯の境界(0500/0700/0701)', () => {
  assert.equal(idBand('N5-C-S-0001'), 'general');
  assert.equal(idBand('N5-C-S-0500'), 'general');
  assert.equal(idBand('N5-C-S-0501'), 'reserve');
  assert.equal(idBand('N5-C-S-0700'), 'reserve');
  assert.equal(idBand('N5-C-S-0701'), 'mock');
  assert.equal(idBand('N5-C-S-1000'), 'mock');
  assert.equal(idNumber('N5-C-S-0042'), 42);
});

const clip = (n: number) => ({ id: `N5-C-S-${String(n).padStart(4, '0')}`, questions: [{ id: `N5-C-S-${String(n).padStart(4, '0')}-q1` }] });

test('practicePool: 模試帯(0701-)は常に除外', () => {
  const items = [clip(1), clip(2), clip(701), clip(900)];
  const pool = practicePool(items, () => false);
  assert.deepEqual(pool.map((c) => c.id), ['N5-C-S-0001', 'N5-C-S-0002']);
});

test('practicePool: 一般未消化なら予備帯(0501-)は出さない', () => {
  const items = [clip(1), clip(2), clip(501), clip(502)];
  // 一般 0001 だけ回答済み(0002 未回答)→ 一巡していない
  const answered = new Set(['N5-C-S-0001-q1']);
  const pool = practicePool(items, (q) => answered.has(q));
  assert.deepEqual(pool.map((c) => c.id), ['N5-C-S-0001', 'N5-C-S-0002']);
});

test('practicePool: 一般を一巡したら予備帯が解放される', () => {
  const items = [clip(1), clip(2), clip(501), clip(502)];
  const answered = new Set(['N5-C-S-0001-q1', 'N5-C-S-0002-q1']);
  const pool = practicePool(items, (q) => answered.has(q));
  assert.deepEqual(pool.map((c) => c.id), ['N5-C-S-0001', 'N5-C-S-0002', 'N5-C-S-0501', 'N5-C-S-0502']);
});

test('practicePool: 予備帯が無ければ一般をそのまま返す(他大問=挙動不変)', () => {
  const items = [clip(1), clip(2), clip(3)];
  const pool = practicePool(items, () => false);
  assert.equal(pool.length, 3);
});
