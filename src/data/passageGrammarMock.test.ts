// 文章の文法(⑧)の模試専用プール(pool='mock'・初見・セット形式)の中身を守る番人。
// 【このテストが守るもの】模試の文章の文法が「公式同等の形」を保つこと＝
//  ・各級のセット数(N5:10/N4:10/N3:10=公式1セット×10回) ・1セット5設問・blankNo 1..5
//  ・本文に空所マーカー【n】が各1回 ・N5=2ブロック / N4・N3=1ブロック
//  ・4択で重複なし・answerIndex 有効 ・pointId が grammar.json に実在
//  ・id帯 セット N{lv}-G-SM-#### / 設問 ...-q1..q5 ・セット/設問id が級内で一意。
import test from 'node:test';
import assert from 'node:assert/strict';
import { PASSAGE_GRAMMAR_MOCK, GRAMMAR, passageGrammarMockSetsFor } from './index.ts';

const EXPECT: Record<string, number> = { N5: 10, N4: 10, N3: 10 };
const BLOCKS: Record<string, number> = { N5: 2, N4: 1, N3: 1 };
const validPid = new Set(GRAMMAR.map((g) => g.id));
type PGSet = { id: string; level: string; passages: { body: string }[]; questions: { id: string; blankNo: number; choices: string[]; answerIndex: number; pointId: string }[] };
const pool = (lv: string) => (PASSAGE_GRAMMAR_MOCK as unknown as PGSet[]).filter((e) => e.level === lv);

for (const [lv, n] of Object.entries(EXPECT)) {
  test(`文章の文法模試${lv}: セット数が${n}(公式×10回)`, () => {
    assert.equal(pool(lv).length, n);
    assert.equal(passageGrammarMockSetsFor(lv).length, n);
  });

  test(`文章の文法模試${lv}: 5設問・blankNo1..5・本文に【n】各1回・${BLOCKS[lv]}ブロック・4択相異・answerIndex有効・pointId実在・id帯・id一意`, () => {
    const seenSet = new Set<string>();
    const seenQ = new Set<string>();
    for (const s of pool(lv)) {
      assert.ok(new RegExp(`^${lv}-G-SM-\\d{4}$`).test(s.id), `${s.id}: セットid帯が不正`);
      assert.ok(!seenSet.has(s.id), `${s.id}: セットidが級内で重複`);
      seenSet.add(s.id);
      assert.equal(s.passages.length, BLOCKS[lv], `${s.id}: ブロック数が${BLOCKS[lv]}でない`);
      assert.equal(s.questions.length, 5, `${s.id}: 設問が5でない`);
      const body = s.passages.map((p) => p.body).join('');
      const blankNos = s.questions.map((q) => q.blankNo).sort((a, b) => a - b);
      assert.deepEqual(blankNos, [1, 2, 3, 4, 5], `${s.id}: blankNoが1..5でない`);
      for (const q of s.questions) {
        assert.equal(body.split(`【${q.blankNo}】`).length - 1, 1, `${q.id}: 本文に【${q.blankNo}】が1回でない`);
        assert.equal(q.choices.length, 4, `${q.id}: 4択でない`);
        assert.equal(new Set(q.choices).size, 4, `${q.id}: 選択肢が重複`);
        assert.ok(q.answerIndex >= 0 && q.answerIndex < 4, `${q.id}: answerIndexが無効`);
        assert.ok(validPid.has(q.pointId), `${q.id}: pointId ${q.pointId} が grammar.json に不在`);
        assert.ok(new RegExp(`^${lv}-G-SM-\\d{4}-q[1-5]$`).test(q.id), `${q.id}: 設問id帯が不正`);
        assert.ok(!seenQ.has(q.id), `${q.id}: 設問idが級内で重複`);
        seenQ.add(q.id);
      }
    }
  });
}
