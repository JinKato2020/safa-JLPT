// Phase3: 旧キー→面 移行。実行 node --import tsx --test src/review/migrateMastery.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMasteryFromLegacy, migrateMastery } from './migrateMastery.ts';
import { facetEffectiveP, getFacet } from './facetMastery.ts';
import { newItemState, recordQuiz, type ItemState } from '../engine/engine.ts';
import type { AppState } from '../store/state.ts';

const NOW = 1_700_000_000_000;
const strong = (): ItemState => recordQuiz(newItemState(NOW), true, NOW); // p=1, evidence=3

test('認識面: #context→mean / #kanji_read→read を複製', () => {
  const items = { 'n5-v-2#context': strong(), 'n5-v-2#kanji_read': strong() };
  const m = buildMasteryFromLegacy(items, undefined, NOW);
  assert.ok((facetEffectiveP(m, 'n5-v-2', 'mean', NOW) ?? 0) > 0.9, 'mean');
  assert.ok((facetEffectiveP(m, 'n5-v-2', 'read', NOW) ?? 0) > 0.9, 'read');
});

test('補強(産出#produce)は認識面が既にあれば上書きしない', () => {
  // recognition mean を弱め(誤答)にし、produce(正解=強い)で上書きされないことを確認。
  const weakMean = recordQuiz(newItemState(NOW), false, NOW); // p≈0
  const items = { 'n5-v-2#context': weakMean, 'n5-v-2#produce': strong() };
  const m = buildMasteryFromLegacy(items, undefined, NOW);
  const p = facetEffectiveP(m, 'n5-v-2', 'mean', NOW) ?? 1;
  assert.ok(p < 0.2, `補強で認識面(mean)を上げていない: ${p}`);
});

test('補強のみの面: #produce→mean は weight で薄めて反映(認識より低い)', () => {
  const items = { 'x#produce': strong() }; // mean(0.85)+read(0.6)
  const m = buildMasteryFromLegacy(items, undefined, NOW);
  const mean = getFacet(m, 'x', 'mean')!;
  const read = getFacet(m, 'x', 'read')!;
  assert.ok(mean.p > 0 && mean.p < 1, `mean薄め: ${mean.p}`);
  assert.ok(read.p < mean.p, `read(0.6)はmean(0.85)より薄い: ${read.p}<${mean.p}`);
});

test('書き取り: 合格実績(stars>=1)ある字は write(副read)へ', () => {
  const m = buildMasteryFromLegacy({}, { '楽': { step: 3, stars: 3, best: 90 } }, NOW);
  assert.ok((facetEffectiveP(m, '楽', 'write', NOW) ?? 0) > 0, 'write 底上げ');
  assert.ok((facetEffectiveP(m, '楽', 'read', NOW) ?? 0) > 0, 'read 副次');
});

test('書き取り: 未合格(stars=0)は面を作らない', () => {
  const m = buildMasteryFromLegacy({}, { '楽': { step: 1, stars: 0, best: 0 } }, NOW);
  assert.equal(getFacet(m, '楽', 'write'), undefined);
});

test('冪等: 二度 build しても同一', () => {
  const items = { 'n5-v-2#context': strong(), 'n5-v-2#produce': strong() };
  const a = buildMasteryFromLegacy(items, { '楽': { step: 3, stars: 2, best: 80 } }, NOW);
  const b = buildMasteryFromLegacy(items, { '楽': { step: 3, stars: 2, best: 80 } }, NOW);
  assert.deepEqual(a, b);
});

test('migrateMastery: 未移行stateを移行し masteryMigrated を立てる', () => {
  const s0 = { version: 1, items: { 'n5-v-2#synonym': strong() }, masteryMigrated: false } as unknown as AppState;
  const s1 = migrateMastery(s0, NOW);
  assert.equal(s1.masteryMigrated, true);
  assert.ok((facetEffectiveP(s1.mastery!, 'n5-v-2', 'mean', NOW) ?? 0) > 0.9);
});

test('migrateMastery: 済みstateは無変更(冪等ガード)', () => {
  const s = { version: 1, items: { 'n5-v-2#synonym': strong() }, mastery: { keep: {} }, masteryMigrated: true } as unknown as AppState;
  assert.equal(migrateMastery(s, NOW), s, '同一参照=無変更');
});
