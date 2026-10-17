import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitMasteryWithTransfer } from './selectors';
import { daimonUnitIds } from '../data/daimon';
import { INITIAL_STATE } from './state';
import { newItemState, updateMastery, SIGNAL_WEIGHT } from '../engine/engine';
import type { AppState } from './store';

const NOW = 1_800_000_000_000;
const mastered = () => updateMastery(newItemState(NOW), 1, SIGNAL_WEIGHT.practice, NOW); // p=1.0(同時刻=減衰なし)
const vidOf = (unit: string) => unit.split('#')[0];
const withProduce = (v: string): AppState => ({
  ...INITIAL_STATE,
  settings: { ...INITIAL_STATE.settings, level: 'N3' },
  items: { [`${v}#produce`]: mastered() },
});
const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-9;

test('持ち込み: 漢字読みは単語タブ(vProduce)を係数0.9で持ち込む(直接証拠なし)', () => {
  const kr = daimonUnitIds('N3', 'kanji_read')[0];
  assert.ok(kr && kr.includes('#kanji_read'), 'kanji_readユニットが存在');
  assert.ok(near(unitMasteryWithTransfer(withProduce(vidOf(kr)), NOW, kr), 0.9), '0.9×1.0=0.9');
});

test('持ち込み: 文脈規定/言い換えは係数0.35', () => {
  const cx = daimonUnitIds('N3', 'context')[0];
  const sy = daimonUnitIds('N3', 'synonym')[0];
  assert.ok(near(unitMasteryWithTransfer(withProduce(vidOf(cx)), NOW, cx), 0.35), 'context 0.35');
  assert.ok(near(unitMasteryWithTransfer(withProduce(vidOf(sy)), NOW, sy), 0.35), 'synonym 0.35');
});

test('持ち込み: 表記(orthography)は係数なし=持ち込まない(null)', () => {
  const og = daimonUnitIds('N3', 'orthography')[0];
  assert.equal(unitMasteryWithTransfer(withProduce(vidOf(og)), NOW, og), null);
});

test('持ち込み: 直接の試験証拠が最優先(上書き・持ち込みを使わない)', () => {
  const kr = daimonUnitIds('N3', 'kanji_read')[0];
  const v = vidOf(kr);
  const s: AppState = {
    ...INITIAL_STATE, settings: { ...INITIAL_STATE.settings, level: 'N3' },
    items: {
      [`${v}#produce`]: mastered(),                                                                   // 単語タブ満点
      [kr]: { p: 0.3, evidence: 3, updatedAt: NOW, reps: 1, intervalDays: 1, ease: 2.5, dueAt: NOW },  // 試験は0.3
    },
  };
  assert.ok(near(unitMasteryWithTransfer(s, NOW, kr), 0.3), '直接証拠0.3が勝つ');
});

test('持ち込み: バンクid(usg-)や単語タブ未学習は持ち込み無し(null)', () => {
  const kr = daimonUnitIds('N3', 'kanji_read')[0];
  const empty: AppState = { ...INITIAL_STATE, settings: { ...INITIAL_STATE.settings, level: 'N3' }, items: {} };
  assert.equal(unitMasteryWithTransfer(empty, NOW, 'usg3-001'), null, 'バンクidは対象外');
  assert.equal(unitMasteryWithTransfer(empty, NOW, kr), null, '単語タブ未学習なら持ち込み無し');
});
