// 言い換えの公式形式2通り。実行: node --import tsx --test src/data/synonymFormat.test.ts
// N4公式=文レベル(選択肢も文) / N3公式=語レベル(下線語→語)。同じ大問名だが選択肢の単位が違う。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daimonUnitIds, questionForUnit } from './daimon.ts';
import { SYNONYM_BANK } from './index.ts';

const rng = () => 0.5;
const unitOf = (e: { id: string }) => `${e.id.slice(3)}#synonym`;

test('N4=文レベル: 提示文＋「同じ意味の文」を問い、選択肢が文になる', () => {
  const units = daimonUnitIds('N4', 'synonym', 'all');
  assert.ok(units.length > 0, 'N4に出題ユニットがある');
  for (const u of units) {
    const q = questionForUnit(u, rng);
    assert.ok(q, `問題が作れる: ${u}`);
    assert.equal(q.question, 'だいたい同じ意味の文はどれですか。', `N4の問い文: ${u}`);
    assert.ok(q.prompt && q.prompt.length > 0, `提示文(stem)がある: ${u}`);
    // 選択肢が「文」であること。句点で終わるか、会話体(「…です。」)なら閉じ括弧で終わる。
    // 語レベルの選択肢(礼儀・習慣 等)はどちらでもない。
    for (const c of q.choices) {
      assert.ok(/[。」]$/.test(c), `選択肢が文である: ${u} -> ${c}`);
    }
    assert.equal(q.choices.length, 4);
  }
});

test('N3=語レベル: 下線付き文＋「意味がいちばん近い語」を問い、選択肢が語になる', () => {
  const units = daimonUnitIds('N3', 'synonym', 'all');
  assert.ok(units.length > 0, 'N3に出題ユニットがある');
  for (const u of units) {
    const q = questionForUnit(u, rng);
    assert.ok(q, `問題が作れる: ${u}`);
    assert.equal(q.question, '下線の言葉と意味がいちばん近いのは？', `N3の問い文: ${u}`);
    assert.ok(q.example && q.example.length > 0, `下線付きの文がある: ${u}`);
    assert.ok(q.example.some((seg) => seg.hit), `下線(hit)が引かれている: ${u}`);
    for (const c of q.choices) {
      assert.ok(!c.endsWith('。'), `選択肢が語である(文でない): ${u} -> ${c}`);
    }
  }
});

test('N4の選択肢はカッコふりがな付き(RubyTextがルビ化できる形)', () => {
  const units = daimonUnitIds('N4', 'synonym', 'all');
  const withRuby = units.filter((u) => (questionForUnit(u, rng)?.choices ?? []).some((c) => /[（(]/.test(c)));
  // 漢字を含まない問題もありうるので全件ではなく大半を要求
  assert.ok(withRuby.length > units.length * 0.7,
    `大半の問題でルビ付き選択肢: ${withRuby.length}/${units.length}`);
});

test('文レベルの提示文と正解は、対象語だけが違う(周辺は共通)', () => {
  // 公式N4の作り: 提示文の下線語だけを同義表現に置換し、他は変えない
  const sentenceLevel = SYNONYM_BANK.filter((e) => e.verified && e.stem);
  assert.ok(sentenceLevel.length > 0, '文レベルのデータがある');
  let sameTail = 0;
  for (const e of sentenceLevel) {
    // 末尾の共通部分が十分長ければ「周辺共通」とみなす
    const a = e.stem!, b = e.answer;
    let i = 0;
    while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
    if (i >= 3) sameTail++;
  }
  assert.ok(sameTail > sentenceLevel.length * 0.8,
    `大半で文末が共通(=1語だけ差し替え): ${sameTail}/${sentenceLevel.length}`);
});

test('全級: 出題される言い換えは検証済みのみ・4択・重複なし', () => {
  for (const lv of ['N5', 'N4', 'N3'] as const) {
    for (const u of daimonUnitIds(lv, 'synonym', 'all')) {
      const e = SYNONYM_BANK.find((x) => unitOf(x) === u);
      assert.ok(e?.verified, `未検証が出題されている: ${u}`);
      const q = questionForUnit(u, rng)!;
      assert.equal(q.choices.length, 4, `4択: ${u}`);
      assert.equal(new Set(q.choices).size, 4, `重複なし: ${u}`);
      assert.equal(q.choices[q.answerIndex], e!.answer, `正解が answerIndex: ${u}`);
    }
  }
});
