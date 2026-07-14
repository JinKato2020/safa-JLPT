import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, type AppState } from '../../store/state';
import { growthBars, weekGain } from '../growthStats';

const withGrowth = (growth: { day: string; learned: number }[]): AppState => ({ ...INITIAL_STATE, growth });

test('growthBars: 空growthは長さnの0配列', () => {
  const bars = growthBars(withGrowth([]), '2026-07-15', 14);
  assert.equal(bars.length, 14);
  assert.ok(bars.every((v) => v === 0));
});

test('growthBars: キャリーフォワードで各日の累積を返す', () => {
  const s = withGrowth([{ day: '2026-07-10', learned: 5 }, { day: '2026-07-13', learned: 9 }]);
  const bars = growthBars(s, '2026-07-15', 7); // 07-09..07-15
  // 07-09=0, 07-10=5, 11=5, 12=5, 13=9, 14=9, 15=9
  assert.deepEqual(bars, [0, 5, 5, 5, 9, 9, 9]);
});

test('weekGain: 直近7日の増加分(負値は0)', () => {
  const s = withGrowth([{ day: '2026-07-08', learned: 3 }, { day: '2026-07-14', learned: 11 }]);
  // 8日点(今日〜7日前=07-08..07-15): 07-08=3 ... 07-15=11 → +8
  assert.equal(weekGain(s, '2026-07-15', 7), 8);
});

test('weekGain: 空growthは0', () => {
  assert.equal(weekGain(withGrowth([]), '2026-07-15', 7), 0);
});
