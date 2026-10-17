// Phase2: reducer が面別マスタリーへ合流するか。実行 node --import tsx --test src/review/facetReducer.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reducer } from '../store/store';
import { INITIAL_STATE } from '../store/state.ts';
import { facetEffectiveP } from './facetMastery.ts';
import type { AppState } from '../store/store';

const NOW = 1_700_000_000_000;
function base(): AppState { return { ...INITIAL_STATE, mastery: {}, items: {} }; }

test('QUIZ_ANSWER: #context 正解で該当語の mean 面が上がる（items も従来通り記録）', () => {
  const s = reducer(base(), { type: 'QUIZ_ANSWER', itemId: 'n5-v-2#context', correct: true, now: NOW } as never);
  assert.ok((facetEffectiveP(s.mastery!, 'n5-v-2', 'mean', NOW) ?? 0) > 0.9, 'mean 面が上がる');
  assert.ok(s.items['n5-v-2#context'], 'items も従来通り');
});

test('QUIZ_ANSWER: #kanji_read は read 面へ', () => {
  const s = reducer(base(), { type: 'QUIZ_ANSWER', itemId: 'n5-v-2#kanji_read', correct: true, now: NOW } as never);
  assert.ok((facetEffectiveP(s.mastery!, 'n5-v-2', 'read', NOW) ?? 0) > 0.9);
  assert.equal(facetEffectiveP(s.mastery!, 'n5-v-2', 'mean', NOW), null, '別面は触らない');
});

test('MOCK_ANSWER: 初見の用法(kb-)は面(mean/grammar)へ合流', () => {
  // usage→mean, order→grammar のどちらかは KNOWLEDGE_BANK に存在。実idで検証。
  const s0 = base();
  const s = reducer(s0, { type: 'MOCK_ANSWER', itemId: 'n5-v-2#synonym', correct: true, now: NOW } as never);
  assert.ok((facetEffectiveP(s.mastery!, 'n5-v-2', 'mean', NOW) ?? 0) > 0.9, 'synonym→mean 面');
});

test('KAKITORI_PROGRESS: 書き取りは面を触らない(練習ツール・ユーザー方針2026-08-26)', () => {
  // 書き取り(手書き産出)は「練習」＝マスタリー面には計上しない。★/SRS(kakitori)だけ記録する。
  const s = reducer(base(), { type: 'KAKITORI_PROGRESS', char: '楽', step: 3, score: 100, now: NOW } as never);
  assert.equal(facetEffectiveP(s.mastery!, '楽', 'write', NOW), null, '見ないで書く合格でも write 面は上げない');
  assert.equal(facetEffectiveP(s.mastery!, '楽', 'read', NOW), null, 'read 面も触らない');
  assert.ok(s.kakitori!['楽'], 'kakitori(★/SRS)は従来通り記録される');
});

test('KAKITORI_PROGRESS: step1/skip でも当然 面は触らない', () => {
  const s1 = reducer(base(), { type: 'KAKITORI_PROGRESS', char: '楽', step: 1, score: 100, now: NOW } as never);
  assert.equal(facetEffectiveP(s1.mastery!, '楽', 'write', NOW), null, 'step1 は面に無反映');
  const s2 = reducer(base(), { type: 'KAKITORI_PROGRESS', char: '楽', step: 3, score: 100, skipped: true, now: NOW } as never);
  assert.equal(facetEffectiveP(s2.mastery!, '楽', 'write', NOW), null, 'skip も面に無反映');
});

test('スコープ外id(読解等)は面を作らない=mastery 空のまま', () => {
  const s = reducer(base(), { type: 'QUIZ_ANSWER', itemId: 'reading-N3-xyz', correct: true, now: NOW } as never);
  assert.deepEqual(s.mastery, {}, '未知idは面ゼロ');
  assert.ok(s.items['reading-N3-xyz'], 'items へは従来通り記録');
});

// ── 文法の出題形式novelty(ソフト重み) ──
const seedG = (p: number) => ({ 'n5-g-2': { grammar: { p, evidence: 3, updatedAt: NOW, reps: 1, intervalDays: 1, ease: 2.5, dueAt: NOW } } });

test('gFmt: 文法回答で pointId#形式 の回答数を数える(形式別)', () => {
  let s = reducer(base(), { type: 'QUIZ_ANSWER', itemId: 'n5-g-2#order', correct: true, now: NOW } as never);
  assert.equal(s.gFmt!['n5-g-2#order'], 1, '組み立て1回目');
  s = reducer(s, { type: 'QUIZ_ANSWER', itemId: 'n5-g-2#order', correct: true, now: NOW } as never);
  assert.equal(s.gFmt!['n5-g-2#order'], 2, '組み立て2回目');
  s = reducer(s, { type: 'QUIZ_ANSWER', itemId: 'n5-g-2#grammar_form', correct: true, now: NOW } as never);
  assert.equal(s.gFmt!['n5-g-2#grammar_form'], 1, '穴埋めは別カウント');
  assert.equal(s.gFmt!['n5-g-2#order'], 2, '組み立ては据え置き');
});

test('novelty: 未着手の形式で間違えるほうが、慣れた形式で間違えるより大きく下がる', () => {
  // 同じ開始習得(p=1)から、同じ形式で不正解。片方は回答数0(mul≈2)、片方は回答数20(mul≈1)。
  const fresh = reducer({ ...base(), mastery: seedG(1), gFmt: {} }, { type: 'QUIZ_ANSWER', itemId: 'n5-g-2#order', correct: false, now: NOW } as never);
  const grind = reducer({ ...base(), mastery: seedG(1), gFmt: { 'n5-g-2#order': 20 } }, { type: 'QUIZ_ANSWER', itemId: 'n5-g-2#order', correct: false, now: NOW } as never);
  const pFresh = facetEffectiveP(fresh.mastery!, 'n5-g-2', 'grammar', NOW)!;
  const pGrind = facetEffectiveP(grind.mastery!, 'n5-g-2', 'grammar', NOW)!;
  assert.ok(pFresh < pGrind, `未着手形式の誤答が大きく効く: fresh ${pFresh} < grind ${pGrind}`);
});

test('novelty: 非文法(語彙)の面は倍率の影響を受けない', () => {
  // #context(mean面)は grammar でないので gFmt を触らない。
  const s = reducer(base(), { type: 'QUIZ_ANSWER', itemId: 'n5-v-2#context', correct: true, now: NOW } as never);
  assert.deepEqual(s.gFmt ?? {}, {}, '語彙回答は gFmt を作らない');
});
