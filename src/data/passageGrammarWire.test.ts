// 文章の文法(passage_grammar)の新経路配線テスト(Task 5)。旧BANKから除外＋passageGrammar.json経路が正しく繋がっているか。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANK, daimonUnitIds, METRIC_EXCLUDED_POINTS } from './daimon';
import { PASSAGE_GRAMMAR, passageGrammarSetsFor } from './index';

test('BANK に passage_grammar が含まれない(新経路へ移行)', () => {
  assert.equal(BANK.some((b) => b.daimon === 'passage_grammar'), false);
});
test('passageGrammarSetsFor は級で絞る', () => {
  assert.ok(PASSAGE_GRAMMAR.length === 210); // 2026-08-23 N4 51-60/N3 51-70追加(N5 80/N4 60/N3 70)
  const n3 = passageGrammarSetsFor('N3');
  assert.ok(n3.length === 70 && n3.every((s) => s.level === 'N3'));
});
test('daimonUnitIds(passage_grammar) は設問idを返す(指標対象外点は母数から除外)', () => {
  const ids = daimonUnitIds('N3', 'passage_grammar', 'all');
  const n3 = passageGrammarSetsFor('N3');
  const expected = n3
    .flatMap((s) => s.questions)
    .filter((q) => !METRIC_EXCLUDED_POINTS.has((q as { pointId?: string }).pointId ?? ''))
    .map((q) => q.id);
  assert.equal(ids.length, expected.length);
  assert.deepEqual([...ids].sort(), [...expected].sort());
  assert.ok(ids.every((id) => /^N3-G-S-\d{4}-q\d$/.test(id)));
});
