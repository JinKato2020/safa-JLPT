import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATS, CAT_BY_ID } from './categories.ts';

test('CATS: id一意・umbrella参照は有効・kind別件数', () => {
  const ids = CATS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length); // 一意
  const kanji = CATS.filter((c) => c.kind === 'kanji');
  const vocab = CATS.filter((c) => c.kind === 'vocab');
  const gram = CATS.filter((c) => c.kind === 'grammar');
  assert.equal(kanji.length, 8);
  assert.equal(gram.length, 11);
  assert.ok(vocab.length >= 25);
  for (const v of vocab) assert.ok(v.umbrella && CAT_BY_ID[v.umbrella]?.kind === 'kanji'); // 傘は漢字8の何れか
});
