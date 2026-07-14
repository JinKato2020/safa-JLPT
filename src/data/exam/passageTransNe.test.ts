import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASSAGE_TRANS_NE as trans, READING as reading, PASSAGE_GRAMMAR as pg } from '../index'; // rehydrate由来(旧 exam/*.json 相当)

const T = trans as Record<string, string[]>;

test('全 reading ＋ 文章の文法 セットに非空のネパール語訳(本文数一致)がある', () => {
  const expect: Record<string, number> = {};
  for (const r of reading as any[]) expect[r.id] = 1;
  for (const s of pg as any[]) expect[s.id] = s.passages.length;
  const missing: string[] = [];
  const badLen: string[] = [];
  const empty: string[] = [];
  for (const id in expect) {
    const v = T[id];
    if (!v) { missing.push(id); continue; }
    if (v.length !== expect[id]) badLen.push(id);
    for (const s of v) if (!s || !/[ऀ-ॿ]/.test(s)) empty.push(id); // Devanagari必須
  }
  assert.equal(missing.length, 0, `訳欠落: ${missing.slice(0, 5)}`);
  assert.equal(badLen.length, 0, `本文数不一致: ${badLen.slice(0, 5)}`);
  assert.equal([...new Set(empty)].length, 0, `空/非デーヴァナーガリー: ${[...new Set(empty)].slice(0, 5)}`);
  assert.equal(Object.keys(T).length, Object.keys(expect).length);
});
