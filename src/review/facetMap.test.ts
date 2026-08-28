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

test('facetsForUnit: 用法(kb)→語のmean面へ統合(stem→vocabId)', () => {
  const FURI = /（[^）]*）/g;
  const strip = (s: string) => (s || '').replace(FURI, '');
  const wordToVid = new Map<string, string>();
  for (const v of VOCAB) if (!wordToVid.has(v.word)) wordToVid.set(v.word, v.id);
  // 語に解決できる用法問題は mean 面が「語ID」でキーされる(文脈規定/言い換えと同じ面に合流)。
  const resolvable = (KNOWLEDGE_BANK as { id: string; daimon: string; stem?: string }[])
    .find((b) => b.daimon === 'usage' && wordToVid.has(strip(b.stem ?? '')));
  assert.ok(resolvable, '語に解決できる用法問題がある');
  const vid = wordToVid.get(strip(resolvable!.stem ?? ''))!;
  assert.deepEqual(facetsForUnit(resolvable!.id), [{ itemId: vid, facet: 'mean', weight: 1 }], '用法→語IDのmean');
});

test('facetsForUnit: 文法形式(kb)→文法pointのgrammar面へ統合(pointId)', () => {
  const gid = new Set(GRAMMAR.map((g) => g.id));
  const withPoint = (KNOWLEDGE_BANK as { id: string; daimon: string; pointId?: string }[])
    .find((b) => b.daimon === 'grammar_form' && b.pointId && gid.has(b.pointId));
  assert.ok(withPoint, 'pointId付きの文法形式問題がある');
  assert.deepEqual(facetsForUnit(withPoint!.id), [{ itemId: withPoint!.pointId, facet: 'grammar', weight: 1 }], '文法→pointIdのgrammar');
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

test('facetsForUnit: 語彙意味認識 #vrecog_mean → mean面(weight1)', () => {
  assert.deepEqual(facetsForUnit('n5-v-1#vrecog_mean'), [{ itemId: 'n5-v-1', facet: 'mean', weight: 1 }]);
});

test('facetsForUnit: 語彙読み認識 #vrecog_read → read面(weight1)', () => {
  assert.deepEqual(facetsForUnit('n5-v-1#vrecog_read'), [{ itemId: 'n5-v-1', facet: 'read', weight: 1 }]);
});

test('facetsForUnit: 語彙表記認識(かたち) #vrecog_write → write面(weight1)', () => {
  assert.deepEqual(facetsForUnit('n5-v-1#vrecog_write'), [{ itemId: 'n5-v-1', facet: 'write', weight: 1 }]);
});
