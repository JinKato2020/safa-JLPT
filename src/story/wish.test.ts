import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WISH_KINDS, hasWish, makeWish } from './wish';

const T = Date.UTC(2026, 6, 28, 1, 0, 0); // 2026-07-28 相当

test('WISH_KINDS: 6つの願い＋custom＋later で8種', () => {
  assert.equal(WISH_KINDS.length, 8);
  assert.ok(WISH_KINDS.includes('later'));
  assert.ok(WISH_KINDS.includes('custom'));
});

test('hasWish: 未設定/later は未設定扱い、実願いは true', () => {
  assert.equal(hasWish(undefined), false);
  assert.equal(hasWish(makeWish('later', T)), false);
  assert.equal(hasWish(makeWish('work_live', T)), true);
  assert.equal(hasWish(makeWish('custom', T, '推し活のため')), true);
});

test('makeWish: 通常の願いは text を持たず setAt が入る', () => {
  const w = makeWish('family', T);
  assert.equal(w.kind, 'family');
  assert.equal(w.text, undefined);
  assert.equal(typeof w.setAt, 'string');
});

test('makeWish: custom は text をトリムして保持', () => {
  assert.equal(makeWish('custom', T, '  日本の詩を読む  ').text, '日本の詩を読む');
  assert.equal(makeWish('custom', T).text, ''); // text 無し custom は空文字
});
