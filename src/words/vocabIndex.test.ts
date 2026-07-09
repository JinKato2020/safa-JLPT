import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vocabIdForWord } from './vocabIndex.ts';

test('word|reading 完全一致で id を返す', () => {
  const id = vocabIdForWord('会社', 'かいしゃ');
  assert.equal(typeof id, 'string');
  assert.ok(id && id.length > 0);
});
test('存在しない語は null', () => {
  assert.equal(vocabIdForWord('存在しない架空語', 'そんざいしないかくうご'), null);
});
test('reading 違いは null', () => {
  assert.equal(vocabIdForWord('会社', 'まちがい'), null);
});
