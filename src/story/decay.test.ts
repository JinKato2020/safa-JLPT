import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayStr, type DecayCounter } from '../store/state';
import {
  decideIntensity, recordShown, recordDecay, intensityFor, clearDecay,
  DECAY_POLICIES, type DecayPolicy,
} from './decay';

const T = Date.UTC(2026, 6, 28, 1, 0, 0); // 2026-07-28 相当
const DAY = 24 * 3600 * 1000;

// 回数ラダー検証用: full 2回 → short 2回 → none。
const LADDER: DecayPolicy = { fullTimes: 2, shortTimes: 2, refreshAfterDays: 30 };
const cnt = (over: Partial<DecayCounter>): DecayCounter => ({ total: 0, skips: 0, lastDay: dayStr(T), dayCount: 1, ...over });

test('未接触は full', () => {
  assert.equal(decideIntensity(LADDER, undefined, { now: T }), 'full');
});

test('回数ラダー: full×2 → short×2 → none', () => {
  assert.equal(decideIntensity(LADDER, cnt({ total: 1 }), { now: T }), 'full');
  assert.equal(decideIntensity(LADDER, cnt({ total: 2 }), { now: T }), 'short');
  assert.equal(decideIntensity(LADDER, cnt({ total: 3 }), { now: T }), 'short');
  assert.equal(decideIntensity(LADDER, cnt({ total: 4 }), { now: T }), 'none');
});

test('スキップは最強: 2回で short・4回で none(回数がまだ full でも降格)', () => {
  assert.equal(decideIntensity(LADDER, cnt({ total: 0, skips: 2 }), { now: T }), 'short');
  assert.equal(decideIntensity(LADDER, cnt({ total: 0, skips: 4 }), { now: T }), 'none');
});

test('refreshAfterDays: 空白があれば full に戻す', () => {
  const stale = cnt({ total: 99, skips: 9, lastDay: dayStr(T) });
  assert.equal(decideIntensity(LADDER, stale, { now: T + 30 * DAY }), 'full');
  // 空白が足りなければ据え置き(none のまま)
  assert.equal(decideIntensity(LADDER, stale, { now: T + 29 * DAY }), 'none');
});

test('Reduce Motion は full を short に丸める(none はそのまま)', () => {
  assert.equal(decideIntensity(LADDER, undefined, { now: T, reduceMotion: true }), 'short');
  assert.equal(decideIntensity(LADDER, cnt({ total: 4 }), { now: T, reduceMotion: true }), 'none');
});

test('perDay: 当日上限に達したら none・翌日は復活', () => {
  const p: DecayPolicy = { perDay: 1, fullTimes: 3, shortTimes: 9, refreshAfterDays: 4 };
  const shownToday = cnt({ total: 1, dayCount: 1, lastDay: dayStr(T) });
  assert.equal(decideIntensity(p, shownToday, { now: T }), 'none');       // 今日はもう出た
  assert.equal(decideIntensity(p, shownToday, { now: T + DAY }), 'full'); // 翌日は復活
});

test('recordShown: total/dayCount を+1・skipped で skips 加算・翌日は dayCount リセット', () => {
  const c1 = recordShown(LADDER, undefined, T);
  assert.deepEqual(c1, { total: 1, skips: 0, lastDay: dayStr(T), dayCount: 1 });
  const c2 = recordShown(LADDER, c1, T, { skipped: true });
  assert.equal(c2.total, 2); assert.equal(c2.skips, 1); assert.equal(c2.dayCount, 2);
  const c3 = recordShown(LADDER, c2, T + DAY);
  assert.equal(c3.total, 3); assert.equal(c3.dayCount, 1); // 新しい日=当日カウントは1へ
});

test('recordShown は入力カウンタを変更しない(純粋)', () => {
  const c1 = cnt({ total: 5, skips: 1 });
  const snap = JSON.stringify(c1);
  recordShown(LADDER, c1, T);
  assert.equal(JSON.stringify(c1), snap);
});

test('recordDecay/intensityFor: 接点IDで方針テーブルを引く(daily_greet)', () => {
  const m0 = recordDecay(undefined, 'daily_greet', T);
  assert.equal(intensityFor(m0, 'daily_greet', { now: T }), 'none');       // 今日はもう出迎えた
  assert.equal(intensityFor(m0, 'daily_greet', { now: T + DAY }), 'full'); // 翌日
  assert.equal(intensityFor(undefined, 'daily_greet', { now: T }), 'full'); // 初回
});

test('clearDecay: 全カウンタを消して full に戻す(QA)', () => {
  const state = { storyDecay: { daily_greet: cnt({ total: 9 }) }, other: 1 };
  const cleared = clearDecay(state);
  assert.equal(cleared.storyDecay, undefined);
  assert.equal(cleared.other, 1);
  assert.equal(intensityFor(cleared.storyDecay, 'daily_greet', { now: T }), 'full');
});

test('daily_greet 方針が存在する(テーブル健全性)', () => {
  assert.ok(DECAY_POLICIES.daily_greet);
  assert.equal(DECAY_POLICIES.daily_greet.perDay, 1);
});
