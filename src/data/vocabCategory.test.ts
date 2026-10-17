import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VOCAB } from './index.ts';
import { CAT_BY_ID } from './categories.ts';

const map = JSON.parse(
  fs.readFileSync(new URL('./dict/vocabCategory.json', import.meta.url), 'utf8'),
) as Record<string, string>;

// 非自立で文法にもある24語=語彙分類から除外(文法へ移管)
const EXCLUDE = new Set([
  'n5-v-96', 'n5-v-181', 'n5-v-227', 'n5-v-269', 'n5-v-315', 'n5-v-332', 'n5-v-337', 'n5-v-380',
  'n5-v-433', 'n5-v-486', 'n5-v-622', 'n5-v-495', 'n4-v-43', 'n4-v-188', 'n4-v-249', 'n4-v-387',
  'n4-v-441', 'n4-v-444', 'n4-v-588', 'n4-v-643', 'n4-v-514', 'n4-v-528', 'n5-v-409', 'n5-v-443',
]);

test('移管24除く全語がちょうど1小テーマ(kind vocab)に属す', () => {
  for (const v of VOCAB) {
    if (EXCLUDE.has(v.id)) {
      assert.ok(!map[v.id], `移管語が割当済: ${v.id}`);
      continue;
    }
    const cid = map[v.id];
    assert.ok(cid, `未割当: ${v.id} ${v.word}`);
    assert.equal(CAT_BY_ID[cid]?.kind, 'vocab', `無効小テーマ: ${v.id}=${cid}`);
  }
});
