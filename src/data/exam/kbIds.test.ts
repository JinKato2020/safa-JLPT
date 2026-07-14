import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWLEDGE_BANK as bank } from '../index'; // 旧 knowledgeBank.json 相当(rehydrateで生のまま復元)
import migration from './kbIdMigration.json';

const B = bank as { id: string }[];
const M = migration as Record<string, string>;

test('全エントリに一意な kb-NNNNNN id が付く', () => {
  assert.equal(B.length, 5727);
  for (const b of B) assert.match(b.id, /^kb-\d{6}$/);
  const ids = new Set(B.map((b) => b.id));
  assert.equal(ids.size, B.length);
});

test('移行マップは全件かつ全単射(旧bkId→新kbId)', () => {
  const keys = Object.keys(M);
  assert.equal(keys.length, B.length);
  const idSet = new Set(B.map((b) => b.id));
  const vals = Object.values(M);
  for (const v of vals) assert.ok(idSet.has(v), `未知の新id: ${v}`);
  assert.equal(new Set(vals).size, vals.length); // 値も一意=全単射
});
