import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSerialTask } from './serialTask';

test('slow older snapshot completes before the newer final sample; later writes survive failure', async () => {
  const serial = createSerialTask();
  const writes: number[] = [];
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const old = serial(async () => { await blocked; writes.push(15); });
  const latest = serial(async () => { writes.push(23); });
  await Promise.resolve();
  assert.deepEqual(writes, []);
  release();
  await Promise.all([old, latest]);
  assert.deepEqual(writes, [15, 23]);
  await assert.rejects(serial(async () => { throw new Error('network'); }));
  await serial(async () => { writes.push(60); });
  assert.deepEqual(writes, [15, 23, 60]);
});
