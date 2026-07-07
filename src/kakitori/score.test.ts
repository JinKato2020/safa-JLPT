import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreDrawing, type Pt } from './score';

const box: Pt[][] = [
  [[0.1, 0.1], [0.5, 0.1], [0.9, 0.1]],
  [[0.5, 0.1], [0.5, 0.5], [0.5, 0.9]],
];

test('exact trace scores high', () => {
  assert.ok(scoreDrawing(box.flat(), box) >= 90);
});

test('empty input scores 0', () => {
  assert.equal(scoreDrawing([], box), 0);
  assert.equal(scoreDrawing(box.flat(), []), 0);
});

test('far-away scribble scores low', () => {
  const user: Pt[] = [[0.95, 0.95], [0.9, 0.95], [0.95, 0.9]];
  assert.ok(scoreDrawing(user, box) <= 20);
});

test('partial coverage scores middle', () => {
  const s = scoreDrawing(box[0], box); // 1画だけなぞる
  assert.ok(s > 20 && s < 90, `got ${s}`);
});
