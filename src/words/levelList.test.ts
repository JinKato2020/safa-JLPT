import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelListFor } from './levelList.ts';

test('kanji N5 は当該レベルの漢字のみ・全てlevel===N5', () => {
  const r = levelListFor('kanji', 'N5');
  assert.ok(r.length > 0);
  assert.ok(r.every((i) => i.level === 'N5' && i.type === 'kanji'));
});

test('vocab N5 は当該レベルの語彙のみ', () => {
  const r = levelListFor('vocab', 'N5');
  assert.ok(r.length > 0);
  assert.ok(r.every((i) => i.level === 'N5' && i.type === 'vocab'));
});

test('grammar N4 は当該レベルの文法のみ', () => {
  const r = levelListFor('grammar', 'N4');
  assert.ok(r.every((i) => i.level === 'N4'));
});

test('存在しないレベルは空配列', () => {
  assert.deepEqual(levelListFor('kanji', 'N1').filter((i) => i.level !== 'N1'), []);
});

test('vocab: ～付きは素の基語があれば重複除外(前/～前)', () => {
  const r = levelListFor('vocab', 'N5');
  assert.ok(r.some((i) => i.word === '前'));
  assert.ok(!r.some((i) => i.word === '～前'));
});
