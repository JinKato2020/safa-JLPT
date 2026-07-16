// 言い換えの出題ゲート。実行: node --import tsx --test src/data/synonymGate.test.ts
// 狙い: 一意性を検証していない旧問題(作法→天気/音楽/地図 のような分野違いダミー)を
//      ユーザーに出題せず、カバー率の母数にも入れないこと。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daimonUnitIds, questionForUnit } from './daimon.ts';
import { SYNONYM_BANK } from './index.ts';

const unitOf = (e: { id: string }) => `${e.id.slice(3)}#synonym`;
const verified = SYNONYM_BANK.filter((e) => e.verified === true);
const unverified = SYNONYM_BANK.filter((e) => e.verified !== true);

test('未検証の問題は出題ユニットに含まれない(=ユーザーに出ない・母数にも入らない)', () => {
  const served = new Set((['N5', 'N4', 'N3'] as const).flatMap((lv) => daimonUnitIds(lv, 'synonym', 'all')));
  for (const e of unverified) {
    assert.ok(!served.has(unitOf(e)), `未検証が出題されている: ${e.id} (${e.word})`);
  }
});

test('検証済の問題は出題される', () => {
  const served = new Set((['N5', 'N4', 'N3'] as const).flatMap((lv) => daimonUnitIds(lv, 'synonym', 'all')));
  const servedVerified = verified.filter((e) => served.has(unitOf(e)));
  // vocabの級と一致しない等で対象外になる問題はありうるが、検証済が1件でもあれば大半は出題されるはず
  if (verified.length) {
    assert.ok(servedVerified.length > 0, '検証済が1件も出題されていない');
  }
});

test('出題ユニット数 = 検証済の件数を超えない(全級合計)', () => {
  const served = (['N5', 'N4', 'N3'] as const).flatMap((lv) => daimonUnitIds(lv, 'synonym', 'all'));
  assert.ok(served.length <= verified.length,
    `出題(${served.length}) > 検証済(${verified.length}) = 未検証が漏れている`);
});

test('出題される問題は必ず4択を組める(=データ欠損で落ちない)', () => {
  for (const lv of ['N5', 'N4', 'N3'] as const) {
    for (const u of daimonUnitIds(lv, 'synonym', 'all')) {
      const q = questionForUnit(u, () => 0.5);
      assert.ok(q, `出題ユニットなのに問題が作れない: ${u}`);
      assert.equal(q.choices.length, 4, `4択でない: ${u} -> ${JSON.stringify(q.choices)}`);
      assert.equal(new Set(q.choices).size, 4, `選択肢が重複: ${u} -> ${JSON.stringify(q.choices)}`);
    }
  }
});

test('検証済データの誤答は3〜6個(密集語は5→4まで許容・7択にならない)', () => {
  for (const e of verified) {
    const n = e.choices.filter((c) => c !== e.answer).length;
    assert.ok(n >= 3 && n <= 6, `${e.id} の誤答が範囲外: ${n}個 -> ${JSON.stringify(e.choices)}`);
  }
});

test('検証済データに正解が誤答として混入していない', () => {
  for (const e of verified) {
    assert.ok(!e.choices.filter((c) => c === e.answer).length || e.choices.filter((c) => c === e.answer).length === 1,
      `${e.id}: 正解が選択肢に重複`);
  }
});
