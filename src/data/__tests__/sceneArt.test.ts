import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUNDLED_FRAMES, parseSceneManifest, pickSceneArt, sceneEntries, sceneFrame, type SceneEntry } from '../sceneArtCore';
import { createArtCache } from '../afterStudyRemoteCore';

const md5 = (c: string) => c.repeat(32);
const entry = (name: string, c: string, extra: Partial<SceneEntry> = {}): SceneEntry =>
  ({ file: `${name}.${md5(c)}.jpg`, md5: md5(c), bytes: 1000, width: 800, height: 1600, ...extra });
const pair = (slot: string, c1: string, c2: string, extra: Partial<SceneEntry> = {}) =>
  ({ day: entry(`${slot}_day`, c1, extra), night: entry(`${slot}_night`, c2, extra) });
const fullMap = { map: pair('map', 'a', 'b'), map_tree: pair('map_tree', 'c', 'd'), roof_shosai: pair('roof_shosai', 'e', 'f'), roof_shoko: pair('roof_shoko', '1', '2') };

test('empty catalog = everything stays bundled', () => {
  const m = parseSceneManifest({ schema: 1, slots: {} });
  assert.deepEqual(sceneEntries(m), []);
  assert.equal(pickSceneArt(m, 'home', 'day'), null);
  assert.equal(pickSceneArt(null, 'word', 'night'), null);
});

test('tabs can be replaced alone; picks by slot and day/night', () => {
  const m = parseSceneManifest({ schema: 1, slots: { home: pair('home', 'a', 'b'), exam: pair('exam', 'c', 'd') } });
  assert.equal(pickSceneArt(m, 'home', 'night')?.md5, md5('b'));
  assert.equal(pickSceneArt(m, 'exam', 'day')?.md5, md5('c'));
  assert.equal(pickSceneArt(m, 'word', 'day'), null);
  assert.equal(sceneEntries(m).length, 4);
});

test('map art must come as the full 4-layer set (background and overlays line up by pixel)', () => {
  assert.throws(() => parseSceneManifest({ schema: 1, slots: { map: fullMap.map } }));
  assert.throws(() => parseSceneManifest({ schema: 1, slots: { map: fullMap.map, map_tree: fullMap.map_tree } }));
  assert.equal(sceneEntries(parseSceneManifest({ schema: 1, slots: fullMap })).length, 8);
});

test('overlay frame: catalog value wins, otherwise the bundled autumn position', () => {
  const f = { x: 300, y: 200, w: 320, h: 220 };
  const m = parseSceneManifest({ schema: 1, slots: { ...fullMap, map_tree: pair('map_tree', 'c', 'd', { frame: f }) } });
  assert.deepEqual(sceneFrame(pickSceneArt(m, 'map_tree', 'day'), 'map_tree', 'day'), f);
  assert.deepEqual(sceneFrame(pickSceneArt(m, 'roof_shoko', 'night'), 'roof_shoko', 'night'), BUNDLED_FRAMES.roof_shoko!.night);
  assert.deepEqual(sceneFrame(null, 'roof_shoko', 'night'), { x: 349, y: 623, w: 356, h: 180 });
});

test('reject unknown slots, half pairs, bad files, frames outside the world and huge catalogs', () => {
  assert.throws(() => parseSceneManifest({ schema: 1, slots: { shop: pair('shop', 'a', 'b') } }));
  assert.throws(() => parseSceneManifest({ schema: 1, slots: { home: { day: entry('home_day', 'a') } } }));
  assert.throws(() => parseSceneManifest({ schema: 1, slots: { home: { day: entry('../x', 'a'), night: entry('home_night', 'b') } } }));
  assert.throws(() => parseSceneManifest({ schema: 1, slots: { home: pair('home', 'a', 'b', { md5: md5('f') }) } }));
  assert.throws(() => parseSceneManifest({ schema: 1, slots: { home: pair('home', 'a', 'b', { frame: { x: 900, y: 0, w: 300, h: 10 } }) } }));
  assert.throws(() => parseSceneManifest({ schema: 2, slots: {} }));
  assert.throws(() => parseSceneManifest({ schema: 1, slots: [] }));
  const big = (slot: string, a: string, b: string) => pair(slot, a, b, { bytes: 5 * 1024 * 1024 });
  assert.throws(() => parseSceneManifest({ schema: 1, slots: {
    home: big('home', 'a', 'b'), word: big('word', 'c', 'd'), exam: big('exam', 'e', 'f'), dict: big('dict', '1', '2'),
    map: big('map', '3', '4'), map_tree: big('map_tree', '5', '6'), roof_shosai: big('roof_shosai', '7', '8'), roof_shoko: big('roof_shoko', '9', '0'),
  } }));
});

test('scene catalog activates only after every file is verified (shared cache)', async () => {
  const remote = { schema: 1, slots: { home: pair('home', 'a', 'b') } };
  const disk = new Set<string>();
  let fail = true;
  const cache = createArtCache({
    load: async () => null, save: async () => {},
    valid: async e => disk.has(e.file),
    download: async e => { if (fail && e.file.startsWith('home_night')) throw new Error('offline'); disk.add(e.file); },
    fetchManifest: async () => remote,
  }, { parse: parseSceneManifest, entries: sceneEntries });
  await cache.sync();
  assert.equal(cache.get(), null);
  fail = false;
  await cache.sync();
  assert.equal(pickSceneArt(cache.get(), 'home', 'night')?.md5, md5('b'));
});
