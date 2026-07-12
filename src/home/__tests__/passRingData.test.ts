import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passRingData } from '../passRingData';
import type { AppState } from '../../store/state';

// 最小stateでもクラッシュせず、5科目・0-100クランプ・称号文字列を返す。
test('passRingData: 5科目・0-100クランプ・欠損は0・称号は文字列', () => {
  const d = passRingData({ settings: { level: 'N3' } } as unknown as AppState, 0);
  assert.equal(d.categories.length, 5);
  assert.deepEqual(d.categories.map((c) => c.key), ['vocab', 'grammar', 'kanji', 'dokkai', 'choukai']);
  for (const c of d.categories) {
    assert.ok(c.coveragePct >= 0 && c.coveragePct <= 100, `coverage範囲: ${c.key}=${c.coveragePct}`);
    assert.ok(typeof c.color === 'string' && c.color.startsWith('#'));
  }
  assert.ok(d.passPct >= 0 && d.passPct <= 100);
  assert.ok(d.overallAccuracyPct >= 0 && d.overallAccuracyPct <= 100);
  assert.equal(typeof d.tier, 'string');
  assert.ok(d.tier.length > 0);
  assert.equal(d.level, 'N3');
});
