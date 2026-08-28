import { test } from 'node:test';
import assert from 'node:assert/strict';
import vocab from '../data/shared/vocab.json';
import { vocabMeaningProblem, kanjiMeaningProblem, grammarMeaningProblem } from './wordTabProblems.ts';

function checkMc(p: any, expectAnswer: string) {
  assert.ok(p, 'problem built');
  assert.equal(p.choices.length, 4);
  assert.equal(p.choices[p.answerIndex], expectAnswer);
  assert.equal(new Set(p.choices).size, 4, 'no duplicate choices');
}

test('vocab meaning problem: audio prompt, 4 unique choices, answer present', () => {
  const v = (vocab as any[]).find((x) => x.id === 'n5-v-634'); // 万年筆
  const p = vocabMeaningProblem('n5-v-634', 3)!;
  checkMc(p, v.meaning);
  assert.equal(p.promptKind, 'audio');
  assert.equal(p.prompt, v.reading);
  assert.equal(p.facet, 'meaning');
});

test('kanji meaning problem: 方針A(2026-08-28)で全字に意味問題(山も校も辞書glossあり)', () => {
  const p = kanjiMeaningProblem('山', 3)!;
  checkMc(p, '山' && p.choices[p.answerIndex]);
  assert.equal(p.prompt, '山');
  assert.equal(p.facet, 'kanji_meaning');
  // 旧: 音のみ字(校)はnull → 方針Aで辞書glossがあれば全字に意味問題を作る。
  const k = kanjiMeaningProblem('校', 3);
  assert.ok(k && k.prompt === '校' && k.choices.length === 4);
});

test('grammar meaning problem uses the point as prompt', () => {
  const p = grammarMeaningProblem('n5-g-68', 3)!; // たり～たり
  assert.equal(p.choices.length, 4);
  assert.equal(p.prompt, 'たり～たり');
  assert.equal(p.facet, 'g_meaning');
});

test('deterministic for a given seed', () => {
  assert.deepEqual(vocabMeaningProblem('n5-v-634', 9), vocabMeaningProblem('n5-v-634', 9));
});
