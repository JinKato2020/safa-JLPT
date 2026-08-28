import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInventory, inventoryCount } from './inventory.ts';

const INV = buildInventory();

// 在庫数は語彙を足すたびに動く。3525→3541 は表記のカタカナ孤児16問(コーラ/サッカー等)を
// 救うため語彙を追加したもの(2026-07-17)。増減した時はここを更新する＝意図しない増減を検知する番人。
test('inventory has vocab 3541 / kanji 612 / grammar 409', () => {
  assert.equal(INV.filter(i => i.type === 'vocab').length, 3541);
  assert.equal(INV.filter(i => i.type === 'kanji').length, 612);
  // 393→403→408→409→408: pointId未割当の実在文法を辞書化＋passage null解消＋n5-g-92分離で増、
  // 2026-08 「ましょう」(n5-g-32)を n5-g-87 へ統合し1点減(commit 31c856a9)→408。
  assert.equal(INV.filter(i => i.type === 'grammar').length, 408);
});

test('vocab items have 2 facets: on, meaning', () => {
  const v = INV.find(i => i.type === 'vocab')!;
  assert.deepEqual(v.facets, ['on', 'meaning']);
});

test('kanji meaning facet: 方針A(2026-08-28)で全字に意味面(山も校も辞書glossあり)', () => {
  const yama = INV.find(i => i.id === 'kanji:山')!;
  const kou = INV.find(i => i.id === 'kanji:校')!;
  // 旧: 音のみ字(校)は意味面なし → 方針Aで辞書glossがあれば全字に意味面。
  assert.ok(yama.facets.includes('kanji_meaning'));
  assert.ok(kou.facets.includes('kanji_meaning'));
  // 読み・書きは両方にある
  for (const it of [yama, kou]) {
    assert.ok(it.facets.includes('kanji_reading'));
    assert.ok(it.facets.includes('kanji_write'));
  }
});

test('全612字が意味面を持つ(方針A: 辞書glossで判定)', () => {
  const withMeaning = INV.filter(i => i.type === 'kanji' && i.facets.includes('kanji_meaning')).length;
  assert.equal(withMeaning, 612);
});

test('inventoryCount filters by level and type', () => {
  const n5v = inventoryCount(INV, 'N5', 'vocab');
  assert.ok(n5v > 0 && n5v < 3541);
});
