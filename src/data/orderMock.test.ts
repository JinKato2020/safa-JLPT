// 組み立て(⑦)の模試専用プール(pool='mock'・初見)の中身を守る番人。
// 【このテストが守るもの】模試の組み立てが「公式同等の形」を保つこと＝
//  ・各級の問題数(N5:50/N4:50/N3:50=公式5×10回) ・stemに空所＿(U+FF3F)と★
//  ・answer が choices に含まれ4択で重複なし ・回答後の完成文(i18n.ja.explain)がある
//  ・pointId が grammar.json に実在 ・指標対象外 n5-g-92 は不使用 ・id帯 N{lv}-G-OM-####
//  ・級内で stem 重複なし(10回横断で同じ問題を出さない前提)。
import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_MOCK, GRAMMAR } from './index.ts';
import { mockUnitIds } from './daimon.ts';

const EXPECT: Record<string, number> = { N5: 50, N4: 50, N3: 50 };
const UNDERSCORE = '＿'; // U+FF3F 全角アンダースコア
const validPid = new Set(GRAMMAR.map((g) => g.id));
type OrderItem = { id: string; stem: string; question: string; answer: string; choices: string[]; pointId: string; level: string; explain?: string };
const pool = (lv: string) => (ORDER_MOCK as unknown as OrderItem[]).filter((e) => e.level === lv);

for (const [lv, n] of Object.entries(EXPECT)) {
  test(`組み立て模試${lv}: 問題数が${n}(公式×10回)`, () => {
    assert.equal(pool(lv).length, n);
    assert.equal(mockUnitIds(lv as never, 'order' as never).length, n);
  });

  test(`組み立て模試${lv}: 空所＿+★・answer∈choices・4択相異・完成文・pointId実在・n5-g-92不使用・id帯・stem重複なし`, () => {
    const seenStem = new Set<string>();
    for (const it of pool(lv)) {
      assert.ok(it.stem.includes(UNDERSCORE), `${it.id}: stemに空所＿がない`);
      assert.ok(it.stem.includes('★'), `${it.id}: stemに★がない`);
      assert.equal(it.choices.length, 4, `${it.id}: 4択でない`);
      assert.equal(new Set(it.choices).size, 4, `${it.id}: 選択肢が重複`);
      assert.ok(it.choices.includes(it.answer), `${it.id}: answerがchoicesに無い`);
      assert.ok(it.explain && it.explain.length > 0, `${it.id}: 完成文(explain)が無い`);
      assert.ok(validPid.has(it.pointId), `${it.id}: pointId ${it.pointId} が grammar.json に不在`);
      assert.notEqual(it.pointId, 'n5-g-92', `${it.id}: 指標対象外 n5-g-92 は模試に使わない`);
      assert.ok(new RegExp(`^${lv}-G-OM-\\d{4}$`).test(it.id), `${it.id}: id帯が不正`);
      assert.ok(!seenStem.has(it.stem), `${it.id}: stem が級内で重複`);
      seenStem.add(it.stem);
    }
  });
}
