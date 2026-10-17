import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, dayStr, type AppState } from '../store/state';
import { quotaFor, consumeSession, grantAdBonus, FREE_SESSIONS_PER_DAY, AD_BONUS_PER_DAY_MAX } from './dailyQuota';
import { DAY_MS, TRIAL_DAYS } from './entitlement';

const T0 = 1_800_000_000_000;
const FREE_NOW = T0 + (TRIAL_DAYS + 1) * DAY_MS; // お試しが切れた後 = 無料ユーザー
const st = (over: Partial<AppState> = {}): AppState => ({ ...INITIAL_STATE, installedAt: T0, ...over });

test('無料は1日3回で止まる', () => {
  let s = st();
  for (let i = 0; i < FREE_SESSIONS_PER_DAY; i++) {
    assert.equal(quotaFor(s, FREE_NOW).canPractice, true);
    s = consumeSession(s, FREE_NOW);
  }
  const q = quotaFor(s, FREE_NOW);
  assert.equal(q.used, 3);
  assert.equal(q.left, 0);
  assert.equal(q.canPractice, false);
  assert.equal(q.canWatchAd, true); // ここで初めて広告を勧める
});

test('日付が変わると3回に戻る', () => {
  let s = st();
  for (let i = 0; i < 3; i++) s = consumeSession(s, FREE_NOW);
  const q = quotaFor(s, FREE_NOW + DAY_MS);
  assert.equal(q.used, 0);
  assert.equal(q.left, FREE_SESSIONS_PER_DAY);
  assert.equal(q.canPractice, true);
});

test('広告は1日2本まで・1本で+1回(合計5回)', () => {
  let s = st();
  for (let i = 0; i < 3; i++) s = consumeSession(s, FREE_NOW);
  s = grantAdBonus(s, FREE_NOW);
  assert.equal(quotaFor(s, FREE_NOW).left, 1);
  s = consumeSession(s, FREE_NOW);
  s = grantAdBonus(s, FREE_NOW);
  assert.equal(quotaFor(s, FREE_NOW).left, 1);
  s = consumeSession(s, FREE_NOW);
  const q = quotaFor(s, FREE_NOW);
  assert.equal(q.used, 5);
  assert.equal(q.limit, FREE_SESSIONS_PER_DAY + AD_BONUS_PER_DAY_MAX);
  assert.equal(q.canPractice, false);
  assert.equal(q.canWatchAd, false);                              // 3本目は見られない
  assert.deepEqual(grantAdBonus(s, FREE_NOW).dailyQuota, s.dailyQuota); // 3本目を叩いても不変
});

test('残りがあるうちは広告を勧めない', () => {
  const s = consumeSession(st(), FREE_NOW);
  assert.equal(quotaFor(s, FREE_NOW).canWatchAd, false);
});

test('Proは無制限・消費も記録しない', () => {
  const pro = st({ settings: { ...INITIAL_STATE.settings, devPro: true } });
  const q = quotaFor(pro, FREE_NOW);
  assert.equal(q.unlimited, true);
  assert.equal(q.canPractice, true);
  assert.equal(q.canWatchAd, false);
  assert.equal(consumeSession(pro, FREE_NOW).dailyQuota, undefined);
});

test('お試し中(受取から7日)は無制限', () => {
  // お試しはログイン時にサーバー確定の受取日(trialStartedAt)が起点。
  assert.equal(quotaFor(st({ trialStartedAt: T0 }), T0 + DAY_MS).unlimited, true);
});

test('保存される day は端末のローカル日付', () => {
  const s = consumeSession(st(), FREE_NOW);
  assert.equal(s.dailyQuota?.day, dayStr(FREE_NOW));
});

test('壊れた保存値(マイナス)でも落ちない', () => {
  const s = st({ dailyQuota: { day: dayStr(FREE_NOW), used: -5, bonus: -1 } });
  const q = quotaFor(s, FREE_NOW);
  assert.equal(q.used, 0);
  assert.equal(q.left, FREE_SESSIONS_PER_DAY);
});
