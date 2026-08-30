// 文脈規定の模試専用プール(pool='mock'・初見)の中身を守る番人。
// 【このテストが守るもの】模試の文脈規定が「公式同等の形」を保つこと＝
//  ・各級の問題数(N5:100/N4:100/N3:110) ・空所〔　〕が1個 ・誤答3個で正解混入なし・重複なし
//  ・正解が対象語(vocabId)そのもの ・対象語が出題級 ・級内で同じ語を二重に持たない(大問横断ユニーク化の前提)。
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTEXT_MOCK, VOCAB } from './index.ts';
import { mockUnitIds } from './daimon.ts';

const EXPECT: Record<string, number> = { N5: 100, N4: 100, N3: 110 };
const wordOf = new Map(VOCAB.map((v) => [v.id, v.word] as const));
const levelOf = new Map(VOCAB.map((v) => [v.id, v.level] as const));
const pool = (lv: string) => CONTEXT_MOCK.filter((e) => e.level === lv);

for (const [lv, n] of Object.entries(EXPECT)) {
  test(`文脈規定模試${lv}: 問題数が${n}(公式10/10/11×10回)`, () => {
    assert.equal(pool(lv).length, n);
    // mockUnitIds も同数(1語1問=1ユニット)
    assert.equal(mockUnitIds(lv as never, 'context' as never).length, n);
  });

  test(`文脈規定模試${lv}: 空所1個・誤答3個・正解=対象語・出題級・語の重複なし`, () => {
    const seenVid = new Set<string>();
    for (const e of pool(lv)) {
      const it = e as unknown as { id: string; vocabId: string; prompt: string; answer: string; choices: string[] };
      // 空所〔　〕がちょうど1個
      assert.equal(it.prompt.split('〔　〕').length - 1, 1, `${it.id}: 空所が1個でない`);
      // 誤答3個・正解混入なし・重複なし
      assert.equal(it.choices.length, 3, `${it.id}: 誤答が3個でない`);
      assert.ok(!it.choices.includes(it.answer), `${it.id}: 正解が誤答に混入`);
      assert.equal(new Set(it.choices).size, 3, `${it.id}: 誤答が重複`);
      // 正解=対象語(vocabId)そのもの
      assert.equal(it.answer, wordOf.get(it.vocabId), `${it.id}: 正解が対象語と不一致`);
      // 正解語が本文(空所以外)に露出していない
      assert.ok(!it.prompt.includes(it.answer), `${it.id}: 正解語が本文に出ている`);
      // 対象語が出題級
      assert.equal(levelOf.get(it.vocabId), lv, `${it.id}: 対象語の級が${lv}でない`);
      // 級内で vocabId 重複なし(大問横断ユニーク化の前提=同語を二重に持たない)
      assert.ok(!seenVid.has(it.vocabId), `${it.id}: vocabId ${it.vocabId} が級内で重複`);
      seenVid.add(it.vocabId);
    }
  });
}
