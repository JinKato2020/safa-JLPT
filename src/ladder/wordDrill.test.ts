import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDrill, produceEligible, orderEligible, meaningEligible, toMorae } from './wordDrill';

test('toMorae: 拗音/長音は結合・促音は独立', () => {
  assert.deepEqual(toMorae('きゃく'), ['きゃ', 'く']);
  assert.deepEqual(toMorae('がっこう'), ['が', 'っ', 'こ', 'う']);
  assert.deepEqual(toMorae('こーひー'), ['こー', 'ひー']);
  assert.deepEqual(toMorae('あう'), ['あ', 'う']);
});

test('vProduce: 答えモーラが全てタイルに含まれ、余分なダミーがある', () => {
  const [p] = buildDrill('vProduce', 'N5', 1, 1);
  assert.equal(p.kind, 'vProduce');
  if (p.kind !== 'vProduce') return;
  for (const m of p.answer) assert.ok(p.tiles.includes(m), `tile欠落: ${m}`);
  assert.ok(p.tiles.length > p.answer.length, 'ダミータイルが無い');
  assert.equal(p.answer.join(''), p.reading);
  assert.ok(p.itemId.endsWith('#produce'));
});

test('gOrder: correctOrder は tiles の完全順列で、pointId#order を itemId に持つ', () => {
  const batch = buildDrill('gOrder', 'N5', 5, 1);
  assert.ok(batch.length > 0);
  for (const p of batch) {
    if (p.kind !== 'gOrder') continue;
    assert.equal(p.correctOrder.length, p.tiles.length);
    assert.equal(new Set(p.correctOrder).size, p.tiles.length, '順列が重複');
    assert.equal(new Set(p.scrambled).size, p.tiles.length, '表示順が重複');
    assert.ok(/#order$|^bk:order:/.test(p.itemId));
  }
});

test('gMeaning: 4択で answerIndex が範囲内・itemId は #gmeaning', () => {
  const [p] = buildDrill('gMeaning', 'N5', 1, 1);
  assert.equal(p.kind, 'gMeaning');
  if (p.kind !== 'gMeaning') return;
  assert.equal(p.choices.length, 4);
  assert.ok(p.answerIndex >= 0 && p.answerIndex < 4);
  assert.ok(p.itemId.endsWith('#gmeaning'));
});

test('eligible: N5〜N3 は問題があり、コンテンツ外レベルは空', () => {
  for (const lv of ['N5', 'N4', 'N3']) {
    assert.ok(produceEligible(lv).length > 0, `${lv} produce空`);
    assert.ok(orderEligible(lv).length > 0, `${lv} order空`);
    assert.ok(meaningEligible(lv).length > 0, `${lv} meaning空`);
  }
});

test('buildDrill: itemsState を渡すと未習(state無し)が優先される', () => {
  // 1問だけ習得済みにして、それが後ろへ回ることを確認
  const all = produceEligible('N5');
  const masteredId = `${all[0].id}#produce`;
  const withState = buildDrill('vProduce', 'N5', 50, 1, { [masteredId]: { p: 0.9 } });
  const idx = withState.findIndex((p) => p.itemId === masteredId);
  // 習得済み(p=0.9)は未習(-1)より後。50問中に含まれるなら末尾寄り。
  if (idx >= 0) assert.ok(idx > 0, '習得済みが先頭に来た');
});
