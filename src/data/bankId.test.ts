import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANK, bankLevelOf } from './daimon';
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

// selectors.ts の skillWeight は kb-NNNNNN id から級を逆引きするために bankLevelOf を使う。
// バンクidは階層情報を持たない(kb-000421 のように連番のみ)ため、データから正しくlevelが引けることを検証する。
test('bankLevelOf: 実データのN4エントリ(kb-000421)の級を正しく逆引きする', () => {
  const entry = (KB as { id: string; level: string }[]).find((b) => b.id === 'kb-000421');
  assert.ok(entry, 'kb-000421 が knowledgeBank.json に存在すること');
  assert.equal(entry!.level, 'N4');
  assert.equal(bankLevelOf('kb-000421'), 'N4');
});

test('bankLevelOf: 未知のidは undefined', () => {
  assert.equal(bankLevelOf('kb-999999'), undefined);
});
