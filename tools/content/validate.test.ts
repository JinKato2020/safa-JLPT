// app/tools/content/validate.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkIdsUnique, checkLangCompleteness, checkManifest, checkOrphanLexicon } from './validate.ts';
import type { ContentFile, LexiconFile, Manifest } from './schema.ts';

const f = (daimon: string, level: string, items: any[]): ContentFile => ({ schema: 1, daimon, level, languages: ['ja', 'ne'], items });

test('checkIdsUnique: 重複を検出', () => {
  const a = f('context', 'N4', [{ id: 'x', i18n: {} }]);
  const b = f('context', 'N5', [{ id: 'x', i18n: {} }]);
  assert.deepEqual(checkIdsUnique([a, b]), ['x']);
  assert.deepEqual(checkIdsUnique([a]), []);
});
test('checkLangCompleteness: 欠けた訳を列挙', () => {
  const file = { ...f('context', 'N4', [{ id: 'x', i18n: { ja: { explain: 'a' } } }]), languages: ['ja', 'ne'] } as ContentFile;
  const miss = checkLangCompleteness(file, ['ja', 'ne']);
  assert.deepEqual(miss, ['x#ne#explain']);
});
test('checkLangCompleteness: translate空の大問はスキップ', () => {
  const file = f('kanji_read', 'N5', [{ id: 'k', i18n: {} }]);
  assert.deepEqual(checkLangCompleteness(file, ['ja', 'ne']), []);
});
test('checkManifest: sha256不一致を検出', () => {
  const m: Manifest = { schema: 1, contentVersion: 't', languages: [], daimonLabels: {}, files: { 'a.json': { sha256: 'bad', bytes: 3, count: 1 } } };
  const errs = checkManifest(m, { 'a.json': { text: 'abc', count: 1 } });
  assert.equal(errs.length, 1);
});
test('checkOrphanLexicon: 対応idなしを検出', () => {
  const lex: LexiconFile = { schema: 1, kind: 'meaning', level: 'N4', languages: ['ne'], items: { 'n4-v-1': { ne: 'x' }, 'n4-v-999': { ne: 'y' } } };
  assert.deepEqual(checkOrphanLexicon(lex, new Set(['n4-v-1'])), ['n4-v-999']);
});
