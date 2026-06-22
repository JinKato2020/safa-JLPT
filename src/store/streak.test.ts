// streak ロジックの単体テスト。実行: node --test src/store/streak.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStudyDay } from './streak.ts';
import { addDays, lastNDays } from './state.ts';
import type { Streak } from './state.ts';

const base: Streak = { current: 0, longest: 0, lastStudyDay: null, freezes: 2, history: [] };

test('初回学習で current=1', () => {
  const s = applyStudyDay(base, '2026-06-21');
  assert.equal(s.current, 1);
  assert.equal(s.longest, 1);
  assert.deepEqual(s.history, ['2026-06-21']);
});

test('連日で +1、最長を更新', () => {
  let s = applyStudyDay(base, '2026-06-20');
  s = applyStudyDay(s, '2026-06-21');
  assert.equal(s.current, 2);
  assert.equal(s.longest, 2);
});

test('同日2回目はノーカウント', () => {
  let s = applyStudyDay(base, '2026-06-21');
  s = applyStudyDay(s, '2026-06-21');
  assert.equal(s.current, 1);
  assert.equal(s.history.length, 1);
});

test('1日空き(missed=1)はフリーズ1消費で連続維持', () => {
  let s = applyStudyDay(base, '2026-06-20'); // current1, freezes2
  s = applyStudyDay(s, '2026-06-22');        // 21を飛ばす
  assert.equal(s.current, 2, '連続維持');
  assert.equal(s.freezes, 1, 'フリーズ1消費');
});

test('フリーズ不足の大穴はリセット', () => {
  let s = applyStudyDay(base, '2026-06-10'); // freezes2
  s = applyStudyDay(s, '2026-06-20');        // 9日空き > freezes
  assert.equal(s.current, 1, 'リセット');
  assert.equal(s.longest, 1);
});

test('過去日/巻き戻しはノーオペ(時計安全)', () => {
  let s = applyStudyDay(base, '2026-06-21');
  const s2 = applyStudyDay(s, '2026-06-19');
  assert.equal(s2.current, s.current);
  assert.equal(s2.lastStudyDay, '2026-06-21');
});

test('addDays: カレンダー加算(月またぎ・うるう年)', () => {
  assert.equal(addDays('2026-06-21', 1), '2026-06-22');
  assert.equal(addDays('2026-06-30', 1), '2026-07-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29'); // うるう年
});

test('lastNDays: today を末尾に過去n日(古い順)', () => {
  assert.deepEqual(lastNDays('2026-06-21', 3), ['2026-06-19', '2026-06-20', '2026-06-21']);
});
