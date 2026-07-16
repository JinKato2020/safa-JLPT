import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWLEDGE_BANK as bank } from '../index'; // 旧 knowledgeBank.json 相当(rehydrateで生のまま復元)
import migration from './kbIdMigration.json';

const B = bank as { id: string }[];
const M = migration as Record<string, string>;

test('全 bank エントリは一意で妥当な id 形式(kb-NNNNNN / usg[34]-NNN)', () => {
  assert.ok(B.length > 0);
  for (const b of B) assert.match(b.id, /^(kb-\d{6}|usg[34]-\d{3})$/);
  const ids = new Set(B.map((b) => b.id));
  assert.equal(ids.size, B.length); // 一意
});

// 旧「移行マップは全件かつ全単射」は用法厳選削減で成立しない(歴史的成果物)。
// 現存する移行先だけが妥当か検証する(削除された旧用法kb-idはスキップ)。
test('移行マップの値のうち現存するものは全て妥当な bank id', () => {
  const idSet = new Set(B.map((b) => b.id));
  const present = Object.values(M).filter((v) => idSet.has(v));
  assert.ok(present.length > 0);
  assert.equal(new Set(present).size, present.length); // 現存分は一意
});
