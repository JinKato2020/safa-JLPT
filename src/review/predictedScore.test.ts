// Phase5: 予想得点が面別マスタリーを正本にするか。実行 node --import tsx --test src/review/predictedScore.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { unitMasteryWithTransfer } from '../store/selectors.ts';
import { INITIAL_STATE } from '../store/state.ts';
import { recordFacet } from './facetMastery.ts';
import { newItemState, recordQuiz } from '../engine/engine.ts';
import type { AppState } from '../store/state.ts';
import { VOCAB, KNOWLEDGE_BANK } from '../data/index.ts';

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

test('統合: 用法(kb)大問の到達度は、その語の意味(mean)面から来る', () => {
  const FURI = /（[^）]*）/g;
  const strip = (x: string) => (x || '').replace(FURI, '');
  const wordToVid = new Map<string, string>();
  for (const v of VOCAB) if (!wordToVid.has(v.word)) wordToVid.set(v.word, v.id);
  const usage = (KNOWLEDGE_BANK as { id: string; daimon: string; stem?: string }[])
    .find((b) => b.daimon === 'usage' && wordToVid.has(strip(b.stem ?? '')))!;
  const vid = wordToVid.get(strip(usage.stem ?? ''))!;
  // その語の mean 面だけを強くし、用法問題そのものは未回答(items空)。
  const mastery = recordFacet({}, [{ itemId: vid, facet: 'mean', weight: 1 }], true, 'practice', NOW);
  const s: AppState = { ...INITIAL_STATE, items: {}, mastery };
  assert.ok((unitMasteryWithTransfer(s, NOW, usage.id) ?? 0) > 0.9, '用法大問が語のmean面を映す');
});
