import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kakitoriDrillQueue } from './queue.ts';

const T = '2026-07-10';
test('due到来→未着手→苦手→習得済 の順', () => {
  const k = {
    済: { step:3, stars:3, best:100, due:'2026-08-01' },      // 習得済(未due)
    苦: { step:2, stars:1, best:70 },                          // 苦手(低星)
    期: { step:3, stars:3, best:100, due:'2026-07-09' },       // due到来
  };
  const chars = ['済','未','苦','期']; // 未=未着手
  assert.deepEqual(kakitoriDrillQueue(k, chars, T), ['期','未','苦','済']);
});
test('kakitori未定義は入力順のまま', () => {
  assert.deepEqual(kakitoriDrillQueue(undefined, ['a','b'], T), ['a','b']);
});
