import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateReadingIds } from './storage';
import migration from '../data/exam/readingIdMigration.json';

const M = migration as Record<string, string>;
const [oldQid, newQid] = Object.entries(M)[0];

test('読解 旧設問idを新id(<文章ID>-qK)へ改名し、他キーは保持', () => {
  const items = { [oldQid]: 1, 'kb-000001': 2, 'ZZ-not-a-reading-id': 3 } as Record<string, number>;
  const out = migrateReadingIds(items);
  assert.equal(out[newQid], 1);
  assert.equal(out[oldQid], undefined);
  assert.equal(out['kb-000001'], 2);
  assert.equal(out['ZZ-not-a-reading-id'], 3);
});

test('冪等: 2回適用しても同じ(既に新idなら不変)', () => {
  const items = { [oldQid]: 1 } as Record<string, number>;
  const once = migrateReadingIds(items);
  const twice = migrateReadingIds(once);
  assert.deepEqual(twice, once);
});

test('移行マップは新旧idが重複せず、値も一意(安全な改名)', () => {
  const olds = Object.keys(M);
  const news = Object.values(M);
  assert.equal(new Set(news).size, news.length, '新idに重複');
  const oldSet = new Set(olds);
  assert.ok(news.every((n) => !oldSet.has(n)), '新idが旧idと衝突');
  // 新idは必ず「<文章ID>-qK」形＝ Lv-D-{S/M/L/J}-NNN-qK。
  assert.ok(news.every((n) => /^N[345]-D-[SMLJ]-\d{3}-q\d+$/.test(n)), '新idの形式不正');
});
