// 文法形式判断の模試専用プール(pool='mock'・初見)の中身を守る番人。
// 【このテストが守るもの】模試の文法形式が「公式同等の形」を保つこと＝
//  ・各級の問題数(N5:160/N4:150/N3:130=公式16/15/13×10回) ・空所〔　〕が1個
//  ・4択で先頭=正解・重複なし ・pointId が grammar.json に実在 ・id帯 N{lv}-G-GM-####
//  ・級内で stem 重複なし(10回横断で同じ問題を出さない前提)。
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_FORM_MOCK, GRAMMAR } from './index.ts';
import { mockUnitIds } from './daimon.ts';

const EXPECT: Record<string, number> = { N5: 160, N4: 150, N3: 130 };
const BLANK = '〔　〕'; // 〔　〕
const validPid = new Set(GRAMMAR.map((g) => g.id));
const pool = (lv: string) => (GRAMMAR_FORM_MOCK as unknown as { id: string; stem: string; question: string; answer: string; choices: string[]; pointId: string; level: string }[]).filter((e) => e.level === lv);

for (const [lv, n] of Object.entries(EXPECT)) {
  test(`文法形式模試${lv}: 問題数が${n}(公式×10回)`, () => {
    assert.equal(pool(lv).length, n);
    assert.equal(mockUnitIds(lv as never, 'grammar_form' as never).length, n);
  });

  test(`文法形式模試${lv}: 空所1個・4択先頭正解・pointId実在・id帯・stem重複なし`, () => {
    const seenStem = new Set<string>();
    for (const it of pool(lv)) {
      assert.equal(it.stem.split(BLANK).length - 1, 1, `${it.id}: 空所〔　〕が1個でない`);
      assert.equal(it.choices.length, 4, `${it.id}: 4択でない`);
      assert.equal(it.choices[0], it.answer, `${it.id}: choices[0]が正解でない`);
      assert.equal(new Set(it.choices).size, 4, `${it.id}: 選択肢が重複`);
      assert.ok(validPid.has(it.pointId), `${it.id}: pointId ${it.pointId} が grammar.json に不在`);
      assert.ok(new RegExp(`^${lv}-G-GM-\\d{4}$`).test(it.id), `${it.id}: id帯が不正`);
      assert.ok(!seenStem.has(it.stem), `${it.id}: stem が級内で重複`);
      seenStem.add(it.stem);
    }
  });
}
