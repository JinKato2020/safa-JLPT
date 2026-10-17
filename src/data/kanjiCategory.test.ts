import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KANJI } from './index.ts';
import { CAT_BY_ID } from './categories.ts';

const map = JSON.parse(
  fs.readFileSync(new URL('./dict/kanjiCategory.json', import.meta.url), 'utf8'),
) as Record<string, string>;

test('全漢字がちょうど1傘に属す・傘は漢字kind', () => {
  for (const k of KANJI) {
    const cid = map[k.char];
    assert.ok(cid, `未割当: ${k.char}`);
    assert.equal(CAT_BY_ID[cid]?.kind, 'kanji', `無効傘: ${k.char}=${cid}`);
  }
});
