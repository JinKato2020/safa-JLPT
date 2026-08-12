// 指標対象外の文法点(本文非依存の活用ドリル n5-g-92 等)は、出題はするが
// 学習指標(母数/カバー率/予想得点)から除外される。CLAUDE.md §1 の方針の番人。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daimonUnitIds, METRIC_EXCLUDED_POINTS } from './daimon.ts';
import { passageGrammarSetsFor } from './index.ts';

test('指標対象外の点は passage の母数(daimonUnitIds)から除外される', () => {
  assert.ok(METRIC_EXCLUDED_POINTS.size >= 1, '除外集合が空でない');
  for (const lv of ['N5', 'N4', 'N3'] as const) {
    const excluded = new Set(
      passageGrammarSetsFor(lv)
        .flatMap((s) => s.questions)
        .filter((q) => METRIC_EXCLUDED_POINTS.has((q as { pointId?: string }).pointId ?? ''))
        .map((q) => q.id),
    );
    const denom = new Set(daimonUnitIds(lv, 'passage_grammar', 'all'));
    for (const id of excluded) assert.ok(!denom.has(id), `${id} は指標母数から除外されるべき`);
  }
});
