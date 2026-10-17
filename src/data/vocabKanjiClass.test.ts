// 漢字語彙/かな語彙 分類(vocabKanjiClass.json)＋漢字級表(kanjiJlptLevel.json)の番人。
// 実行: node --import tsx --test src/data/vocabKanjiClass.test.ts
// 狙い: ①全語彙(3541)を過不足なく分類 ②class値が正当 ③kanji級のtestLevel=max(語彙級,最上位漢字級)で再計算一致
//       ④kanjiJlptLevelが語彙の全漢字を網羅・級∈{N5,N4,N3,BEYOND} ⑤testLevelCountsがドリフトしていない(metricExcluded除外)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const R = (p: string) => JSON.parse(readFileSync(join('src/data', p), 'utf8'));
type V = { id: string; level: 'N5' | 'N4' | 'N3'; word: string };
const vocab: V[] = R('shared/vocab.json');
const cls: { testLevelCounts: Record<string, number>; items: Record<string, { class: string; testLevel?: string; kanjiLevels?: Record<string, string>; beyondKanji?: string[] }> } = R('shared/vocabKanjiClass.json');
const kjl: { items: Record<string, string> } = R('dict/kanjiJlptLevel.json');
const excl: { items: { vocabId: string }[] } = R('shared/vocabMetricExcluded.json');
const ORDER: Record<string, number> = { N5: 0, N4: 1, N3: 2 };
const LV = ['N5', 'N4', 'N3'] as const;
const kanjiOf = (w: string) => [...w.replace(/[～~]/g, '')].filter((c) => /[一-鿿]/.test(c));

test('全語彙を過不足なく分類・class値が正当', () => {
  const ids = new Set(vocab.map((v) => v.id));
  assert.equal(Object.keys(cls.items).length, vocab.length, '分類件数が語彙数と不一致');
  const OK = new Set(['kanji', 'kana', 'kana_only', 'katakana']);
  for (const v of vocab) {
    const it = cls.items[v.id];
    assert.ok(it, `未分類: ${v.id}`);
    assert.ok(OK.has(it.class), `不正なclass: ${v.id}=${it.class}`);
  }
  for (const id of Object.keys(cls.items)) assert.ok(ids.has(id), `語彙に無いid: ${id}`);
});

test('kanjiJlptLevel が語彙の全漢字を網羅・級が正当', () => {
  const allowed = new Set(['N5', 'N4', 'N3', 'BEYOND']);
  for (const l of Object.values(kjl.items)) assert.ok(allowed.has(l), `不正な漢字級: ${l}`);
  for (const v of vocab) for (const c of kanjiOf(v.word)) assert.ok(kjl.items[c], `漢字級表に無い漢字: ${c} (${v.id})`);
});

test('class と testLevel を漢字級表から再計算して一致(ドリフト防止)', () => {
  for (const v of vocab) {
    const it = cls.items[v.id];
    const ks = kanjiOf(v.word);
    if (ks.length === 0) {
      assert.ok(it.class === 'kana' || it.class === 'katakana', `漢字なしなのに${it.class}: ${v.id}`);
      continue;
    }
    const levels = ks.map((c) => kjl.items[c]);
    if (levels.includes('BEYOND')) {
      assert.equal(it.class, 'kana_only', `範囲外漢字ありなのにkana_onlyでない: ${v.id}`);
    } else {
      assert.equal(it.class, 'kanji', `全漢字がN5-N3なのにkanjiでない: ${v.id}`);
      const exp = LV[Math.max(...levels.map((l) => ORDER[l]), ORDER[v.level])];
      assert.equal(it.testLevel, exp, `testLevel不一致: ${v.id} 期待${exp} 実${it.testLevel}`);
    }
  }
});

test('testLevelCounts が実データと一致(metricExcluded除外)', () => {
  const ex = new Set(excl.items.map((x) => x.vocabId));
  const cnt: Record<string, number> = {};
  for (const v of vocab) {
    if (ex.has(v.id)) continue;
    const it = cls.items[v.id];
    if (it.class === 'kanji' && it.testLevel) cnt[it.testLevel] = (cnt[it.testLevel] || 0) + 1;
  }
  for (const lv of LV) assert.equal(cls.testLevelCounts[lv] || 0, cnt[lv] || 0, `${lv} testLevelCount ドリフト`);
});
