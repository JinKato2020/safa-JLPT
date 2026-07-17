// 言い換えの公式形式2通り＋データ整合。実行: node --import tsx --test src/data/synonymFormat.test.ts
// N4・N5公式=文レベル(選択肢も文) / N3=語レベル(下線語→語)。同じ大問名だが選択肢の単位が違う。
// 出題ゲートは廃止(開発者しか触らないため未検証の旧問題も出す・2026-07-17)。verified は進捗メタ。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daimonUnitIds, questionForUnit } from './daimon.ts';
import { SYNONYM_BANK, SENTENCE_FURI } from './index.ts';

const rng = () => 0.5;
const unitOf = (e: { id: string }) => `${e.id.slice(3)}#synonym`;
const LEVELS = ['N5', 'N4', 'N3'] as const;

test('文レベル(stem有)は「同じ意味の文」を問い、選択肢が文になる', () => {
  const units = daimonUnitIds('N4', 'synonym', 'all');
  assert.ok(units.length > 0, 'N4に出題ユニットがある');
  let checked = 0;
  for (const u of units) {
    const e = SYNONYM_BANK.find((x) => unitOf(x) === u)!;
    if (!e.stem) continue;
    const q = questionForUnit(u, rng)!;
    assert.equal(q.question, 'だいたい同じ意味の文はどれですか。', `文レベルの問い文: ${u}`);
    assert.ok(q.prompt && q.prompt.length > 0, `提示文(stem)がある: ${u}`);
    // 選択肢が「文」= 句点で終わるか、会話体(「…です。」)なら閉じ括弧で終わる
    for (const c of q.choices) assert.ok(/[。」]$/.test(c), `選択肢が文である: ${u} -> ${c}`);
    checked++;
  }
  assert.ok(checked > 0, '文レベルの問題が実在する(=テストが空回りしていない)');
});

// ── N5 文レベル作り直し(2026-07-17・148問)。設計=docs/superpowers/specs/2026-07-17-n5-synonym-sentence-level-design.md
const n5 = () => SYNONYM_BANK.filter((e) => e.level === 'N5');
const PATTERNS = ['noun', 'adj', 'adv', 'verb', 'hypernym', 'negation_cross', 'perspective_cross'];

test('N5言い換え: 全問が文レベル(stem有)＝公式形式。語レベル(N3形式)に戻っていない', () => {
  const v = n5();
  assert.ok(v.length > 130, `N5が作り直し後の規模: ${v.length}`);
  for (const e of v) assert.ok(e.stem, `${e.id}: stem が無い(語レベルのまま=公式形式でない)`);
});

test('N5言い換え: sentence/underline/word を保持(学習カード daimon.ts:271 が読む)', () => {
  for (const e of n5()) {
    assert.ok(e.sentence, `${e.id}: sentence が消えている=学習カードが壊れる`);
    assert.ok(e.underline, `${e.id}: underline が消えている`);
    assert.ok(e.word, `${e.id}: word が消えている`);
    assert.ok(e.sentence.includes(e.underline), `${e.id}: underline が sentence に無い`);
  }
});

test('N5言い換え: クロス型は誤答ちょうど3個(build4Choicesの動的3抽出で壊れないため)', () => {
  const cross = n5().filter((e) => e.pattern?.endsWith('_cross'));
  assert.ok(cross.length > 0, 'クロス型が実在する(=テストが空回りしていない)');
  for (const e of cross) {
    const d = e.choices.filter((c) => c !== e.answer);
    assert.equal(d.length, 3, `${e.id}: クロスの誤答が${d.length}個(3個でないと毎回1セル欠けて壊れる)`);
  }
});

test('N5言い換え: 全問に有効な pattern があり、非クロスの誤答は3〜5個', () => {
  for (const e of n5()) {
    assert.ok(e.pattern && PATTERNS.includes(e.pattern), `${e.id}: pattern が無い/不正: ${e.pattern}`);
    if (e.pattern.endsWith('_cross')) continue;
    const d = e.choices.filter((c) => c !== e.answer);
    assert.ok(d.length >= 3 && d.length <= 5, `${e.id}: 誤答が${d.length}個`);
  }
});

test('N5言い換え: 分かち書きがある(N5のみ。N4には無い)', () => {
  const v = n5();
  const spaced = v.filter((e) => /\s/.test(e.stem!));
  assert.ok(spaced.length > v.length * 0.9, `大半が分かち書き: ${spaced.length}/${v.length}`);
});

test('N5言い換え: stem/選択肢のルビは半角カッコ(RubyTextが読む形)。全角はsentenceFuri用', () => {
  for (const e of n5()) {
    assert.ok(!/（/.test(e.stem!), `${e.id}: stem に全角カッコ混入(sentenceFuri用の形)`);
    assert.ok(!/（/.test(e.answer), `${e.id}: answer に全角カッコ混入`);
    for (const c of e.choices) assert.ok(!/（/.test(c), `${e.id}: 選択肢に全角カッコ混入`);
  }
});

