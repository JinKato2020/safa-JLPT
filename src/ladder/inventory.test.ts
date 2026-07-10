import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInventory, inventoryCount } from './inventory.ts';

const INV = buildInventory();

test('inventory has vocab 3525 / kanji 612 / grammar 393', () => {
  assert.equal(INV.filter(i => i.type === 'vocab').length, 3525);
  assert.equal(INV.filter(i => i.type === 'kanji').length, 612);
  assert.equal(INV.filter(i => i.type === 'grammar').length, 393);
});

test('vocab items have 2 facets: on, meaning', () => {
  const v = INV.find(i => i.type === 'vocab')!;
  assert.deepEqual(v.facets, ['on', 'meaning']);
});

test('kanji meaning facet only for meaning-clear (山 yes, 校 no)', () => {
  const yama = INV.find(i => i.id === 'kanji:山')!;
  const kou = INV.find(i => i.id === 'kanji:校')!;
  assert.ok(yama.facets.includes('kanji_meaning'));
  assert.ok(!kou.facets.includes('kanji_meaning'));
  // 読み・書きは両方にある
  for (const it of [yama, kou]) {
    assert.ok(it.facets.includes('kanji_reading'));
    assert.ok(it.facets.includes('kanji_write'));
  }
});

test('529 kanji carry the meaning facet', () => {
  const withMeaning = INV.filter(i => i.type === 'kanji' && i.facets.includes('kanji_meaning')).length;
  assert.equal(withMeaning, 529);
});

test('inventoryCount filters by level and type', () => {
  const n5v = inventoryCount(INV, 'N5', 'vocab');
  assert.ok(n5v > 0 && n5v < 3525);
});
