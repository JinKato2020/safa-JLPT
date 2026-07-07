// 書き取りSRSスケジューラの単体テスト。実行: node --import tsx --test src/kakitori/srs.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextInterval, scheduleKakitori, kakitoriDueToday } from './srs.ts';

test('初回(interval無し・ミス0)は1日', () => { assert.equal(nextInterval(undefined, 0), 1); });
test('1→3→7→16→35と延長', () => {
  assert.equal(nextInterval(1, 0), 3);
  assert.equal(nextInterval(3, 0), 7);
  assert.equal(nextInterval(7, 0), 16);
  assert.equal(nextInterval(16, 0), 35);
  assert.equal(nextInterval(35, 0), 35); // 上限
});
test('3ミス以上で最短1日に戻す', () => { assert.equal(nextInterval(16, 3), 1); });
test('scheduleは due/interval/reps を更新', () => {
  const r = scheduleKakitori({ step: 3, stars: 3, best: 100 }, { mistakes: 0, today: '2026-07-08' });
  assert.equal(r.interval, 1);
  assert.equal(r.due, '2026-07-09');
  assert.equal(r.reps, 1);
});
test('kakitoriDueTodayは期日到来字のみ', () => {
  const k = { 日: { step: 3, stars: 3, best: 100, due: '2026-07-08' }, 木: { step: 3, stars: 3, best: 100, due: '2026-07-20' }, 山: { step: 1, stars: 1, best: 80 } };
  assert.deepEqual(kakitoriDueToday(k, '2026-07-08'), ['日']);
});
test('kakitori未定義は空配列', () => { assert.deepEqual(kakitoriDueToday(undefined, '2026-07-08'), []); });
