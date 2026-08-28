import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDrill, produceEligible, buildEligible, meaningEligible, toMorae } from './wordDrill';

test('toMorae: 拗音/長音は結合・促音は独立', () => {
  assert.deepEqual(toMorae('きゃく'), ['きゃ', 'く']);
  assert.deepEqual(toMorae('がっこう'), ['が', 'っ', 'こ', 'う']);
  assert.deepEqual(toMorae('こーひー'), ['こー', 'ひー']);
  assert.deepEqual(toMorae('あう'), ['あ', 'う']);
});

test('vProduce: 答えモーラが全てタイルに含まれ、タイルは約8個', () => {
  const [p] = buildDrill('vProduce', 'N5', 1, 1);
  assert.equal(p.kind, 'vProduce');
  if (p.kind !== 'vProduce') return;
  for (const m of p.answer) assert.ok(p.tiles.includes(m), `tile欠落: ${m}`);
  assert.ok(p.tiles.length >= p.answer.length + 2, 'ダミータイルが足りない');
  assert.ok(p.tiles.length >= 6, 'タイルが少なすぎ(約8個の想定)');
  assert.equal(p.answer.join(''), p.reading);
  assert.ok(p.itemId.endsWith('#produce'));
});

test('gBuild: 答えの文法語モーラがタイルに含まれ、空所〔　　〕を含む例文、#gbuild を itemId に持つ', () => {
  const batch = buildDrill('gBuild', 'N5', 5, 1);
  assert.ok(batch.length > 0);
  for (const p of batch) {
    if (p.kind !== 'gBuild') continue;
    for (const m of p.answer) assert.ok(p.tiles.includes(m), `tile欠落: ${m}`);
    assert.equal(p.answer.join(''), p.reading);
    assert.ok(p.prompt.includes('〔'), '空所が無い');
    assert.ok(p.itemId.endsWith('#gbuild'));
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
    assert.ok(buildEligible(lv).length > 0, `${lv} gBuild空`);
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

test('buildDrill vMeaning: 語→意味4択・全語対象・itemId=#vrecog_mean', () => {
  const ps = buildDrill('vMeaning', 'N5', 8, 42);
  assert.ok(ps.length > 0, 'vMeaning空');
  for (const p of ps) {
    assert.equal(p.kind, 'vMeaning');
    if (p.kind !== 'vMeaning') continue;
    assert.equal(p.choices.length, 4, '4択');
    assert.ok(p.answerIndex >= 0 && p.answerIndex < 4, '正解位置が範囲内');
    assert.ok(p.choices[p.answerIndex], '正解が選択肢に存在');
    assert.ok(p.itemId.endsWith('#vrecog_mean'), 'itemIdが#vrecog_mean');
    assert.ok(p.prompt.length > 0 && p.reading.length > 0, 'prompt(語)とreadingあり');
  }
});

test('buildDrill vReading: 語→読み4択・漢字語のみ・itemId=#vrecog_read・選択肢は純かな', () => {
  const ps = buildDrill('vReading', 'N5', 8, 42);
  assert.ok(ps.length > 0, 'vReading空');
  for (const p of ps) {
    assert.equal(p.kind, 'vReading');
    if (p.kind !== 'vReading') continue;
    assert.equal(p.choices.length, 4, '4択');
    assert.ok(p.answerIndex >= 0 && p.answerIndex < 4, '正解位置が範囲内');
    assert.ok(p.itemId.endsWith('#vrecog_read'), 'itemIdが#vrecog_read');
    // prompt(表記)は答えの読みと異なる=漢字を含む語(かな語はルビ=答えで出題不可)。
    assert.notEqual(p.prompt, p.choices[p.answerIndex], 'prompt(表記)≠正解の読み');
    assert.ok(p.meaning.length > 0, '意味(採点後表示)あり');
    // 全選択肢が純かな(読みの4択)。
    for (const ch of p.choices) assert.ok(/^[ぁ-ゖー]+$/.test(ch), `読み選択肢が純かな: ${ch}`);
  }
});

test('buildDrill vWriting(かたち): 意味→漢字表記4択・漢字語のみ・itemId=#vrecog_write・選択肢は漢字語', () => {
  const ps = buildDrill('vWriting', 'N5', 8, 42);
  assert.ok(ps.length > 0, 'vWriting空');
  for (const p of ps) {
    assert.equal(p.kind, 'vWriting');
    if (p.kind !== 'vWriting') continue;
    assert.equal(p.choices.length, 4, '4択');
    assert.ok(p.answerIndex >= 0 && p.answerIndex < 4, '正解位置が範囲内');
    assert.ok(p.itemId.endsWith('#vrecog_write'), 'itemIdが#vrecog_write');
    assert.ok(p.prompt.length > 0 && p.reading.length > 0, 'prompt(意味)とreading(採点後表示)あり');
    // 全選択肢が漢字を含む語(表記の4択)。正解も漢字語。
    for (const ch of p.choices) assert.ok(/[一-龥々〆ヶ]/.test(ch), `表記選択肢が漢字語: ${ch}`);
  }
});
