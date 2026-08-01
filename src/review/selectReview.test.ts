// Phase4: 復習選抜＋出題。実行 node --import tsx --test src/review/selectReview.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectReview } from './selectReview.ts';
import { reviewQuestion, unitForPick } from './reviewQuestion.ts';
import { recordFacet, type MasterySlice } from './facetMastery.ts';
import { newItemState, recordQuiz, type ItemState } from '../engine/engine.ts';
import { VOCAB } from '../data/index.ts';
import type { Facet, FacetTarget } from './facetMap.ts';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const rng = () => 0.3;

// dueAt を過去にした「弱い(誤答)」面 state。
function weakDue(): ItemState {
  const s = recordQuiz(newItemState(NOW - 10 * DAY), false, NOW - 10 * DAY); // reps0, dueAt=約9日前
  return s;
}
function strongFuture(): ItemState {
  return recordQuiz(newItemState(NOW), true, NOW); // dueAt=明日=非due
}

test('due が size を満たすとき非dueは除外される', () => {
  const m: MasterySlice = {
    a: { read: weakDue() },
    b: { mean: weakDue() },
    c: { grammar: strongFuture() }, // 非due
  };
  const picks = selectReview(m, NOW, 2); // due=2 で size を満たす→補充なし
  const ids = picks.map((p) => `${p.itemId}:${p.facet}`);
  assert.equal(picks.length, 2);
  assert.ok(ids.includes('a:read') && ids.includes('b:mean'), 'due の2つ');
  assert.ok(!ids.includes('c:grammar'), '非dueは除外(dueが充足)');
});

test('新出(面state無)は出さない=空マスタリーで0件', () => {
  assert.deepEqual(selectReview({}, NOW, 10), []);
});

test('due が size 未満なら非dueの弱い順で補充', () => {
  const m: MasterySlice = { a: { read: weakDue() }, b: { mean: strongFuture() } };
  const picks = selectReview(m, NOW, 10);
  assert.equal(picks.length, 2, 'due1+補充1');
});

test('同一面が3連続しない(実現可能な配分で)', () => {
  const m: MasterySlice = {};
  // read4 + grammar3(全部 due・弱い)。素の弱い順だと read が4連続=3連続になる。交互化で解消できる配分。
  for (let i = 0; i < 4; i++) m[`r${i}`] = { read: weakDue() };
  for (let i = 0; i < 3; i++) m[`g${i}`] = { grammar: weakDue() };
  const picks = selectReview(m, NOW, 7);
  assert.equal(picks.length, 7, '7件');
  for (let i = 2; i < picks.length; i++) {
    assert.ok(!(picks[i].facet === picks[i - 1].facet && picks[i].facet === picks[i - 2].facet), `3連続なし @${i}`);
  }
});

test('unitForPick: 面→unit の逆写像', () => {
  const vid = VOCAB.find((v) => /[一-龯]/.test(v.word))!.id; // 漢字を含む語
  assert.equal(unitForPick(vid, 'read', rng), `${vid}#kanji_read`);
  assert.equal(unitForPick(vid, 'write', rng), `${vid}#orthography`);
  assert.ok((unitForPick(vid, 'mean', rng) ?? '').startsWith(`${vid}#`), 'mean は context/synonym');
  assert.equal(unitForPick(vid, 'listen', rng), null, 'listen は当面null');
  assert.equal(unitForPick('kb-000001', 'grammar', rng), 'kb-000001', 'kb はそのまま');
  assert.equal(unitForPick('漢', 'write', rng), null, '漢字charは当面null');
});

test('reviewQuestion: 描ける面は4択の Question を返す', () => {
  const vid = VOCAB.find((v) => /[一-龯]/.test(v.word))!.id;
  const q = reviewQuestion({ itemId: vid, facet: 'mean' }, rng);
  assert.ok(q, 'Question が返る');
  assert.equal(q!.choices.length, 4);
  assert.ok(q!.itemId.startsWith(`${vid}#`), 'itemIdはunit(=quizAnswerで面に反映される)');
});

test('reviewQuestion: 描けない面(listen)は null', () => {
  const vid = VOCAB[0].id;
  assert.equal(reviewQuestion({ itemId: vid, facet: 'listen' }, rng), null);
});
