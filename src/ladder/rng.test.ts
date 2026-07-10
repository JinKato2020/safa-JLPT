import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from './rng.ts';

test('same seed -> same sequence (determinism)', () => {
  const a = mulberry32(42); const b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('outputs in [0,1)', () => {
  const r = mulberry32(1);
  for (let i = 0; i < 100; i++) { const x = r(); assert.ok(x >= 0 && x < 1); }
});
