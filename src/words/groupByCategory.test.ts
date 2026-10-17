import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByCategory } from './groupByCategory.ts';

test('groupByCategory: taxonomy順・空カテゴリ除外・keyOfで割当', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const map = { a: 'action', b: 'nature', c: 'nature' }; // natureが先(order小)
  const secs = groupByCategory(items, map, (i) => i.id, 'kanji');
  assert.deepEqual(secs.map((s) => s.catId), ['nature', 'action']); // order昇順
  assert.equal(secs[0].data.length, 2);
  assert.equal(secs[0].label, '自然・天地');
});
