import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rubyForWord } from './furigana.ts';
test('純漢字はそのまま', () => { assert.equal(rubyForWord('上手','じょうず'), '上手（じょうず）'); });
test('末尾送り仮名を剥がす', () => {
  assert.equal(rubyForWord('美しい','うつくしい'), '美（うつく）しい');
  assert.equal(rubyForWord('負ける','まける'), '負（ま）ける');
  assert.equal(rubyForWord('迷う','まよう'), '迷（まよ）う');
});
test('先頭かなを剥がす', () => { assert.equal(rubyForWord('お茶','おちゃ'), 'お茶（ちゃ）'); });
test('単漢字', () => { assert.equal(rubyForWord('日','ひ'), '日（ひ）'); });
test('空/読み一致は素通し', () => { assert.equal(rubyForWord('',''), ''); });
