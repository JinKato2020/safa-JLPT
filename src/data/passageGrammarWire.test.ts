// 文章の文法(passage_grammar)の新経路配線テスト(Task 5)。旧BANKから除外＋passageGrammar.json経路が正しく繋がっているか。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANK, daimonUnitIds } from './daimon';
import { PASSAGE_GRAMMAR, passageGrammarSetsFor } from './index';

test('BANK に passage_grammar が含まれない(新経路へ移行)', () => {
  assert.equal(BANK.some((b) => b.daimon === 'passage_grammar'), false);
});
test('passageGrammarSetsFor は級で絞る', () => {
  assert.ok(PASSAGE_GRAMMAR.length === 200); // 2026-07-19 新問題へ全面差し替え(N5 80/N4 80/N3 40)
  const n3 = passageGrammarSetsFor('N3');
  assert.ok(n3.length === 40 && n3.every((s) => s.level === 'N3'));
});
test('daimonUnitIds(passage_grammar) はセットの全設問idを返す(母数=リング/カバー率分母)', () => {
  const ids = daimonUnitIds('N3', 'passage_grammar', 'all');
  const n3 = passageGrammarSetsFor('N3');
  const expected = n3.flatMap((s) => s.questions.map((q) => q.id));
  assert.equal(ids.length, expected.length);
  assert.deepEqual([...ids].sort(), [...expected].sort());
  assert.ok(ids.every((id) => /^pg-N3-\d{3}-q\d$/.test(id)));
});
