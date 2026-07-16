// my単語帳の保存参照(saveRef)解決テスト(spec §8)。実データ(daimonUnitIds/BANK)から代表unitを探して検証する。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionForUnit, daimonUnitIds, BANK, expressionUnitIds } from '../daimon';
import { VOCAB, GRAMMAR } from '../index';

const VOCAB_IDS = new Set(VOCAB.map((v) => v.id));
const GRAMMAR_IDS = new Set(GRAMMAR.map((g) => g.id));

test('語daimon(漢字読み)の代表unitは vocab saveRef を持つ(実在id)', () => {
  const units = daimonUnitIds('N5', 'kanji_read', 'all');
  assert.ok(units.length > 0, 'N5 kanji_read に unit が無い');
  const unit = units[0];
  const q = questionForUnit(unit);
  assert.ok(q, `unit解決失敗: ${unit}`);
  assert.ok(q!.saveRef, `saveRefが付かない: ${unit}`);
  assert.equal(q!.saveRef!.type, 'vocab');
  assert.equal(q!.saveRef!.id, unit.split('#')[0]);
  assert.ok(VOCAB_IDS.has(q!.saveRef!.id), `vocab.jsonに存在しないid: ${q!.saveRef!.id}`);
});

test('語daimon(表記/文脈規定/言い換え)も同様に vocab saveRef を持つ', () => {
  for (const daimon of ['orthography', 'context', 'synonym'] as const) {
    const units = daimonUnitIds('N4', daimon, 'all');
    assert.ok(units.length > 0, `N4 ${daimon} に unit が無い`);
    const unit = units[0];
    const q = questionForUnit(unit);
    assert.ok(q, `unit解決失敗: ${unit}`);
    assert.ok(q!.saveRef, `saveRefが付かない(${daimon}): ${unit}`);
    assert.equal(q!.saveRef!.type, 'vocab');
    assert.equal(q!.saveRef!.id, unit.split('#')[0]);
    assert.ok(VOCAB_IDS.has(q!.saveRef!.id));
  }
});

test('文法daimon(grammar_form)で pointId が実在するbankは grammar saveRef を持つ', () => {
  const withPointId = BANK.find((b) => b.daimon === 'grammar_form' && b.pointId && GRAMMAR_IDS.has(b.pointId));
  assert.ok(withPointId, 'pointId解決可能なgrammar_form bankが見つからない');
  const q = questionForUnit(withPointId!.id);
  assert.ok(q);
  assert.deepEqual(q!.saveRef, { type: 'grammar', id: withPointId!.pointId });
});

test('文法daimon(order/passage_grammar)で pointId が実在すれば grammar saveRef を持つ', () => {
  const found = BANK.find(
    (b) => (b.daimon === 'order' || b.daimon === 'passage_grammar') && b.pointId && GRAMMAR_IDS.has(b.pointId),
  );
  assert.ok(found, 'pointId解決可能なorder/passage_grammar bankが見つからない');
  const q = questionForUnit(found!.id);
  assert.ok(q);
  assert.deepEqual(q!.saveRef, { type: 'grammar', id: found!.pointId });
});

test('文法daimonで pointId が無い/未知idのbankは saveRef を持たない', () => {
  const missing = BANK.find(
    (b) =>
      (b.daimon === 'grammar_form' || b.daimon === 'order' || b.daimon === 'passage_grammar') &&
      (!b.pointId || !GRAMMAR_IDS.has(b.pointId)),
  );
  assert.ok(missing, 'pointId欠落のbankが見つからない(全件解決済み?)');
  const q = questionForUnit(missing!.id);
  assert.ok(q);
  assert.equal(q!.saveRef, undefined);
});

test('用法(usage)は stem を語彙へ逆引きできれば vocab saveRef を持つ', () => {
  const resolved = BANK.filter((b) => b.daimon === 'usage').find((b) => {
    const q = questionForUnit(b.id);
    return q?.saveRef;
  });
  assert.ok(resolved, 'saveRef解決可能なusage bankが見つからない');
  const q = questionForUnit(resolved!.id)!;
  assert.equal(q.saveRef!.type, 'vocab');
  assert.ok(VOCAB_IDS.has(q.saveRef!.id));
});

test('用法(usage)は大半が解決できる(解決率が高いことの回帰チェック)', () => {
  const usageBank = BANK.filter((b) => b.daimon === 'usage');
  let resolved = 0;
  for (const b of usageBank) {
    const q = questionForUnit(b.id);
    if (q?.saveRef) resolved++;
  }
  const rate = resolved / usageBank.length;
  // 厳選用法には副詞・擬態語など vocab.json に無い stem が一定数含まれる(単語帳保存不可でも問題として成立)。
  assert.ok(rate > 0.75, `usage解決率が低すぎる: ${resolved}/${usageBank.length}`);
});

test('JFT会話と表現は saveRef を持たない(対象外)', () => {
  const units = expressionUnitIds();
  assert.ok(units.length > 0);
  const q = questionForUnit(units[0]);
  assert.ok(q);
  assert.equal(q!.saveRef, undefined);
});
