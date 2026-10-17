import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFacetState, effectiveM, updateMastery, stageOf, DAY } from './mastery.ts';

test('fresh state has m=0 and stage new', () => {
  const s = newFacetState(0);
  assert.equal(s.m, 0);
  assert.equal(stageOf(s, 0, false), 'new');
});

test('correct observation raises m', () => {
  const s = updateMastery(newFacetState(0), 1, 3, 0);
  assert.ok(s.m > 0.5, `m=${s.m}`);
});

test('m decays toward floor over time', () => {
  const s = updateMastery(newFacetState(0), 1, 3, 0);
  const later = effectiveM(s, 60 * DAY);
  assert.ok(later < s.m, `later=${later} < ${s.m}`);
  assert.ok(later >= 0.1, 'never below floor');
});

test('received stage when interval >= 7 days', () => {
  const s = { ...newFacetState(0), m: 0.8, intervalDays: 7 };
  assert.equal(stageOf(s, 0, false), 'received');
  assert.equal(stageOf(s, 0, true), 'produced');
});
