// バッジ解錠ロジックの単体テスト。実行: node --import tsx --test src/store/badges.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBadges } from './badges.ts';

test('初期(全ゼロ)は全ロック', () => {
  const b = computeBadges({ studyDays: 0, longestStreak: 0, learned: 0, score: 0 });
  assert.equal(b.every((x) => !x.unlocked), true);
});

test('しきい値で段階解錠', () => {
  const b = computeBadges({ studyDays: 1, longestStreak: 7, learned: 60, score: 40 });
  const on = (id: string) => b.find((x) => x.id === id)?.unlocked;
  assert.equal(on('start'), true);
  assert.equal(on('streak3'), true);
  assert.equal(on('streak7'), true);
  assert.equal(on('streak30'), false);
  assert.equal(on('vocab50'), true);
  assert.equal(on('vocab200'), false);
  assert.equal(on('pass'), false);
});

test('上限値で全解錠', () => {
  const b = computeBadges({ studyDays: 40, longestStreak: 30, learned: 500, score: 80 });
  assert.equal(b.every((x) => x.unlocked), true);
});
