import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFacetState } from './mastery.ts';
import { coverageRate } from './coverage.ts';

test('coverage = received / inventory (A案・受容済で1台)', () => {
  const received = { ...newFacetState(0), intervalDays: 10 };
  const notYet = { ...newFacetState(0), intervalDays: 2 };
  // 在庫10・受容済2 -> 0.2
  assert.equal(coverageRate(10, [received, received, notYet]), 0.2);
});

test('empty inventory -> 0', () => {
  assert.equal(coverageRate(0, []), 0);
});
