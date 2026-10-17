import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withUpdatedAt, INITIAL_STATE, type AppState } from './state';
import { reducer } from './store';

test('withUpdatedAt sets updatedAt and preserves other fields', () => {
  const s: AppState = { ...INITIAL_STATE, streak: { ...INITIAL_STATE.streak, current: 5 } };
  const out = withUpdatedAt(s, 1_700_000_000_000);
  assert.equal(out.updatedAt, 1_700_000_000_000);
  assert.equal(out.streak.current, 5); // 他は不変
  assert.equal(out.version, s.version);
});

test('withUpdatedAt does not mutate input', () => {
  const s: AppState = { ...INITIAL_STATE };
  const out = withUpdatedAt(s, 123);
  assert.notEqual(out, s);
  assert.equal(s.updatedAt, undefined);
});

// --- 多端末データ消失バグの回帰(updatedAt は「本当の学習/変更」でだけ進む) ---
const T = 1_700_000_000_000;

test('reducer: HYDRATE は読み込んだ updatedAt を保つ(進めない)', () => {
  const disk: AppState = { ...INITIAL_STATE, updatedAt: T };
  const out = reducer(INITIAL_STATE, { type: 'HYDRATE', state: disk });
  assert.equal(out.updatedAt, T); // 復元=変更ではない
});

test('reducer: 起動時 SYNC_TICKETS では updatedAt が進まない(=開いただけで相手を上書きしない)', () => {
  const s: AppState = { ...INITIAL_STATE, updatedAt: T };
  const out = reducer(s, { type: 'SYNC_TICKETS', now: T + 86_400_000 }); // 翌日に起動
  assert.equal(out.updatedAt, T); // 学習していないので時刻は進まない
});

test('reducer: 本当の学習(QUIZ_ANSWER)では updatedAt が now に進む', () => {
  const s: AppState = { ...INITIAL_STATE, updatedAt: T };
  const now = T + 5_000;
  const out = reducer(s, { type: 'QUIZ_ANSWER', itemId: 'kb-004260', correct: true, now });
  assert.equal(out.updatedAt, now);
});

test('reducer: 前面滞在秒(ADD_STUDY_SECONDS)では updatedAt が進まない(=開いて閉じただけで相手を上書きしない)', () => {
  const s: AppState = { ...INITIAL_STATE, updatedAt: T };
  const out = reducer(s, { type: 'ADD_STUDY_SECONDS', sec: 120 });
  assert.equal(out.studySeconds, 120);  // 秒は加算される
  assert.equal(out.updatedAt, T);       // が、LWW基準は進めない
});

test('reducer: 変更のない action では updatedAt を進めない', () => {
  const s: AppState = { ...INITIAL_STATE, updatedAt: T, unlocksSeen: ['x'] };
  const out = reducer(s, { type: 'MARK_UNLOCK_SEEN', key: 'x' }); // 既に既読=no-op
  assert.equal(out, s);           // 同一参照
  assert.equal(out.updatedAt, T);
});
