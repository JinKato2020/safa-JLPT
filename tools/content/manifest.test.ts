// app/tools/content/manifest.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileEntry, buildManifest } from './manifest.ts';

test('fileEntry: sha256/bytes/count', () => {
  const e = fileEntry('abc', 2);
  assert.equal(e.bytes, 3);
  assert.equal(e.count, 2);
  assert.equal(e.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); // sha256("abc")
});
test('buildManifest: files と daimonLabels を含む', () => {
  const m = buildManifest({ 'problems/moji_goi/context_N4.json': { text: 'abc', count: 5 } }, '2026-07-14T00:00:00Z');
  assert.equal(m.schema, 1);
  assert.equal(m.files['problems/moji_goi/context_N4.json'].count, 5);
  assert.equal(m.daimonLabels.context, '大問3 文脈規定');
  assert.ok(m.languages.includes('ne'));
});
