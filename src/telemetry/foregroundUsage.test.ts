import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createForegroundUsage } from './foregroundUsage';

function setup() {
  let seconds = 0;
  const snapshots: { seconds: number; force: boolean }[] = [];
  const sessions: number[] = [];
  const usage = createForegroundUsage({
    addSeconds: n => { seconds += n; },
    snapshot: force => { snapshots.push({ seconds, force }); },
    session: n => { sessions.push(n); },
  });
  return { usage, snapshots, sessions, seconds: () => seconds };
}

test('15s checkpoints persist usage before any pause; 60s snapshot includes this tick', () => {
  const h = setup();
  h.usage.active(0);
  for (const ms of [15_000, 30_000, 45_000, 60_000]) h.usage.tick(ms);
  assert.equal(h.seconds(), 60);
  assert.deepEqual(h.snapshots, [{ seconds: 0, force: false }, { seconds: 60, force: true }]);
});

test('pause flushes final increment before snapshot, without double counting background', () => {
  const h = setup();
  h.usage.active(0);
  h.usage.tick(15_000);
  h.usage.pause(23_000); // inactive
  h.usage.pause(24_000); // background
  h.usage.tick(90_000);
  assert.equal(h.seconds(), 23);
  assert.deepEqual(h.sessions, [23]);
  assert.deepEqual(h.snapshots.at(-1), { seconds: 23, force: true });
});

test('resume excludes long background intervals and duplicate active events', () => {
  const h = setup();
  h.usage.active(0);
  h.usage.active(5000);
  h.usage.pause(10_000);
  h.usage.active(3_600_000);
  h.usage.pause(3_620_000);
  assert.equal(h.seconds(), 30);
  assert.deepEqual(h.sessions, [10, 20]);
});

test('subsecond foreground segments accumulate without rounding inflation or loss', () => {
  const h = setup();
  for (let n = 0; n < 10; n++) {
    h.usage.active(n * 1000);
    h.usage.pause(n * 1000 + 600);
  }
  assert.equal(h.seconds(), 6);
});

test('initially inactive does not record time until active', () => {
  const h = setup();
  h.usage.tick(15_000);
  h.usage.pause(30_000);
  assert.equal(h.seconds(), 0);
  assert.equal(h.snapshots.length, 0);
  h.usage.active(40_000);
  h.usage.tick(55_000);
  assert.equal(h.seconds(), 15);
});

test('60s cadence restarts on resume and cleanup pause is idempotent', () => {
  const h = setup();
  h.usage.active(0);
  h.usage.pause(10_000);
  h.usage.active(80_000);
  h.usage.tick(95_000);
  assert.equal(h.snapshots.length, 3);
  h.usage.tick(140_000);
  h.usage.pause(145_000);
  h.usage.pause(145_000);
  assert.equal(h.seconds(), 75);
  assert.equal(h.snapshots.length, 5);
  assert.deepEqual(h.snapshots.at(-1), { seconds: 75, force: true });
});
