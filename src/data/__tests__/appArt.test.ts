import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { appArtKey, parseAppArtManifest, pickAppArt, appArtEntries, type AppArtEntry } from '../appArtCore';
import { createArtCache } from '../afterStudyRemoteCore';

const md5 = (c: string) => c.repeat(32);
const entry = (stem: string, c: string, extra: Partial<AppArtEntry> = {}): AppArtEntry =>
  ({ file: `${stem}.${md5(c)}.png`, md5: md5(c), bytes: 1000, width: 302, height: 500, ...extra });

test('bundled asset location → catalog key, for every bundler format', () => {
  assert.equal(appArtKey('/assets/assets/home/hair', 'hair_long', 'png'), 'home/hair/hair_long.png');
  assert.equal(appArtKey('/assets/?unstable_path=.%2Fassets%2Fhome%2Fhair', 'hair_long', 'png'), 'home/hair/hair_long.png');
  assert.equal(appArtKey('/assets/?export_path=/assets/shop/companion', 'shiba1', 'png'), 'shop/companion/shiba1.png');
  assert.equal(appArtKey('assets/tabs', 'home_bg', 'jpg'), 'tabs/home_bg.jpg');
});

test('every bundled image can be named in the catalog (key and stored file name are valid)', () => {
  const root = join(process.cwd(), 'assets');
  const walk = (d: string): string[] => readdirSync(d).flatMap(n => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  const files = walk(root).filter(p => /\.(png|jpe?g)$/i.test(p));
  assert.ok(files.length > 100);
  const images: Record<string, AppArtEntry> = {};
  for (const p of files) {
    const key = relative(root, p).split(sep).join('/');
    const dir = key.split('/').slice(0, -1).join('/');
    const [name, type] = [key.split('/').pop()!.replace(/\.[^.]+$/, ''), key.split('.').pop()!];
    assert.equal(appArtKey(`/assets/assets/${dir}`, name, type), key);
    const stem = key.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    images[key] = { ...entry(stem, 'a'), bytes: 1 };
  }
  assert.equal(Object.keys(parseAppArtManifest({ schema: 1, images }).images).length, files.length);
});

test('catalog picks by key; unknown keys stay bundled; measurements must be fractions', () => {
  const m = parseAppArtManifest({ schema: 1, images: { 'home/hair/hair_long.png': entry('home_hair_hair_long', 'b', { hfrac: 0.96 }) } });
  assert.equal(pickAppArt(m, 'home/hair/hair_long.png')?.hfrac, 0.96);
  assert.equal(pickAppArt(m, 'home/hair/hair_bob.png'), null);
  assert.equal(pickAppArt(null, 'home/hair/hair_long.png'), null);
  assert.equal(appArtEntries(m).length, 1);
  assert.throws(() => parseAppArtManifest({ schema: 1, images: { 'a.png': entry('a', 'c', { hfrac: 1.5 }) } }));
  assert.throws(() => parseAppArtManifest({ schema: 1, images: { '../x.png': entry('x', 'c') } }));
  assert.throws(() => parseAppArtManifest({ schema: 1, images: { 'a.gif': entry('a', 'c') } }));
  assert.throws(() => parseAppArtManifest({ schema: 1, images: { 'a.png': { ...entry('a', 'c'), md5: md5('d') } } }));
  assert.throws(() => parseAppArtManifest({ schema: 1, images: [] }));
});

test('saved catalog switches screens before the network check; new one only after every file verifies', async () => {
  const saved = { schema: 1, images: { 'a.png': entry('a', '1') } };
  const remote = { schema: 1, images: { 'a.png': entry('a', '2'), 'b.png': entry('b', '3') } };
  const disk = new Set([saved.images['a.png'].file]);
  let fail = true, restoredCalls = 0;
  const cache = createArtCache({
    load: async () => saved, save: async () => {},
    valid: async e => disk.has(e.file),
    download: async e => { if (fail && e.file.startsWith('b.')) throw new Error('offline'); disk.add(e.file); },
    fetchManifest: async () => remote,
    restored: () => { restoredCalls++; },
  }, { parse: parseAppArtManifest, entries: appArtEntries });
  await cache.sync();
  assert.equal(restoredCalls, 1);
  assert.equal(pickAppArt(cache.get(), 'a.png')?.md5, md5('1'));
  fail = false;
  await cache.sync();
  assert.equal(pickAppArt(cache.get(), 'b.png')?.md5, md5('3'));
  assert.equal(restoredCalls, 1);
});
