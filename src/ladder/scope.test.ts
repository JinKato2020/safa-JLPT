import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kanjiInWord, wordInScope, hasInScopeKanji } from './scope.ts';

test('kanjiInWord extracts kanji only', () => {
  assert.deepEqual(kanjiInWord('学校'), ['学', '校']);
  assert.deepEqual(kanjiInWord('ください'), []);
  assert.deepEqual(kanjiInWord('お茶'), ['茶']);
});

test('万年筆 is out of N5 scope (筆 is not an N5-scope kanji)', () => {
  assert.equal(wordInScope('万年筆', 'N5'), false);
  assert.equal(hasInScopeKanji('万年筆', 'N5'), false);
});

test('学校 is fully in N5 scope', () => {
  assert.equal(wordInScope('学校', 'N5'), true);
  assert.equal(hasInScopeKanji('学校', 'N5'), true);
});

test('kana-only word: in scope but has no in-scope kanji to test', () => {
  assert.equal(wordInScope('ください', 'N5'), true);
  assert.equal(hasInScopeKanji('ください', 'N5'), false);
});
