// KAKITORI_PROGRESS reducer の単体テスト。実行: node --import tsx --test src/store/kakitori_reducer.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reducerForTest } from './store.tsx';
import { INITIAL_STATE } from './state.ts';

const NOW = Date.parse('2026-07-08T00:00:00Z');

test('step1合格で星1・skipは星を付けない', () => {
  let s = reducerForTest(INITIAL_STATE, { type: 'KAKITORI_PROGRESS', char: '日', step: 1, score: 100, skipped: false, now: NOW });
  assert.equal(s.kakitori?.['日'].stars, 1);
  s = reducerForTest(s, { type: 'KAKITORI_PROGRESS', char: '日', step: 2, score: 100, skipped: true, now: NOW });
  assert.equal(s.kakitori?.['日'].stars, 1); // skipは加点しない
});

test('step3(最終)を書いて合格でSRS期日が入る', () => {
  let s = INITIAL_STATE;
  for (const st of [1, 2, 3]) s = reducerForTest(s, { type: 'KAKITORI_PROGRESS', char: '木', step: st, score: 100, skipped: false, now: NOW });
  assert.equal(s.kakitori?.['木'].stars, 3);
  assert.equal(s.kakitori?.['木'].due, '2026-07-09'); // 初回間隔1日
  assert.equal(s.kakitori?.['木'].reps, 1);
});
