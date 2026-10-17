import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_SPECS, scoringSectionForDaimon } from './facets.ts';

test('N3 has 3 scoring sections with min 19 and pass total 95', () => {
  const s = LEVEL_SPECS.N3;
  assert.equal(s.sections.length, 3);
  assert.equal(s.passTotal, 95);
  for (const sec of s.sections) assert.equal(sec.minPoint, 19);
  assert.deepEqual(s.sections.map(x => x.key).sort(), ['choukai', 'dokkai', 'gengo']);
});

test('N5 merges reading into gengo: 2 sections, gengo max 120 min 38', () => {
  const s = LEVEL_SPECS.N5;
  assert.equal(s.sections.length, 2);
  assert.equal(s.passTotal, 80);
  const gengo = s.sections.find(x => x.key === 'gengo')!;
  assert.equal(gengo.max, 120);
  assert.equal(gengo.minPoint, 38);
});

test('grammar_form maps to gengo (not a separate section) at every level', () => {
  assert.equal(scoringSectionForDaimon('N3', 'grammar_form'), 'gengo');
  assert.equal(scoringSectionForDaimon('N5', 'grammar_form'), 'gengo');
});

test('reading maps to dokkai at N3 but to gengo at N5', () => {
  assert.equal(scoringSectionForDaimon('N3', 'reading'), 'dokkai');
  assert.equal(scoringSectionForDaimon('N5', 'reading'), 'gengo');
});
