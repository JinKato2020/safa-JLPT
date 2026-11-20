import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VOCAB, GRAMMAR, KANJI } from '../data';
import { BUNPOU_DAIMON, MOJI_DAIMON, daimonUnitIds } from '../data/daimon';
import { newItemState, type Level } from '../engine/engine';
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
  for (const [index, p] of mix.entries()) {
    if (index) assert.notEqual(p.kind === 'examChoice', mix[index - 1].kind === 'examChoice');
    if (p.kind === 'examChoice') assert.ok(allowedExam.has(p.itemId), p.itemId);
    else assert.ok(allowedPractice.has(p.kind === 'practiceChoice' ? p.ref.id : p.itemId.split('#')[0]), p.itemId);
  }
});
