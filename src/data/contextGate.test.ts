// 文脈規定のゲート: 作り直し済みの級だけ verified を出題し、未着手の級は従来どおり全部出す。
// 【このテストが守るもの】ゲートを級で絞り忘れると、未着手の級の文脈規定が丸ごと消滅する(出荷事故)。
import test from 'node:test';
import assert from 'node:assert/strict';
import { daimonUnitIds, contextGated } from './daimon.ts';
import { CONTEXT_BANK } from './index.ts';

const GATED = ['N5', 'N4', 'N3'];   // 作り直し＋独立の反証2回＋揃い監査を通過済み(N5=2026-07-18に599問)
const UNGATED: string[] = [];        // 全級ゲート済み。未着手の級ができたらここへ足す

const bank = (level: string) => CONTEXT_BANK.filter((e) => e.level === level);
const verified = (level: string) => bank(level).filter((e) => e.verified === true);
const units = (level: string) => daimonUnitIds(level as never, 'context' as never);

for (const lv of GATED) {
  test(`文脈規定${lv}: verifiedだけを出題する(旧データの分野違いダミーは出さない)`, () => {
    const v = verified(lv);
    assert.ok(v.length > 0, `${lv}のverifiedが0件ならテストが空回りする`);
    assert.ok(v.length < bank(lv).length, `${lv}は一部だけ作り直し済み=ゲートが意味を持つ前提`);
    const ids = units(lv);
    assert.equal(ids.length, v.length);
    const want = new Set(v.map((e) => `${e.id.slice(3)}#context`));
    for (const id of ids) assert.ok(want.has(id), `verifiedでない問題が出題されている: ${id}`);
  });
}

for (const lv of UNGATED) {
  test(`文脈規定${lv}: 未着手の級はゲートせず全部出す(消滅させない)`, () => {
    const all = bank(lv);
    assert.ok(all.length > 0, `${lv}のバンクが0件ならテストが空回りする`);
    assert.equal(verified(lv).length, 0, `${lv}はまだ作り直していない前提`);
    assert.equal(units(lv).length, all.length, `${lv}の文脈規定が消えている(ゲートを級で絞れていない)`);
  });
}

for (const lv of GATED) {
  test(`作り直した${lv}の問題: 誤答は3〜5個・正解が誤答に混入していない・空所が1個`, () => {
    const v = verified(lv);
    assert.ok(v.length > 0);
    for (const e of v) {
      assert.ok(e.choices.length >= 3 && e.choices.length <= 5, `${e.id}: 誤答が${e.choices.length}個`);
      assert.ok(!e.choices.includes(e.answer), `${e.id}: 正解が誤答に混入`);
      assert.equal(new Set(e.choices).size, e.choices.length, `${e.id}: 誤答が重複`);
      assert.equal(e.prompt.split('〔　〕').length - 1, 1, `${e.id}: 空所が1個でない`);
      assert.ok(!e.explain, `${e.id}: 作り直しで誤答が変わったので古い解説は消えているはず`);
    }
  });
}

test('誤答が足りずタグを付けた語は出題されない', () => {
  const tagged = CONTEXT_BANK.filter((e) => (e as { needsWork?: string }).needsWork);
  assert.ok(tagged.length > 0, 'タグ付きが0件ならテストが空回りする');
  for (const e of tagged) {
    assert.ok(!e.verified, `${e.id}: 誤答不足なのにverifiedが付いている`);
    assert.ok(!units(e.level).includes(`${e.id.slice(3)}#context`), `${e.id}: 誤答不足なのに出題されている`);
  }
});

// 【安全網】ゲート対象級でも、実データの verified が0件なら【ゲートしない】(=全部出す)。
// 既存ユーザーは古いOTAキャッシュ(verified無し)を焼き込みデータへ上書きして起動するため、
// ゲートだけ先に効くと検証済みデータが届くまで文脈規定が丸ごと消える(2026-07-18・N5初回起動で実発生)。
test('ゲート安全網: その級のverifiedが0件ならゲートしない(大問を空にしない)', () => {
  const g = new Set(['N5', 'N4', 'N3']);
  assert.equal(contextGated('N5', g, new Set(['N5'])), true, 'verifiedありならゲートする');
  assert.equal(contextGated('N5', g, new Set()), false, 'verified0件は安全網でゲートしない(全部出す)');
  assert.equal(contextGated('N4', g, new Set(['N5'])), false, 'その級にverifiedが無ければゲートしない');
  assert.equal(contextGated('N1', g, new Set(['N1'])), false, 'ゲート対象外の級はゲートしない');
});
