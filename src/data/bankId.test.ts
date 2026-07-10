import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANK } from './daimon';
import KB from './exam/knowledgeBank.json';

test('BANK の id は data 由来 kb-NNNNNN', () => {
  assert.ok(BANK.length > 0);
  for (const b of BANK) assert.match(b.id, /^kb-\d{6}$/);
});

test('BANK は ambiguous な order を除外した件数', () => {
  const expected = (KB as { daimon: string; ambiguous?: boolean }[])
    .filter((b) => !(b.daimon === 'order' && b.ambiguous)).length;
  assert.equal(BANK.length, expected);
});
