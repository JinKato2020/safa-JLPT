import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateBankIds } from './storage';
import migration from '../data/exam/kbIdMigration.json';

const M = migration as Record<string, string>;
const [oldKey, newId] = Object.entries(M)[0];

test('bk:キーを新idへ改名し、他キーは保持', () => {
  // 'kb-999999' はダミー(移行マップの実データに存在しないid)で衝突を避ける。
  // 実データではマップの先頭エントリがたまたま 'kb-000001' に移行するため、
  // そのリテラルを既移行キーの検証に使うと migrateBankIds の出力と衝突し偽陽性の失敗を招く。
  const items = { [oldKey]: 1, 'n5-v-1#context': 2, 'kb-999999': 3 } as Record<string, number>;
  const out = migrateBankIds(items);
  assert.equal(out[newId], 1);
  assert.equal(out[oldKey], undefined);
  assert.equal(out['n5-v-1#context'], 2);
  assert.equal(out['kb-999999'], 3);
});

test('冪等: 2回適用しても同じ', () => {
  const items = { [oldKey]: 1 } as Record<string, number>;
  const once = migrateBankIds(items);
  const twice = migrateBankIds(once);
  assert.deepEqual(twice, once);
});
