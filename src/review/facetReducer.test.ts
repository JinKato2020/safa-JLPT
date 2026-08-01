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

test('KAKITORI_PROGRESS: 見ないで書く(step3)合格で write 面が上がる', () => {
  const s = reducer(base(), { type: 'KAKITORI_PROGRESS', char: '楽', step: 3, score: 100, now: NOW } as never);
  assert.ok((facetEffectiveP(s.mastery!, '楽', 'write', NOW) ?? 0) > 0, 'write 面が底上げ');
  assert.ok(s.kakitori!['楽'], 'kakitori も従来通り');
});

test('KAKITORI_PROGRESS: なぞり段階(step1)や skip では面を触らない', () => {
  const s1 = reducer(base(), { type: 'KAKITORI_PROGRESS', char: '楽', step: 1, score: 100, now: NOW } as never);
  assert.equal(facetEffectiveP(s1.mastery!, '楽', 'write', NOW), null, 'step1 は面に無反映');
  const s2 = reducer(base(), { type: 'KAKITORI_PROGRESS', char: '楽', step: 3, score: 100, skipped: true, now: NOW } as never);
  assert.equal(facetEffectiveP(s2.mastery!, '楽', 'write', NOW), null, 'skip は面に無反映');
});

test('スコープ外id(読解等)は面を作らない=mastery 空のまま', () => {
  const s = reducer(base(), { type: 'QUIZ_ANSWER', itemId: 'reading-N3-xyz', correct: true, now: NOW } as never);
  assert.deepEqual(s.mastery, {}, '未知idは面ゼロ');
  assert.ok(s.items['reading-N3-xyz'], 'items へは従来通り記録');
});
