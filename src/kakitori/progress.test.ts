// applyKakitoriProgress(純関数) の単体テスト。実行: node --import tsx --test src/kakitori/progress.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyKakitoriProgress } from './progress.ts';

const NOW = Date.parse('2026-07-08T00:00:00Z');

test('step1合格で星1・skipは星を付けない', () => {
  let e = applyKakitoriProgress(undefined, { step: 1, score: 100, skipped: false, now: NOW });
  assert.equal(e.stars, 1);
  e = applyKakitoriProgress(e, { step: 2, score: 100, skipped: true, now: NOW });
  assert.equal(e.stars, 1); // skipは加点しない
});

test('step3(最終)を書いて合格でSRS期日が入る', () => {
  let e = undefined;
  for (const st of [1, 2, 3]) e = applyKakitoriProgress(e, { step: st, score: 100, skipped: false, now: NOW });
  assert.equal(e.stars, 3);
  assert.equal(e.due, '2026-07-09'); // 初回間隔1日
  assert.equal(e.reps, 1);
});
