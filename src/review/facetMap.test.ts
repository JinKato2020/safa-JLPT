// 面写像: 実行 node --import tsx --test src/review/facetMap.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { facetsForDaimon, facetsForUnit, facetsForKakitori, facetsForListen } from './facetMap.ts';
import { KNOWLEDGE_BANK, VOCAB, GRAMMAR } from '../data/index.ts';

test('facetsForDaimon: 大問→面(認識・weight1)', () => {
  const cases: [string, string][] = [
    ['kanji_read', 'read'], ['orthography', 'write'],
    ['context', 'mean'], ['synonym', 'mean'], ['usage', 'mean'],
    ['grammar_form', 'grammar'], ['order', 'grammar'], ['passage_grammar', 'grammar'],
  ];
  for (const [d, f] of cases) {
    const r = facetsForDaimon('x', d);
    assert.deepEqual(r, [{ itemId: 'x', facet: f, weight: 1 }], `${d}→${f}`);
  }
  assert.deepEqual(facetsForDaimon('x', 'unknown_daimon'), [], '未知の大問は空');
});

test('facetsForUnit: #付き認識面キー', () => {
  assert.deepEqual(facetsForUnit('n5-v-2#kanji_read'), [{ itemId: 'n5-v-2', facet: 'read', weight: 1 }]);
  assert.deepEqual(facetsForUnit('n5-v-2#orthography'), [{ itemId: 'n5-v-2', facet: 'write', weight: 1 }]);
  assert.deepEqual(facetsForUnit('n5-v-2#context'), [{ itemId: 'n5-v-2', facet: 'mean', weight: 1 }]);
  assert.deepEqual(facetsForUnit('n5-v-2#synonym'), [{ itemId: 'n5-v-2', facet: 'mean', weight: 1 }]);
});

test('facetsForUnit: 補強キー(産出/文法作成/文法意味)は weight<1', () => {
  assert.deepEqual(facetsForUnit('n5-v-2#produce'), [
    { itemId: 'n5-v-2', facet: 'mean', weight: 0.85 },
    { itemId: 'n5-v-2', facet: 'read', weight: 0.6 },
  ]);
  assert.deepEqual(facetsForUnit('n5-g-1#gbuild'), [{ itemId: 'n5-g-1', facet: 'grammar', weight: 0.85 }]);
  assert.deepEqual(facetsForUnit('n5-g-1#gmeaning'), [{ itemId: 'n5-g-1', facet: 'grammar', weight: 0.85 }]);
});

test('facetsForUnit: bare kb- id はバンクの daimon から面(usage→mean / order・grammar_form→grammar)', () => {
  const byDaimon = (d: string) => (KNOWLEDGE_BANK as { id: string; daimon: string }[]).find((b) => b.daimon === d);
  const usage = byDaimon('usage');
  const order = byDaimon('order');
  if (usage) assert.deepEqual(facetsForUnit(usage.id), [{ itemId: usage.id, facet: 'mean', weight: 1 }], 'usage→mean');
  if (order) assert.deepEqual(facetsForUnit(order.id), [{ itemId: order.id, facet: 'grammar', weight: 1 }], 'order→grammar');
  assert.ok(usage || order, 'バンクに usage か order が存在する');
});

test('facetsForUnit: bare 素id(語彙/文法) は listen(設計§9・履歴由来)', () => {
  assert.deepEqual(facetsForUnit(VOCAB[0].id), [{ itemId: VOCAB[0].id, facet: 'listen', weight: 1 }]);
  assert.deepEqual(facetsForUnit(GRAMMAR[0].id), [{ itemId: GRAMMAR[0].id, facet: 'listen', weight: 1 }]);
});

test('facetsForUnit: スコープ外の未知idは空', () => {
  assert.deepEqual(facetsForUnit('reading-N3-xyz-999'), []);
  assert.deepEqual(facetsForUnit('totally-unknown'), []);
});

test('facetsForKakitori: write(補強)＋副read', () => {
  assert.deepEqual(facetsForKakitori('楽'), [
    { itemId: '楽', facet: 'write', weight: 0.85 },
    { itemId: '楽', facet: 'read', weight: 0.6 },
  ]);
});

test('facetsForListen: listen(認識)', () => {
  assert.deepEqual(facetsForListen('n5-v-9'), [{ itemId: 'n5-v-9', facet: 'listen', weight: 1 }]);
});
