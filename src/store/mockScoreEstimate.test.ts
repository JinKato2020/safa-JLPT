import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockScoreEstimate } from './selectors';

// 全問正解なら 予想得点=満点(180)・足切り割れ無し。
test('全問正解=満点180・below無し', () => {
  const e = mockScoreEstimate('N4', { moji_goi: { c: 10, t: 10 }, bunpou: { c: 10, t: 10 }, dokkai: { c: 10, t: 10 }, choukai: { c: 10, t: 10 } });
  assert.equal(e.max, 180);
  assert.equal(e.score, 180);
  assert.ok(e.sections.every((s) => !s.below));
  assert.equal(e.score, e.sections.reduce((a, s) => a + s.score, 0));
});

// 全問不正解なら 予想得点0・各区分は足切り割れ(min>0のため)。
test('全問不正解=0点・各区分below', () => {
  const e = mockScoreEstimate('N4', { moji_goi: { c: 0, t: 10 }, bunpou: { c: 0, t: 10 }, dokkai: { c: 0, t: 10 }, choukai: { c: 0, t: 10 } });
  assert.equal(e.score, 0);
  assert.ok(e.sections.every((s) => s.below));
});

// 各区分の点=正答率×配点(四捨五入)。半分正解ならおよそ満点の半分。
test('区分点=正答率×配点(四捨五入)', () => {
  const e = mockScoreEstimate('N4', { moji_goi: { c: 5, t: 10 }, bunpou: { c: 5, t: 10 }, dokkai: { c: 5, t: 10 }, choukai: { c: 5, t: 10 } });
  for (const s of e.sections) assert.equal(s.score, Math.round(0.5 * s.max));
  assert.equal(e.score, e.sections.reduce((a, s) => a + s.score, 0));
  assert.ok(e.passTotal > 0 && e.passTotal <= e.max);
});
