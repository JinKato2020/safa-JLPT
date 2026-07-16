import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reducer } from './store';
import { INITIAL_STATE } from './state';
import { effectiveP } from '../engine/engine';
import type { AppState } from './store';

const NOW = 1_700_000_000_000;
// withStudyDay(streak/growth参照)がcrashしないよう、実在のINITIAL_STATEを土台に構築する。
function base(): AppState { return { ...INITIAL_STATE }; }

test('模試: 初見の用法(usg-)は evidence 記録される(p>0)', () => {
  const s0 = base();
  const s1 = reducer(s0, { type: 'MOCK_ANSWER', itemId: 'usg3-001', correct: true, now: NOW } as never);
  assert.ok(s1.items['usg3-001'], '初見の用法が記録される');
  assert.ok(effectiveP(s1.items['usg3-001'], NOW) > 0.9, '正解で p が上がる');
});

test('模試: 初見の台帳問題(kb-=組み立て/文章)も記録される(旧仕様の除外を撤廃)', () => {
  const s0 = base();
  const s1 = reducer(s0, { type: 'MOCK_ANSWER', itemId: 'kb-004260', correct: true, now: NOW } as never);
  assert.ok(s1.items['kb-004260'], '初見の台帳問題も記録される');
});

test('模試: 既出項目は再記録しない(学習日のみ・pは据え置き)', () => {
  const s0: AppState = {
    ...base(),
    items: { 'usg3-001': { p: 0.3, evidence: 3, updatedAt: NOW, reps: 1, intervalDays: 1, ease: 2.5, dueAt: NOW } },
  };
  const s1 = reducer(s0, { type: 'MOCK_ANSWER', itemId: 'usg3-001', correct: true, now: NOW + 1000 } as never);
  assert.equal(s1.items['usg3-001'].p, 0.3, '既出はpを動かさない');
});
