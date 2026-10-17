// app/src/data/content/otaDiff.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffManifest } from './otaDiff.ts';

test('diffManifest: sha変化と新規のみ返す', () => {
  const remote = { files: { 'a.json': { sha256: 'X' }, 'b.json': { sha256: 'Y' }, 'c.json': { sha256: 'Z' } } };
  const cached = { 'a.json': 'X', 'b.json': 'OLD' }; // a=同一, b=変化, c=新規
  assert.deepEqual(diffManifest(remote, cached).sort(), ['b.json', 'c.json']);
});
test('diffManifest: 全同一なら空', () => {
  const remote = { files: { 'a.json': { sha256: 'X' } } };
  assert.deepEqual(diffManifest(remote, { 'a.json': 'X' }), []);
});
