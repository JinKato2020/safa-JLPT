import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreDrawing, PASS_SCORE, type Pt } from './score';

// L字の手本(横線＋縦線)
const L: Pt[][] = [
  [[0.1, 0.1], [0.5, 0.1], [0.9, 0.1]],
  [[0.5, 0.1], [0.5, 0.5], [0.5, 0.9]],
];

test('exact shape scores high', () => {
  assert.ok(scoreDrawing(L.flat(), L) >= 90, `got ${scoreDrawing(L.flat(), L)}`);
});

test('empty input scores 0', () => {
  assert.equal(scoreDrawing([], L), 0);
  assert.equal(scoreDrawing(L.flat(), []), 0);
});

test('same shape shifted+scaled still passes (position/size invariant)', () => {
  // 位置を(+0.3,-0.05)平行移動し0.5倍に縮小=同じ形
  const moved: Pt[] = L.flat().map(([x, y]) => [x * 0.5 + 0.3, y * 0.5 - 0.05]);
  const s = scoreDrawing(moved, L);
  assert.ok(s >= 90, `got ${s}`);
});

test('wrong shape does not pass', () => {
  // 対角線=L字とは別の形
  const diag: Pt[] = [[0.1, 0.9], [0.3, 0.7], [0.5, 0.5], [0.7, 0.3], [0.9, 0.1]];
  const s = scoreDrawing(diag, L);
  assert.ok(s < PASS_SCORE, `got ${s}`);
});

test('partial (one stroke of two) does not pass', () => {
  const s = scoreDrawing(L[0], L);
  assert.ok(s < PASS_SCORE, `got ${s}`);
});
