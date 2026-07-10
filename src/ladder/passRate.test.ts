import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemP, passProbability, DaimonExpectation } from './passRate.ts';

test('itemP applies guess floor', () => {
  assert.equal(itemP(0), 0.25);
  assert.equal(itemP(1), 1);
  assert.ok(Math.abs(itemP(0.8) - 0.85) < 1e-9);
});

// N3: gengo(語彙漢字+文法)/dokkai/choukai。各大問 n=10。
function n3(muGengo: number, muDok: number, muCho: number): DaimonExpectation[] {
  return [
    { daimon: 'kanji_reading', n: 10, mu: muGengo },
    { daimon: 'grammar_form', n: 10, mu: muGengo },
    { daimon: 'reading', n: 10, mu: muDok },
    { daimon: 'listening', n: 10, mu: muCho },
  ];
}

test('deterministic with seed', () => {
  const p1 = passProbability('N3', n3(0.7, 0.6, 0.6), 2000, 123);
  const p2 = passProbability('N3', n3(0.7, 0.6, 0.6), 2000, 123);
  assert.equal(p1, p2);
});

test('higher mastery -> higher pass probability (monotonic)', () => {
  const low = passProbability('N3', n3(0.4, 0.4, 0.4), 2000, 7);
  const high = passProbability('N3', n3(0.9, 0.9, 0.9), 2000, 7);
  assert.ok(high > low, `high=${high} low=${low}`);
});

test('one section clearly below its 基準点 crushes pass prob even if others are high', () => {
  // 聴解だけ 0.10(基準点 19/60=0.317 を明確に下回る) -> 基準点割れでほぼ不合格。
  // 注: 0.25 は基準点の僅か下なので10問ではフロック通過が2割起きる(=正しい挙動)。明確に下回る値で検証。
  const p = passProbability('N3', n3(0.95, 0.95, 0.10), 2000, 7);
  assert.ok(p < 0.1, `p=${p}`);
});
