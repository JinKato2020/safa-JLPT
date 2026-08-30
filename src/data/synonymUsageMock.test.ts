// 言い換え④・用法⑤ の模試専用プール(pool='mock'・初見)を守る番人。
// 【このテストが守るもの】
//  ・各級の問題数(言い換え N5:50/N4:50/N3:50・用法 N4:50/N3:50)
//  ・mockUnitIds が同数を返し、questionForUnit(useMock=true) が4択問題を作れる(結線が生きている)
//  ・模試プールが通常学習(SYNONYM_BANK/KNOWLEDGE_BANK)へ漏れていない
//  ・言い換え: N5/N4=文レベル(stem有)・N3=語レベル(stem無)・誤答に正解が混入しない・級内で語が重複しない
//  ・用法: choices=4文でchoices[0]=正解・saveRef が vocab に解決(大問横断の語ユニーク化が効く前提)
import test from 'node:test';
import assert from 'node:assert/strict';
import { SYNONYM_MOCK, USAGE_MOCK, SYNONYM_BANK, KNOWLEDGE_BANK, VOCAB } from './index.ts';
import { mockUnitIds, questionForUnit } from './daimon.ts';

const rng = () => 0.5;
const levelOf = new Map(VOCAB.map((v) => [v.id, v.level] as const));
const vidOf = (e: { id: string; vocabId?: string }) => e.vocabId ?? e.id.slice(3);

const SY_EXPECT: Record<string, number> = { N5: 50, N4: 50, N3: 50 };
const YO_EXPECT: Record<string, number> = { N4: 50, N3: 50 };

// ── 漏れ防止: 模試id(-IM-/-YM-)が学習バンクに混ざっていない ──
test('模試プールが通常学習へ漏れていない(-IM-/-YM-)', () => {
  assert.equal(SYNONYM_BANK.filter((e) => /-IM-/.test(e.id)).length, 0, 'SYNONYM_BANK に模試(-IM-)が混入');
  assert.equal((KNOWLEDGE_BANK as { id: string }[]).filter((e) => /-YM-/.test(e.id)).length, 0, 'KNOWLEDGE_BANK に模試(-YM-)が混入');
});

// ── 言い換え④ ──
for (const [lv, n] of Object.entries(SY_EXPECT)) {
  const pool = () => SYNONYM_MOCK.filter((e) => e.level === lv);
  test(`言い換え模試${lv}: 問題数=${n}・mockUnitIdsも同数`, () => {
    assert.equal(pool().length, n);
    assert.equal(mockUnitIds(lv as never, 'synonym' as never).length, n);
  });
  test(`言い換え模試${lv}: 形式(N5/N4=文/N3=語)・正解混入なし・語の重複なし・出題級`, () => {
    const seen = new Set<string>();
    for (const e of pool()) {
      const it = e as unknown as { id: string; stem?: string; answer: string; choices: string[]; pattern?: string };
      const vid = vidOf(e as never);
      if (lv === 'N3') assert.ok(!it.stem, `${it.id}: N3(語レベル)なのに stem がある`);
      else assert.ok(it.stem, `${it.id}: ${lv}(文レベル)なのに stem が無い`);
      assert.ok(!it.choices.includes(it.answer), `${it.id}: 正解が誤答に混入`);
      assert.ok(it.choices.length >= 3 && it.choices.length <= 5, `${it.id}: 誤答が${it.choices.length}個`);
      assert.equal(new Set(it.choices).size, it.choices.length, `${it.id}: 誤答が重複`);
      assert.equal(levelOf.get(vid), lv, `${it.id}: 対象語 ${vid} の級が${lv}でない`);
      assert.ok(!seen.has(vid), `${it.id}: vocabId ${vid} が級内で重複`);
      seen.add(vid);
      if (lv === 'N5') assert.ok(it.pattern, `${it.id}: N5に pattern が無い`);
    }
  });
  test(`言い換え模試${lv}: questionForUnit(useMock)が4択を作れる・正解一致`, () => {
    for (const u of mockUnitIds(lv as never, 'synonym' as never)) {
      const q = questionForUnit(u, rng, true);
      assert.ok(q, `${u}: 問題が作れない(結線切れ)`);
      assert.equal(q.choices.length, 4, `${u}: 4択でない`);
      assert.equal(new Set(q.choices).size, 4, `${u}: 選択肢重複`);
    }
  });
}

// ── 用法⑤ ──
for (const [lv, n] of Object.entries(YO_EXPECT)) {
  const pool = () => (USAGE_MOCK as { id: string; level: string; answer: string; choices: string[] }[]).filter((e) => e.level === lv);
  test(`用法模試${lv}: 問題数=${n}・mockUnitIdsも同数`, () => {
    assert.equal(pool().length, n);
    assert.equal(mockUnitIds(lv as never, 'usage' as never).length, n);
  });
  test(`用法模試${lv}: choices=4・choices[0]=正解・vocabId重複なし`, () => {
    const seen = new Set<string>();
    for (const e of pool()) {
      assert.equal(e.choices.length, 4, `${e.id}: choicesが4でない`);
      assert.equal(e.choices[0], e.answer, `${e.id}: choices[0]が正解でない`);
      assert.equal(new Set(e.choices).size, 4, `${e.id}: 選択肢重複`);
      const vid = vidOf(e as never);
      assert.ok(!seen.has(vid), `${e.id}: vocabId ${vid} が級内で重複`);
      seen.add(vid);
    }
  });
  test(`用法模試${lv}: questionForUnit(useMock)が4択+saveRef(語解決=大問横断ユニーク化の前提)`, () => {
    for (const u of mockUnitIds(lv as never, 'usage' as never)) {
      const q = questionForUnit(u, rng, true);
      assert.ok(q, `${u}: 問題が作れない(結線切れ)`);
      assert.equal(q.choices.length, 4, `${u}: 4択でない`);
      assert.ok(q.saveRef && q.saveRef.type === 'vocab', `${u}: saveRefが語に解決しない(stemが語彙と不一致=全角ルビ以外の混入等)`);
    }
  });
}
