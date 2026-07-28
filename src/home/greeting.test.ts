import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE } from '../store/state';
import { shouldGreetToday, markGreetedToday } from './greeting';

const T = Date.UTC(2026, 6, 28, 1, 0, 0); // 2026-07-28 相当
const DAY = 24 * 3600 * 1000;

test('初回(lastGreetDay 無し)は出迎える', () => {
  assert.equal(shouldGreetToday(INITIAL_STATE, T), true);
});

test('同じ日の2回目は出迎えない', () => {
  const s = markGreetedToday(INITIAL_STATE, T);
  assert.equal(shouldGreetToday(s, T), false);
});

test('日付が変わったら再び出迎える', () => {
  const s = markGreetedToday(INITIAL_STATE, T);
  assert.equal(shouldGreetToday(s, T + DAY), true);
});

test('markGreetedToday は入力を変更しない(純粋)', () => {
  const snapshot = JSON.stringify(INITIAL_STATE);
  markGreetedToday(INITIAL_STATE, T);
  assert.equal(JSON.stringify(INITIAL_STATE), snapshot);
});
