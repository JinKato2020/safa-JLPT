import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASSAGE_GRAMMAR as sets } from '../index'; // 旧 passageGrammar.json 相当(rehydrate由来)
import grammar from '../shared/grammar.json';

const S = sets as any[];
const gids = new Set((grammar as any[]).map((g) => g.id));

test('200セット・N5 80/N4 80/N3 40', () => {
  assert.equal(S.length, 200); // 2026-07-19 新問題へ全面差し替え
  const by: Record<string, number> = {};
  for (const s of S) by[s.level] = (by[s.level] || 0) + 1;
  assert.deepEqual(by, { N5: 80, N4: 80, N3: 40 });
});

test('セットid一意', () => {
  const ids = S.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('各セット: 設問5・空欄対応・pointId解決・4択・N5は2文', () => {
  for (const s of S) {
    assert.equal(s.kind, 'passage_grammar');
    assert.equal(s.questions.length, 5);
    if (s.level === 'N5') assert.equal(s.passages.length, 2);
    else assert.equal(s.passages.length, 1);
    const body = s.passages.map((p: any) => p.body).join('\n');
    const blanks = s.questions.map((q: any) => q.blankNo);
    assert.equal(new Set(blanks).size, blanks.length, `${s.id} blankNo重複`);
    for (const q of s.questions) {
      assert.ok(body.includes(`【${q.blankNo}】`), `${s.id} 本文に【${q.blankNo}】`);
      assert.equal(q.choices.length, 4, `${s.id}:${q.blankNo} 4択`);
      assert.equal(new Set(q.choices).size, q.choices.length, `${s.id}:${q.blankNo} 選択肢重複`);
      assert.ok(q.answerIndex >= 0 && q.answerIndex < q.choices.length);
      assert.ok(q.pointId && gids.has(q.pointId), `${s.id}:${q.blankNo} pointId`);
    }
  }
});
