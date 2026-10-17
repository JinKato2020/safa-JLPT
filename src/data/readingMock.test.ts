// 読解4大問(内容理解 短/中/長・情報検索)の模試専用プール(pool='mock'・初見)を守る番人。
// 【このテストが守るもの】模試の読解が「公式同等の構成」を保つこと＝
//  ・各級×小区分の本文数/設問数(公式出題数×10回) ・id一意 ・id帯 N{lv}-D-{S|M|L|J}-9###
//  ・choices4相異 ・answerIndex(内容理解=0[描画時シャッフル]/情報検索=0..3) ・subtype正当
//  ・readingMockItemsForSub がプールと一致。翻訳/ルビは後日OTAバッチ(このテストは訳を要求しない)。
import test from 'node:test';
import assert from 'node:assert/strict';
import { READING_MOCK, readingMockItemsForSub, readingSubtype, type ReadingSubtype } from './index.ts';

// (level,subtype)→[本文数,設問数]。公式出題数×10回(dokkai-mock-inflight §1)。
const EXPECT: Record<ReadingSubtype, Record<string, [number, number]>> = {
  naiyou_tan: { N5: [30, 30], N4: [40, 40], N3: [40, 40] },
  naiyou_chu: { N5: [10, 20], N4: [10, 40], N3: [20, 60] },
  choubun: { N3: [10, 40] },
  joho: { N5: [10, 10], N4: [20, 20], N3: [20, 20] },
};
const SUBCHAR: Record<ReadingSubtype, string> = { naiyou_tan: 'S', naiyou_chu: 'M', choubun: 'L', joho: 'J' };

for (const sub of Object.keys(EXPECT) as ReadingSubtype[]) {
  for (const [lv, [nItems, nQ]] of Object.entries(EXPECT[sub])) {
    test(`読解模試 ${sub} ${lv}: 本文${nItems}/設問${nQ}(公式×10回)`, () => {
      const pool = readingMockItemsForSub(lv as never, sub);
      assert.equal(pool.length, nItems, `${sub} ${lv}: 本文数`);
      assert.equal(pool.reduce((s, p) => s + p.questions.length, 0), nQ, `${sub} ${lv}: 設問数`);
    });
  }
}

test('読解模試: 合計210本文/320設問・id一意・choices/answerIndex/id帯/subtype', () => {
  assert.equal(READING_MOCK.length, 210, '総本文数');
  const ids = new Set<string>();
  const qids = new Set<string>();
  let totalQ = 0;
  for (const it of READING_MOCK) {
    const sub = readingSubtype(it);
    assert.ok(SUBCHAR[sub], `${it.id}: 未知subtype ${sub}`);
    assert.ok(new RegExp(`^${it.level}-D-${SUBCHAR[sub]}-9\\d{3}$`).test(it.id), `${it.id}: id帯が不正(9###予約帯)`);
    assert.ok(!ids.has(it.id), `${it.id}: 本文id重複`);
    ids.add(it.id);
    for (const q of it.questions) {
      totalQ++;
      assert.ok(!qids.has(q.id), `${q.id}: 設問id重複`);
      qids.add(q.id);
      assert.equal(q.choices.length, 4, `${q.id}: 4択でない`);
      assert.equal(new Set(q.choices).size, 4, `${q.id}: 選択肢が重複`);
      if (sub === 'joho') assert.ok(q.answerIndex >= 0 && q.answerIndex <= 3, `${q.id}: answerIndex範囲外`);
      else assert.equal(q.answerIndex, 0, `${q.id}: 内容理解の正解はchoices[0](描画時シャッフル)`);
    }
  }
  assert.equal(totalQ, 320, '総設問数');
});
