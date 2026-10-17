// daylightAt の境界(昼=6:00〜17:59, 夜=18:00〜5:59)を検証する。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daylightAt } from '../daylight';

const at = (h: number, m = 0) => { const d = new Date(2026, 0, 1, h, m, 0); return daylightAt(d); };

test('6時ちょうどは昼', () => { assert.equal(at(6, 0), 'day'); });
test('正午は昼', () => { assert.equal(at(12), 'day'); });
test('17:59は昼', () => { assert.equal(at(17, 59), 'day'); });
test('18時ちょうどは夜', () => { assert.equal(at(18, 0), 'night'); });
test('深夜0時は夜', () => { assert.equal(at(0), 'night'); });
test('5:59は夜', () => { assert.equal(at(5, 59), 'night'); });
