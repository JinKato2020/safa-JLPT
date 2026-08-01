// Phase5: 予想得点が面別マスタリーを正本にするか。実行 node --import tsx --test src/review/predictedScore.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { unitMasteryWithTransfer } from '../store/selectors.ts';
import { INITIAL_STATE } from '../store/state.ts';
import { recordFacet } from './facetMastery.ts';
import { newItemState, recordQuiz } from '../engine/engine.ts';
import type { AppState } from '../store/state.ts';

const NOW = 1_700_000_000_000;
const strong = () => recordQuiz(newItemState(NOW), true, NOW); // p=1

test('面優先: mean 面があれば #context/#synonym 両大問が同じmean実力を返す(統合)', () => {
  const mastery = recordFacet({}, [{ itemId: 'n5-v-2', facet: 'mean', weight: 1 }], true, 'practice', NOW);
  const s: AppState = { ...INITIAL_STATE, items: {}, mastery };
  const ctx = unitMasteryWithTransfer(s, NOW, 'n5-v-2#context');
  const syn = unitMasteryWithTransfer(s, NOW, 'n5-v-2#synonym');
  assert.ok((ctx ?? 0) > 0.9 && (syn ?? 0) > 0.9, 'どちらもmean実力');
  assert.equal(ctx, syn, 'context と synonym は同じmean面=一貫');
});

test('面が最優先: 面(弱)が legacy items(強)を上書きする', () => {
  const weak = recordFacet({}, [{ itemId: 'n5-v-2', facet: 'mean', weight: 1 }], false, 'practice', NOW); // p≈0
  const s: AppState = { ...INITIAL_STATE, items: { 'n5-v-2#context': strong() }, mastery: weak };
  const p = unitMasteryWithTransfer(s, NOW, 'n5-v-2#context') ?? 1;
  assert.ok(p < 0.2, `面(弱)が優先されlegacy強を上書き: ${p}`);
});

test('面が無ければ従来フォールバック(直接items)', () => {
  const s: AppState = { ...INITIAL_STATE, items: { 'n5-v-2#context': strong() }, mastery: {} };
  assert.ok((unitMasteryWithTransfer(s, NOW, 'n5-v-2#context') ?? 0) > 0.9, 'legacy直接証拠');
});
