// 同梱字形データのルックアップ。実行: node --import tsx --test src/kakitori/charData.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCharData, hasCharData } from './charData.ts';

test('存在する漢字はstrokes/mediansを返す', async () => {
  const s = await fetchCharData('海');
  const o = JSON.parse(s);
  assert.ok(Array.isArray(o.strokes) && o.strokes.length > 0);
  assert.ok(Array.isArray(o.medians) && o.medians.length === o.strokes.length);
});
test('hasCharData は収録有無を返す', () => {
  assert.equal(hasCharData('海'), true);
  assert.equal(hasCharData('\u{20000}'), false); // 収録外
});
test('収録外はreject', async () => {
  await assert.rejects(() => fetchCharData('\u{20000}'));
});
