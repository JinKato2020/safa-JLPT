import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFacetState, DAY } from './mastery.ts';
import { recordResult, isReceived, selectByForgetting } from './srs.ts';

test('correct answers grow interval past received threshold', () => {
  let s = newFacetState(0);
  s = recordResult(s, true, 3, 0);            // reps1 -> 1日
  s = recordResult(s, true, 3, 1 * DAY);      // reps2 -> 6日
  s = recordResult(s, true, 3, 7 * DAY);      // reps3 -> 6*ease
  assert.ok(s.intervalDays >= 7, `interval=${s.intervalDays}`);
  assert.equal(isReceived(s), true);
});

test('wrong answer resets reps and schedules soon', () => {
  let s = recordResult(newFacetState(0), true, 3, 0);
  s = recordResult(s, false, 3, 1 * DAY);
  assert.equal(s.reps, 0);
  assert.ok(s.dueAt - 1 * DAY <= 3_600_000, 'due within an hour');
});

test('selectByForgetting returns most-overdue first, capped at limit', () => {
  const mk = (dueAt: number, m: number) => ({ state: { ...newFacetState(0), dueAt, m } });
  const items = [mk(100 * DAY, 0.9), mk(1 * DAY, 0.2), mk(5 * DAY, 0.5)];
  const out = selectByForgetting(items, 200 * DAY, 2);
  assert.equal(out.length, 2);
  assert.equal(out[0].state.dueAt, 1 * DAY); // 最も昔にdue=最優先
});
