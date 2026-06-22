// JLPTエンジンの単体テスト。実行: node --test app/src/engine/engine.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY, newItemState, effectiveP, updateMastery,
  recordQuiz, recordMock, computeRing, computeReadiness, SIGNAL_WEIGHT,
  type ItemState, type SectionInput,
} from './engine.ts';

const T0 = 1_700_000_000_000; // 固定の基準時刻(Date.now は使わない=決定的テスト)

test('updateMastery は outcome 方向に p を動かし evidence を積む', () => {
  let s = updateMastery(newItemState(T0), 0.6, 1, T0); // p=0.6, ev=1
  s = updateMastery(s, 1, SIGNAL_WEIGHT.practice, T0);   // (0.6*1 + 1*3)/4 = 0.9
  assert.equal(round2(s.p), 0.9);
  assert.equal(s.evidence, 1 + 3);
});

test('減衰: 時間経過で p は下がり、強い記憶ほどゆっくり下がる', () => {
  const strong: ItemState = { ...newItemState(T0), p: 0.8 };
  const weak: ItemState = { ...newItemState(T0), p: 0.4 };
  const later = T0 + 30 * DAY;
  const sp = effectiveP(strong, later);
  const wp = effectiveP(weak, later);
  assert.ok(sp < 0.8 && sp > 0.1, `strong decayed into range: ${sp}`);
  // 同じ30日でも、強い記憶の「減った割合」は弱い記憶より小さい
  const strongDropRatio = (0.8 - sp) / 0.8;
  const weakDropRatio = (0.4 - wp) / 0.4;
  assert.ok(strongDropRatio < weakDropRatio, `strong(${strongDropRatio}) < weak(${weakDropRatio})`);
  // 経過0日は不変
  assert.equal(effectiveP(strong, T0), 0.8);
});

test('SRSスケジュール: 正解で間隔が伸び(1→6)、不正解でリセット', () => {
  let s = newItemState(T0);
  s = recordQuiz(s, true, T0); // good
  assert.equal(s.reps, 1);
  assert.equal(s.intervalDays, 1);
  assert.equal(s.dueAt, T0 + 1 * DAY);
  s = recordQuiz(s, true, T0);
  assert.equal(s.reps, 2);
  assert.equal(s.intervalDays, 6);
  const beforeEase = s.ease;
  s = recordQuiz(s, false, T0); // again
  assert.equal(s.reps, 0);
  assert.equal(s.intervalDays, 0);
  assert.equal(s.dueAt, T0 + 600_000); // 10分後に再出題
  assert.ok(s.ease < beforeEase, '不正解は ease を下げる');
});

test('リング: 未作成区分は null、満点は~100、半習得は比例', () => {
  assert.equal(computeRing(0, [], T0), null); // 読解/聴解(データ無し)
  const full = Array.from({ length: 10 }, () => ({ ...newItemState(T0), p: 1 }));
  assert.equal(computeRing(10, full, T0), 100);
  const half = Array.from({ length: 5 }, () => ({ ...newItemState(T0), p: 0.5 }));
  assert.equal(computeRing(10, half, T0), 25); // 100*(5*0.5)/10
});

test('準備度: 公式ゲート(総合＋区分別基準点)で合格圏判定＋最弱セクション', () => {
  const secs: SectionInput[] = [
    { key: 'gd', label: '言語知識・読解', pct: 60, minPct: 32 },
    { key: 'ch', label: '聴解', pct: 20, minPct: 32 },
  ];
  const r = computeReadiness(secs, 45, 50, 8);
  assert.equal(r.passing, false, '聴解20<32 で不合格');
  assert.equal(r.weakest?.key, 'ch', '達成率最低=聴解');
  assert.ok(r.score >= 20 && r.score <= 60, `weakest-linkで押し下げ: ${r.score}`);

  const r2 = computeReadiness(
    [{ key: 'gd', label: '', pct: 55, minPct: 32 }, { key: 'ch', label: '', pct: 40, minPct: 32 }],
    52, 50, 100,
  );
  assert.equal(r2.passing, true, '各区分≥基準点 かつ 総合≥50 で合格圏');
});

test('未測定セクションがあると合格圏にしない', () => {
  const r = computeReadiness(
    [{ key: 'gd', label: '', pct: 60, minPct: 32 }, { key: 'ch', label: '', pct: null, minPct: 32 }],
    60, 50, 50,
  );
  assert.equal(r.passing, false, '未測定では合格圏にしない');
  assert.equal(r.weakest?.key, 'ch', '未測定=達成率0=最弱');
});

test('信頼幅: 客観エビデンスが増えると収束する', () => {
  const secs: SectionInput[] = [
    { key: 'gd', label: '', pct: 60, minPct: 32 },
    { key: 'ch', label: '', pct: 55, minPct: 32 },
  ];
  const low = computeReadiness(secs, 58, 50, 10).band;
  const high = computeReadiness(secs, 58, 50, 200).band;
  assert.ok(high < low, `エビデンス増で band 収束: ${high} < ${low}`);
});

test('客観クイズ 不正解: 習得度↓＋数分後に再出題(復習ループ)', () => {
  const s = updateMastery(newItemState(T0), 0.6, 1, T0); // p=0.6, ev=1
  const wrong = recordQuiz(s, false, T0);
  assert.ok(wrong.p < 0.6, '不正解で習得度を下方修正');
  assert.equal(wrong.dueAt, T0 + 600_000, '10分後=次バッチに戻る');
  assert.equal(wrong.reps, 0, '再学習へリセット');
});

test('客観クイズ 正解: 習得度↑＋客観重み(3)で信頼度を積む', () => {
  const s = updateMastery(newItemState(T0), 0.25, 1, T0); // p=0.25, ev=1
  const right = recordQuiz(s, true, T0);
  assert.ok(right.p > 0.25, '正解で習得度↑');
  assert.equal(right.evidence, 1 + SIGNAL_WEIGHT.practice, '客観=重み3で信頼度UP(±が狭まる方向)');
  assert.equal(right.dueAt, T0 + DAY, '正解は翌日へ(間隔拡大)');
});

test('本番形式テスト: 重み5で最も信頼度を積む(±を最速で狭める)', () => {
  const base = updateMastery(newItemState(T0), 0.25, 1, T0); // p=0.25, ev=1
  const right = recordMock(base, true, T0);
  assert.equal(right.evidence, 1 + SIGNAL_WEIGHT.mock, '模試=重み5');
  assert.ok(right.p > 0.25, '正解で習得度↑');
  assert.equal(right.dueAt, T0 + DAY, '正解は翌日へ');
  const wrong = recordMock(updateMastery(newItemState(T0), 0.6, 1, T0), false, T0);
  assert.equal(wrong.dueAt, T0 + 600_000, '不正解は10分後に再出題');
  assert.equal(wrong.reps, 0);
  // 模試(5) は クイズ(3) より速くエビデンスを積む
  assert.ok(SIGNAL_WEIGHT.mock > SIGNAL_WEIGHT.practice);
});

function round2(x: number): number { return Math.round(x * 100) / 100; }
