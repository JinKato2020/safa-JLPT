import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newItemState } from '../engine/engine';
import { buildPracticeMix, practiceCandidates, practicePriority } from './practiceMix';

const NOW = 1_800_000_000_000;
function random() {
  let seed = 371;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

test('each JLPT level has eleven formats, with the same kanji practiced from three angles', () => {
  for (const level of ['N5', 'N4', 'N3'] as const) {
    assert.equal(buildPracticeMix(level, 'en', {}, NOW, {}, random()).length, level === 'N5' ? 6 : 7);
    const mix = practiceCandidates(level, 'en', {}, NOW, {}, random());
    assert.equal(mix.length, 11);
    const choices = mix.filter(q => q.kind === 'practiceChoice');
    assert.deepEqual(choices.map(q => q.instruction), [
      'krecog.prompt_mean', 'krecog.prompt_read', 'listening2.prompt_kanji',
      'listening2.prompt_vocab', 'kform.prompt',
    ]);
    assert.equal(choices[0].ref.id, choices[1].ref.id);
    assert.equal(choices[1].ref.id, choices[2].ref.id);
    for (const q of choices) {
      assert.equal(new Set(q.choices).size, 4);
      assert.ok(q.choices[q.answerIndex]);
    }
    assert.equal(new Set(mix.map(q => q.itemId)).size, mix.length);
  }
});

test('a due facet on another kanji takes priority over the paired kanji', () => {
  const initial = buildPracticeMix('N5', 'en', {}, NOW, {}, random());
  const baseline = initial.find(q => q.kind === 'practiceChoice' && q.instruction === 'krecog.prompt_read');
  const char = baseline?.kind === 'practiceChoice' && baseline.prompt === '水' ? '山' : '水';
  const due = { ...newItemState(NOW - 1000), dueAt: NOW - 1 };
  const scheduled = buildPracticeMix('N5', 'en', { [char]: { read: due } }, NOW, {}, random());
  assert.ok(scheduled.some(q => q.itemId === char + '#krecog_read'));
  assert.ok(practicePriority({}, '水#krecog_read', NOW, due) < practicePriority({}, '水#krecog_read', NOW));
  assert.ok(practicePriority({ 水: { read: { ...due, dueAt: NOW + 1000 } } }, '水#krecog_read', NOW) > 1);
});