test('N5言い換え: SENTENCE_FURI が全問にある(学習カードのルビが出ない事故を防ぐ)', () => {
  for (const e of n5()) assert.ok(SENTENCE_FURI[e.id], `${e.id}: sentenceFuri が無い`);
});

test('出題数: N5が作り直し後の規模で出題される(edb076fで直した「出題0」の再発防止線)', () => {
  assert.ok(daimonUnitIds('N5', 'synonym', 'all').length > 130, 'N5の言い換えが出題される');
});

test('出題数: N4=185/N3=1000 が変わらない(本波はN5だけに触る=巻き込み事故の防止線)', () => {
  // 実測値(2026-07-17・投入前): N5=93 / N4=185 / N3=1000
  assert.equal(daimonUnitIds('N4', 'synonym', 'all').length, 185);
  assert.equal(daimonUnitIds('N3', 'synonym', 'all').length, 1000);
});

test('語レベル(stem無=N3のみ)は「意味がいちばん近い語」を問い、下線が引かれる', () => {
  let checked = 0;
  for (const lv of LEVELS) {
    for (const u of daimonUnitIds(lv, 'synonym', 'all')) {
      const e = SYNONYM_BANK.find((x) => unitOf(x) === u)!;
      if (e.stem) continue;
      const q = questionForUnit(u, rng)!;
      assert.equal(q.question, '下線の言葉と意味がいちばん近いのは？', `語レベルの問い文: ${u}`);
      assert.ok(q.example?.some((seg) => seg.hit), `下線(hit)が引かれている: ${u}`);
      for (const c of q.choices) assert.ok(!/[。」]$/.test(c), `選択肢が語である(文でない): ${u} -> ${c}`);
      checked++;
    }
  }
  assert.ok(checked > 0, '語レベルの問題が実在する');
});

test('文レベルの選択肢はカッコふりがな付き(RubyTextがルビ化できる形)', () => {
  const units = daimonUnitIds('N4', 'synonym', 'all');
  const withRuby = units.filter((u) => questionForUnit(u, rng)!.choices.some((c) => /[（(]/.test(c)));
  assert.ok(withRuby.length > units.length * 0.7, `大半でルビ付き選択肢: ${withRuby.length}/${units.length}`);
});

test('文レベルの提示文と正解は、対象語だけが違う(周辺は共通)', () => {
  // 公式N4の作り: 提示文の下線語だけを同義表現に置換し、他は変えない
  const sentenceLevel = SYNONYM_BANK.filter((e) => e.stem);
  assert.ok(sentenceLevel.length > 0, '文レベルのデータがある');
  let sameTail = 0;
  for (const e of sentenceLevel) {
    const a = e.stem!, b = e.answer;
    let i = 0;
    while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
    if (i >= 3) sameTail++;
  }
  assert.ok(sameTail > sentenceLevel.length * 0.8, `大半で文末が共通(=1語だけ差し替え): ${sameTail}/${sentenceLevel.length}`);
});

test('全級: 出題は必ず4択・重複なし・正解がanswerIndexにある', () => {
  for (const lv of LEVELS) {
    const units = daimonUnitIds(lv, 'synonym', 'all');
    assert.ok(units.length > 0, `${lv}に言い換えが出題される(ゲート廃止=全級で0にならない)`);
    for (const u of units) {
      const e = SYNONYM_BANK.find((x) => unitOf(x) === u)!;
      const q = questionForUnit(u, rng);
      assert.ok(q, `問題が作れる: ${u}`);
      assert.equal(q.choices.length, 4, `4択: ${u}`);
      assert.equal(new Set(q.choices).size, 4, `重複なし: ${u}`);
      assert.equal(q.choices[q.answerIndex], e.answer, `正解が answerIndex: ${u}`);
    }
  }
});

test('検証済データ: 誤答3〜6個・正解の混入なし(7択や自明化を防ぐ)', () => {
  const verified = SYNONYM_BANK.filter((e) => e.verified);
  assert.ok(verified.length > 0, '検証済データが実在する');
  for (const e of verified) {
    const d = e.choices.filter((c) => c !== e.answer);
    assert.ok(d.length >= 3 && d.length <= 6, `${e.id} の誤答が範囲外: ${d.length}個`);
    assert.equal(e.choices.filter((c) => c === e.answer).length, 0, `${e.id}: 正解が選択肢配列に混入`);
    assert.equal(new Set(e.choices).size, e.choices.length, `${e.id}: 誤答が重複`);
  }
});
