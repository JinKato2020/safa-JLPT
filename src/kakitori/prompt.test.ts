import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kakitoriReadingLine } from './prompt';

test('亡は音声の代表語「亡くなる」と同じ送り仮名を出す', () => {
  assert.equal(kakitoriReadingLine('亡'), 'な（くなる）・ボウ');
});

test('動詞と形容詞は語幹だけにせず、書く・食べる・強いまで示す', () => {
  assert.equal(kakitoriReadingLine('書'), 'ショ・か（く）');
  assert.equal(kakitoriReadingLine('食'), 'た（べる）・ショク');
  assert.equal(kakitoriReadingLine('強'), 'つよ（い）');
});

test('送り仮名のない読みには括弧を足さず、未登録文字も扱える', () => {
  assert.ok(kakitoriReadingLine('手').includes('て'));
  assert.ok(!kakitoriReadingLine('手').includes('て（'));
  assert.equal(kakitoriReadingLine('🙂'), '');
});
