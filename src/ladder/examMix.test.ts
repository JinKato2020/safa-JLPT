import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VOCAB, GRAMMAR, KANJI } from '../data';
import { BUNPOU_DAIMON, MOJI_DAIMON, daimonUnitIds } from '../data/daimon';
import { SIGNAL_WEIGHT, newItemState, type Level } from '../engine/engine';
import { buildExamMix, buildWeaknessMix } from './examMix';

const NOW = 1_800_000_000_000;
const empty = { items: {}, mastery: {} };

function rng() {
  let seed = 731;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

function examIds(level: Level) {
  return new Set( [...MOJI_DAIMON, ...BUNPOU_DAIMON.filter(d => d !== 'passage_grammar')]
    .flatMap(d => daimonUnitIds(level, d, 'learn')));
}

test('exam mix uses only short vocabulary and grammar formats in the selected level', () => {
  for (const level of ['N5', 'N4', 'N3'] as const) {
    const mix = buildExamMix(level, empty, NOW, rng());
    assert.equal(mix.length, level === 'N5' ? 6 : 7);
    const allowed = examIds(level);
    assert.ok(mix.every(p => allowed.has(p.itemId) && p.question.choices[p.question.answerIndex]));
    for (const format of [...MOJI_DAIMON, 'grammar_form', 'order'] as const) {
      const ids = new Set(daimonUnitIds(level, format, 'learn'));
      assert.equal(mix.filter(p => ids.has(p.itemId)).length, ids.size ? 1 : 0);
    }
  }
});

test('weakness mix balances both tabs and confines history to the selected exam level', () => {
  const due = { ...newItemState(NOW - 1000), dueAt: NOW - 1 };
  const oldGrammar = daimonUnitIds('N5', 'grammar_form', 'learn')[0];
  const currentGrammar = daimonUnitIds('N3', 'grammar_form', 'learn')[0];
  const progress = {
    mastery: { 'n5-v-1': { mean: due } },
    items: { [oldGrammar]: due, [currentGrammar]: due },
  };
  const mix = buildWeaknessMix('N3', 'en', progress, NOW, rng());
  assert.equal(mix.length, 10);
  const allowedExam = examIds('N3');
  const allowedPractice = new Set([...VOCAB, ...GRAMMAR, ...KANJI].filter(item => item.level === 'N3').map(item => item.id));
  assert.equal(mix.filter(p => p.kind === 'examChoice').length, 5);
  assert.ok(mix.some(p => p.itemId === currentGrammar));
  for (const p of mix) {
    if (p.kind === 'examChoice') assert.ok(allowedExam.has(p.itemId), p.itemId);
    else assert.ok(allowedPractice.has(p.kind === 'practiceChoice' ? p.ref.id : p.itemId.split('#')[0]), p.itemId);
  }
});

test('weakness follows the chosen tab ratio, excludes automatic review and other levels', () => {
  const exam = daimonUnitIds('N5', 'grammar_form', 'learn')[0];
  const vocab = VOCAB.find(v => v.level === 'N5')!.id;
  for (const n of [0, 2, 5, 8, 10]) {
    const history = { items: {
      [exam]: { ...newItemState(NOW), evidence: (n + 4) * SIGNAL_WEIGHT.practice, weaknessAnswers: 4 },
      [vocab + '#vrecog_read']: { ...newItemState(NOW), evidence: (10 - n) * SIGNAL_WEIGHT.practice },
      [daimonUnitIds('N3', 'order', 'learn')[0]]: { ...newItemState(NOW), evidence: 300 },
    }, mastery: {} };
    const mix = buildWeaknessMix('N5', 'en', history, NOW, rng());
    assert.equal(mix.length, 10);
    assert.equal(new Set(mix.map(p => p.itemId)).size, 10);
    assert.equal(mix.filter(p => p.kind === 'examChoice').length, n);
  }
});
