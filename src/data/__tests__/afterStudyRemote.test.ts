import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArtCache, parseArtManifest, pickRemoteArt, artEntries, type ArtManifest } from '../afterStudyRemoteCore';

const catalog = (hash: string): ArtManifest => ({ schema: 1,
  day: [{ file: `day_01.${hash}.jpg`, md5: hash, bytes: 100, width: 600, height: 400 }],
  night: [{ file: `night_01.${hash}.jpg`, md5: hash, bytes: 100, width: 600, height: 400 }],
});
const old = catalog('a'.repeat(32));
const newer = catalog('b'.repeat(32));

function fixture(cached: unknown = null) {
  const files = new Set(cached ? artEntries(old).map(e => e.file) : []);
  let remote: unknown = newer;
  let failFile = '';
  let failSave = false;
  let offline = false;
  const saved: ArtManifest[] = [];
  const downloads: string[] = [];
  const cache = createArtCache({
    load: async () => cached,
    save: async m => { if (failSave) throw new Error('disk full'); saved.push(m); },
    valid: async e => files.has(e.file),
    download: async e => { downloads.push(e.file); if (e.file === failFile) throw new Error('interrupted'); files.add(e.file); },
    fetchManifest: async () => { if (offline) throw new Error('offline'); return remote; },
  });
  return { cache, files, saved, downloads,
    setRemote: (v: unknown) => { remote = v; },
    setFailure: (v: string) => { failFile = v; },
    setOffline: () => { offline = true; },
    setSaveFailure: () => { failSave = true; },
  };
}

test('first offline launch leaves bundled fallback; cached catalog works offline', async () => {
  const first = fixture(); first.setOffline(); await first.cache.sync();
  assert.equal(first.cache.get(), null);
  const returning = fixture(old); returning.setOffline(); await returning.cache.sync();
  assert.deepEqual(returning.cache.get(), old);
});

test('cache restoration calls storage verification with the entry only (no array index as URI)', async () => {
  const cache = createArtCache({ load: async () => old, save: async () => {}, download: async () => {},
    valid: async function (_entry, ...extra) { assert.equal(extra.length, 0); return true; },
    fetchManifest: async () => { throw new Error('offline'); },
  });
  await cache.sync(); assert.deepEqual(cache.get(), old);
});

test('download complete catalog before activating; unchanged images are never downloaded again', async () => {
  const h = fixture(old);
  await h.cache.sync();
  assert.deepEqual(h.cache.get(), newer);
  assert.equal(h.downloads.length, 2);
  await h.cache.sync();
  assert.equal(h.downloads.length, 2);
  assert.equal(h.saved.length, 1);
});

test('partial download keeps previous rotation and retries only missing files', async () => {
  const h = fixture(old); h.setFailure(newer.night[0].file);
  await h.cache.sync();
  assert.deepEqual(h.cache.get(), old);
  assert.equal(h.saved.length, 0);
  h.setFailure(''); await h.cache.sync();
  assert.deepEqual(h.cache.get(), newer);
  assert.equal(h.downloads.filter(f => f === newer.day[0].file).length, 1);
});

test('unverified files cannot activate a catalog', async () => {
  const h = createArtCache({ load: async () => null, save: async () => { throw new Error('should not save'); },
    valid: async () => false, download: async () => {}, fetchManifest: async () => newer });
  await h.sync(); assert.equal(h.get(), null);
});

test('failed index save retains previous catalog', async () => {
  const h = fixture(old); h.setSaveFailure(); await h.cache.sync();
  assert.deepEqual(h.cache.get(), old);
});

test('parallel launch/foreground checks share one sync', async () => {
  const h = fixture();
  const a = h.cache.sync(), b = h.cache.sync();
  assert.equal(a, b); await Promise.all([a, b]);
  assert.equal(h.downloads.length, 2); assert.equal(h.saved.length, 1);
});

test('broken disk cache and invalid remote manifest retain bundled fallback', async () => {
  const h = fixture(old); h.files.clear(); h.setRemote({ schema: 99 });
  await h.cache.sync(); assert.equal(h.cache.get(), null);
});

test('selection respects day/night and catalog order', () => {
  assert.equal(pickRemoteArt(null, 0, 'day'), null);
  assert.equal(pickRemoteArt(old, 7, 'night'), old.night[0]);
  assert.equal(pickRemoteArt(old, NaN, 'day'), old.day[0]);
});

test('reject paths, arbitrary URLs, mismatched digests, empty rotations and excessive sizes', () => {
  for (const patch of [
    { file: '../../private.jpg' }, { file: 'https://example.com/img.jpg' },
    { md5: 'c'.repeat(32) }, { bytes: 6 * 1024 * 1024 }, { width: 0 }, { height: 10_000 },
  ]) assert.throws(() => parseArtManifest({ ...old, day: [{ ...old.day[0], ...patch }] }));
  assert.throws(() => parseArtManifest({ ...old, day: [] }));
  assert.throws(() => parseArtManifest({ ...old, schema: 2 }));
});

test('invalid remote update cannot replace a working cached rotation', async () => {
  const h = fixture(old); h.setRemote({ ...newer, day: [] });
  await h.cache.sync(); assert.deepEqual(h.cache.get(), old);
  assert.equal(h.downloads.length, 0);
});
