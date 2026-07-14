// app/src/data/content/rehydrate.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rehydrateBanks } from './rehydrate.ts';

const files = {
  'problems/moji_goi/context_N4.json': { schema: 1, daimon: 'context', level: 'N4', languages: ['ja', 'ne'],
    items: [{ id: 'cx:n4-v-1', prompt: 'p', question: 'q', answer: 'a', choices: ['a', 'b'], i18n: { ja: { explain: 'J' }, ne: { explain: 'N' } } }] },
  'problems/moji_goi/synonym_N5.json': { schema: 1, daimon: 'synonym', level: 'N5', languages: ['ja', 'ne'],
    items: [{ id: 'sy:n5-v-1', sentence: 's', underline: 'u', word: 'w', answer: 'a', choices: ['a', 'b'], i18n: { ja: { explain: 'J' }, ne: { explain: 'N' } } }] },
  'problems/dokkai/naiyou_tan_N4.json': { schema: 1, daimon: 'naiyou_tan', level: 'N4', languages: ['ja', 'ne'],
    items: [{ id: 'r-N4-tan-1', category: 'dokkai', type: 'reading', format: 'fmt', title: 't', body: 'B', questions: [{ id: 'q1', q: 'Q', choices: ['a'], answerIndex: 0, i18n: { ja: { explain: 'E' } } }], i18n: { ne: { body: ['BN1', 'BN2'] } } }] },
  'lexicon/meaning_N4.json': { schema: 1, kind: 'meaning', level: 'N4', languages: ['ne'], items: { 'n4-v-1': { ne: 'M' } } },
};

test('rehydrateBanks: context に level/explain/explainNe を復元', () => {
  const b = rehydrateBanks(files);
  const c = b.CONTEXT_BANK[0];
  assert.equal(c.id, 'cx:n4-v-1'); assert.equal(c.level, 'N4');
  assert.equal(c.prompt, 'p'); assert.equal(c.explain, 'J'); assert.equal(c.explainNe, 'N');
  assert.equal(c.i18n, undefined); // 旧shapeにi18nは残さない
});
test('rehydrateBanks: synonym は reason/reasonNe', () => {
  const b = rehydrateBanks(files);
  const s = b.SYNONYM_BANK[0];
  assert.equal(s.reason, 'J'); assert.equal(s.reasonNe, 'N'); assert.equal(s.level, 'N5'); assert.equal(s.word, 'w');
});
test('rehydrateBanks: reading は subtype/level/format・question explain・passageTransNe(配列)', () => {
  const b = rehydrateBanks(files);
  const r = b.READING[0];
  assert.equal(r.subtype, 'naiyou_tan'); assert.equal(r.level, 'N4'); assert.equal(r.format, 'fmt'); assert.equal(r.category, 'dokkai');
  assert.equal(r.questions[0].explain, 'E'); assert.equal(r.questions[0].i18n, undefined);
  assert.deepEqual(b.PASSAGE_TRANS_NE['r-N4-tan-1'], ['BN1', 'BN2']);
});
test('rehydrateBanks: lexicon merge', () => {
  const b = rehydrateBanks(files);
  assert.equal(b.MEANING_L10N['n4-v-1'].ne, 'M');
});
