import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withUpdatedAt, INITIAL_STATE, type AppState } from './state';

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
