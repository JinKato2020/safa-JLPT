import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GRAMMAR } from './index.ts';
import { CAT_BY_ID } from './categories.ts';

const map = JSON.parse(
  fs.readFileSync(new URL('./grammarCategory.json', import.meta.url), 'utf8'),
) as Record<string, string>;

test('全文法点がちょうど1機能(kind grammar)に属す', () => {
  for (const g of GRAMMAR) {
    const cid = map[g.id];
    assert.ok(cid, `未割当: ${g.id}`);
    assert.equal(CAT_BY_ID[cid]?.kind, 'grammar', `無効機能: ${g.id}=${cid}`);
  }
});
