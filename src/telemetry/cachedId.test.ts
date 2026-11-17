import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCachedIdResolver } from './cachedId';

test('concurrent first-launch readers create and persist exactly one identity', async () => {
  let saved: string | null = null;
  let generated = 0;
  let writes = 0;
  const get = createCachedIdResolver(async () => {
    // SecureStore/AsyncStorage both yield before an initially missing key returns.
    const existing = saved;
    await Promise.resolve();
    if (existing) return existing;
    const id = `id-${++generated}`;
    await Promise.resolve();
    saved = id;
    writes++;
    return id;
  });
  const ids = await Promise.all(Array.from({ length: 30 }, () => get()));
  assert.deepEqual(new Set(ids), new Set(['id-1']));
  assert.equal(saved, 'id-1');
  assert.equal(writes, 1);
  assert.equal(await get(), saved);
});

test('an existing persisted identity is preserved and read once', async () => {
  let reads = 0;
  const get = createCachedIdResolver(async () => { reads++; return 'existing-user'; });
  assert.deepEqual(await Promise.all([get(), get()]), ['existing-user', 'existing-user']);
  assert.equal(await get(), 'existing-user');
  assert.equal(reads, 1);
});

test('temporary unavailable storage can be retried without caching null', async () => {
  let calls = 0;
  const get = createCachedIdResolver(async () => ++calls === 1 ? null : 'recovered');
  assert.deepEqual(await Promise.all([get(), get()]), [null, null]);
  assert.equal(await get(), 'recovered');
  assert.equal(await get(), 'recovered');
  assert.equal(calls, 2);
});

test('a rejected read releases concurrent waiters and allows the next attempt', async () => {
  let calls = 0;
  const get = createCachedIdResolver(async () => {
    if (++calls === 1) throw new Error('storage unavailable');
    return 'retry-id';
  });
  const result = await Promise.allSettled([get(), get()]);
  assert.ok(result.every(r => r.status === 'rejected'));
  assert.equal(await get(), 'retry-id');
  assert.equal(calls, 2);
});
