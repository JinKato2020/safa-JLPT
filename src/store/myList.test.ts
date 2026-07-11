// my単語帳トグルの純粋関数テスト(spec §8: 追加・重複排除・トグル削除の冪等)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleMyList, isInMyList, type SaveRef } from './state';

const v1: SaveRef = { type: 'vocab', id: 'n4-v-3' };
const v2: SaveRef = { type: 'vocab', id: 'n4-v-6' };
const g1: SaveRef = { type: 'grammar', id: 'n5-g-1' };
const k1: SaveRef = { type: 'kanji', id: 'n5-k-1' };

test('空リストへ追加すると1件になる', () => {
  const out = toggleMyList([], v1);
  assert.deepEqual(out, [v1]);
});

test('既存に無いrefは末尾に追加される', () => {
  const out = toggleMyList([v1], v2);
  assert.deepEqual(out, [v1, v2]);
});

test('同一type+idが既存なら削除される(トグルOFF)', () => {
  const out = toggleMyList([v1, v2], v1);
  assert.deepEqual(out, [v2]);
});

test('type違い・id同一は別entryとして扱う(誤重複排除しない)', () => {
  const vocabX: SaveRef = { type: 'vocab', id: 'x' };
  const grammarX: SaveRef = { type: 'grammar', id: 'x' };
  const out = toggleMyList([vocabX], grammarX);
  assert.deepEqual(out, [vocabX, grammarX]);
});

test('2回トグルすると元に戻る(冪等)', () => {
  const once = toggleMyList([], g1);
  const twice = toggleMyList(once, g1);
  assert.deepEqual(twice, []);
});

test('入力配列を変更しない(非破壊)', () => {
  const input = [v1];
  const out = toggleMyList(input, v2);
  assert.deepEqual(input, [v1]);
  assert.notEqual(out, input);
});

test('isInMyList: 登録済みならtrue、未登録/undefinedならfalse', () => {
  assert.equal(isInMyList([v1, g1], v1), true);
  assert.equal(isInMyList([v1, g1], v2), false);
  assert.equal(isInMyList(undefined, v1), false);
});

test('漢字(kanji type)も追加・重複排除・トグルできる', () => {
  const added = toggleMyList([v1], k1);
  assert.deepEqual(added, [v1, k1]);
  assert.equal(isInMyList(added, k1), true);
  // 同じidでtype違い(vocab/kanji)は別entry
  const vocabSameId: SaveRef = { type: 'vocab', id: 'n5-k-1' };
  assert.equal(isInMyList(added, vocabSameId), false);
  // トグルOFFで消える
  assert.deepEqual(toggleMyList(added, k1), [v1]);
});
