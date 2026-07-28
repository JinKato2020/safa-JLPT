import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, dayStr, type AppState } from '../store/state';
import { makeWish } from './wish';
import {
  nextLevel, buildResultReport, applyResultReport, hasPassShikishi, resultReminderDue, resultHint,
} from './resultReport';

const T = Date.UTC(2026, 6, 28, 3, 0, 0);
const DAY = 24 * 3600 * 1000;
const DATE = '2026-07-28';

test('nextLevel: N5→N4→N3→(頂点)null', () => {
  assert.equal(nextLevel('N5'), 'N4');
  assert.equal(nextLevel('N4'), 'N3');
  assert.equal(nextLevel('N3'), null);
});

test('合格: 消える花吹雪＋壁に残る色紙＋書き換え勧奨＋次の門(advance)・桜貝0', () => {
  const r = buildResultReport({ level: 'N4', outcome: 'pass', date: DATE, wish: makeWish('family', T) });
  assert.equal(r.ephemeral, 'petals_dogs');
  assert.deepEqual(r.shikishi, { level: 'N4', date: DATE });
  assert.equal(r.suggestRewish, true);
  assert.deepEqual(r.nextGate, { kind: 'advance', level: 'N3' });
  assert.equal(r.reward, 0);
  assert.equal(r.voice.text, '叶ったね。家族に届いたね。');
});

test('合格が頂点(N3): 次の門は同じ門で研鑽(retry)', () => {
  const r = buildResultReport({ level: 'N3', outcome: 'pass', date: DATE });
  assert.deepEqual(r.nextGate, { kind: 'retry', level: 'N3' });
});

test('不合格: 静かな演出・壁に残さない・慰めない(書き換え勧めない)・retry・桜貝0', () => {
  const r = buildResultReport({ level: 'N4', outcome: 'fail', date: DATE, wish: makeWish('self', T) });
  assert.equal(r.ephemeral, 'quiet');
  assert.equal(r.shikishi, null);
  assert.equal(r.suggestRewish, false);
  assert.deepEqual(r.nextGate, { kind: 'retry', level: 'N4' });
  assert.equal(r.reward, 0);
  assert.equal(r.voice.text, '挑む気持ちは、まだここにあるよ。');
});

test('合格neutral(願い未設定)は「叶ったね。」のみ・flavorを付けない', () => {
  const r = buildResultReport({ level: 'N5', outcome: 'pass', date: DATE });
  assert.equal(r.voice.text, '叶ったね。'); // variant:short で二文目(季節)が付かない
});

test('applyResultReport: 合格は色紙を壁へ・級ごと一度・不合格は変化なし', () => {
  const s0 = INITIAL_STATE;
  const s1 = applyResultReport(s0, { level: 'N4', outcome: 'pass', date: DATE });
  assert.deepEqual(s1.shikishi, [{ level: 'N4', date: DATE }]);
  assert.equal(hasPassShikishi(s1, 'N4'), true);
  // 同じ級を再報告しても増えない(嘘の旨味/重複farmを防ぐ)
  const s2 = applyResultReport(s1, { level: 'N4', outcome: 'pass', date: '2026-12-01' });
  assert.equal(s2.shikishi?.length, 1);
  // 別の級は追加される
  const s3 = applyResultReport(s2, { level: 'N3', outcome: 'pass', date: DATE });
  assert.equal(s3.shikishi?.length, 2);
  // 不合格は壁に残さない
  assert.equal(applyResultReport(s0, { level: 'N4', outcome: 'fail', date: DATE }), s0);
});

test('carry-over: applyは手習い帳(myList)・貝殻(wallet)に触れない=必ず持ち越す', () => {
  const s0: AppState = { ...INITIAL_STATE, myList: [{ type: 'word', id: 'w1' }], wallet: { points: 120 } };
  const s1 = applyResultReport(s0, { level: 'N4', outcome: 'pass', date: DATE });
  assert.deepEqual(s1.myList, s0.myList);
  assert.deepEqual(s1.wallet, s0.wallet);
});

test('applyResultReport は入力stateを変更しない(純粋)', () => {
  const s0 = INITIAL_STATE;
  const snap = JSON.stringify(s0);
  applyResultReport(s0, { level: 'N4', outcome: 'pass', date: DATE });
  assert.equal(JSON.stringify(s0), snap);
});

test('resultReminderDue: 発表期の窓(21〜56日)だけ true・examDate=nullは常にfalse', () => {
  const exam = dayStr(T - 30 * DAY); // 30日前=窓内
  assert.equal(resultReminderDue(exam, T), true);
  assert.equal(resultReminderDue(dayStr(T - 10 * DAY), T), false); // まだ早い
  assert.equal(resultReminderDue(dayStr(T - 90 * DAY), T), false); // 過ぎた
  assert.equal(resultReminderDue(null, T), false);                 // 好き層は催促しない
});

test('resultHint: 発表期のヒント台詞を返す(願い非依存)', () => {
  assert.equal(resultHint(0).text, 'そろそろ結果が出る頃かな。');
});
