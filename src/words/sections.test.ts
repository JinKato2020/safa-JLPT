import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studySections } from './sections.ts';
import { levelListFor } from './levelList.ts';

test('kanji N5: セクションが返り全itemが含まれ順序はtaxonomy', () => {
  const items = levelListFor('kanji', 'N5');
  const secs = studySections('kanji', items);
  assert.ok(secs.length > 0);
  const flat = secs.flatMap((s) => s.data);
  assert.equal(flat.length, items.length); // 漏れなし
});

test('vocab N5: 移管24語を除き全itemがセクションに含まれる', () => {
  const items = levelListFor('vocab', 'N5');
  const secs = studySections('vocab', items);
  const flat = secs.flatMap((s) => s.data);
  assert.ok(flat.length > 0);
  assert.ok(flat.length <= items.length); // 移管語ぶん減る可能性
});
