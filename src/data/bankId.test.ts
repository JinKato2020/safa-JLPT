import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANK, bankLevelOf } from './daimon';
import { KNOWLEDGE_BANK as KB } from './index'; // 旧 exam/knowledgeBank.json 相当(rehydrateで生のまま復元)

test('BANK の id は統一スキーム N?-{V-Y|G-B|G-N}-NNNN(用法/文法形式/並べ替え)', () => {
  assert.ok(BANK.length > 0);
  for (const b of BANK) assert.match(b.id, /^N[345]-(V-Y|G-B|G-N)-\d{4}$/); // 用法=V-Y / 文法形式=G-B / 並べ替え=G-N
});

test('BANK は ambiguous な order と passage_grammar(新セット経路へ移行)を除外した件数', () => {
  const expected = (KB as { daimon: string; ambiguous?: boolean }[])
    .filter((b) => !(b.daimon === 'order' && b.ambiguous))
    .filter((b) => b.daimon !== 'passage_grammar').length;
  assert.equal(BANK.length, expected);
});

// selectors.ts の skillWeight は kb-NNNNNN id から級を逆引きするために bankLevelOf を使う。
// バンクidは階層情報を持たない(kb-003475 のように連番のみ)ため、データから正しくlevelが引けることを検証する。
// ※サンプルは【出題される】バンク項目から採ること。旧サンプル kb-000421 は死蔵の context 項目で、
//   旧バンク解体(2026-07-17)で削除されたため落ちた。level は分割ファイルのヘッダから復元される。
test('bankLevelOf: 実データのN4エントリ(N4-G-B-0001)の級を正しく逆引きする', () => {
  const entry = (KB as { id: string; level: string }[]).find((b) => b.id === 'N4-G-B-0001');
  assert.ok(entry, 'N4-G-B-0001 が grammar_form_N4.json に存在すること');
  assert.equal(entry!.level, 'N4');
  assert.equal(bankLevelOf('N4-G-B-0001'), 'N4');
});

test('bankLevelOf: 未知のidは undefined', () => {
  assert.equal(bankLevelOf('kb-999999'), undefined);
});
