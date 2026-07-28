import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, dayStr, type AppState, type Wish } from '../store/state';
import { makeWish } from './wish';
import { examTiming, examLineToday, markExamShown } from './examLine';

const T = Date.UTC(2026, 6, 28, 3, 0, 0);
const DAY = 24 * 3600 * 1000;

function mkState(examDate: string | null, wish?: Wish, storyDecay?: AppState['storyDecay']): AppState {
  return { ...INITIAL_STATE, settings: { ...INITIAL_STATE.settings, examDate, wish }, storyDecay };
}

test('examTiming: 前夜(-1)/当日(0)/翌日(+1)・範囲外はnull', () => {
  assert.equal(examTiming(dayStr(T + DAY), T), 'eve');
  assert.equal(examTiming(dayStr(T), T), 'day');
  assert.equal(examTiming(dayStr(T - DAY), T), 'after');
  assert.equal(examTiming(dayStr(T + 3 * DAY), T), null); // まだ先
  assert.equal(examTiming(dayStr(T - 3 * DAY), T), null); // 過ぎた
});

test('examTiming: examDate=null/未設定は必ずnull(好き層で誤発火しない)', () => {
  assert.equal(examTiming(null, T), null);
  assert.equal(examTiming(undefined, T), null);
  assert.equal(examTiming('', T), null);
});

test('examLineToday: 願い別の前夜の一言を返す', () => {
  const s = mkState(dayStr(T + DAY), makeWish('study', T));
  const line = examLineToday(s, T);
  assert.equal(line?.timing, 'eve');
  assert.equal(line?.text, '学ぶために始めたね。いってらっしゃい。');
});

test('examLineToday: 願い未設定は neutral の一言', () => {
  const s = mkState(dayStr(T), undefined);
  assert.equal(examLineToday(s, T)?.text, '今日だね。いってらっしゃい。');
});

test('examLineToday: examDate=null(好き層)は null(演出を出さない)', () => {
  const s = mkState(null, makeWish('like', T));
  assert.equal(examLineToday(s, T), null);
});

test('examLineToday: 範囲外の日は null', () => {
  const s = mkState(dayStr(T + 5 * DAY), makeWish('self', T));
  assert.equal(examLineToday(s, T), null);
});

test('perDay:1 → 同日2回目は null・翌日(翌日タイミング)は復活', () => {
  const s = mkState(dayStr(T), makeWish('family', T)); // 当日
  assert.equal(examLineToday(s, T)?.timing, 'day');
  const s2 = markExamShown(s, T);
  assert.equal(examLineToday(s2, T), null); // 今日はもう出した

  // 翌日: examDate は昨日になり timing=after・decayは新しい日でリセット→復活
  const after = examLineToday(s2, T + DAY);
  assert.equal(after?.timing, 'after');
  assert.equal(after?.text, 'おかえり。家族へ、また一歩だね。');
});

test('markExamShown は入力stateを変更しない(純粋)', () => {
  const s = mkState(dayStr(T), makeWish('talk', T));
  const snap = JSON.stringify(s);
  markExamShown(s, T);
  assert.equal(JSON.stringify(s), snap);
});
