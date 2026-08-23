// 言い換え類義「真のカバー率」の母数=iikaePossible.json の番人。
// 実行: node --import tsx --test src/data/iikaePossible.test.ts
// 狙い: ①全語彙(3541)を過不足なく分類 ②p∈{0,1} ③counts が実データと一致(ドリフト防止)
//       ④既存synonym問題を持つ語は必ずp=1(問題が実在=定義上言い換え可能・正直化の要)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const R = (p: string) => JSON.parse(readFileSync(join('src/data', p), 'utf8'));
type V = { id: string; level: 'N5' | 'N4' | 'N3' };
const vocab: V[] = R('shared/vocab.json');
const poss: { counts: Record<string, { possible: number; total: number }>; items: Record<string, { p: number; syn: string }> } = R('shared/iikaePossible.json');
const LV = ['N5', 'N4', 'N3'] as const;

test('全語彙を過不足なく分類・p∈{0,1}', () => {
  const ids = new Set(vocab.map((v) => v.id));
  assert.equal(Object.keys(poss.items).length, vocab.length, '分類件数が語彙数と不一致');
  for (const v of vocab) {
    const it = poss.items[v.id];
    assert.ok(it, `未分類: ${v.id}`);
    assert.ok(it.p === 0 || it.p === 1, `p が0/1でない: ${v.id}`);
  }
  for (const id of Object.keys(poss.items)) assert.ok(ids.has(id), `語彙に無いid: ${id}`);
});

test('counts が実データと一致(レベル別 真の母数)', () => {
  const lvlOf = new Map(vocab.map((v) => [v.id, v.level]));
  const total: Record<string, number> = { N5: 0, N4: 0, N3: 0 };
  const pos: Record<string, number> = { N5: 0, N4: 0, N3: 0 };
  for (const v of vocab) {
    total[v.level]++;
    if (poss.items[v.id].p === 1) pos[v.level]++;
  }
  for (const lv of LV) {
    assert.equal(poss.counts[lv].total, total[lv], `${lv} total ドリフト`);
    assert.equal(poss.counts[lv].possible, pos[lv], `${lv} possible ドリフト`);
  }
  void lvlOf;
});

test('既存synonym問題を持つ語は必ずp=1', () => {
  for (const lv of LV) {
    const items: { vocabId?: string }[] = R(`../../content/problems/moji_goi/synonym_${lv}.json`).items;
    for (const it of items) {
      const vid = it.vocabId;
      if (vid && poss.items[vid]) assert.equal(poss.items[vid].p, 1, `synonym問題ありなのにp=0: ${vid}`);
    }
  }
});
