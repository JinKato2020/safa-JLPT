import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rubyForWord } from './furigana.ts';
test('純漢字はそのまま', () => { assert.equal(rubyForWord('上手','じょうず'), '上手（じょうず）'); });
test('末尾送り仮名', () => {
  assert.equal(rubyForWord('美しい','うつくしい'), '美（うつく）しい');
  assert.equal(rubyForWord('負ける','まける'), '負（ま）ける');
  assert.equal(rubyForWord('迷う','まよう'), '迷（まよ）う');
});
test('先頭かな', () => { assert.equal(rubyForWord('お茶','おちゃ'), 'お茶（ちゃ）'); });
test('中間かな(各漢字群にルビ)', () => {
  assert.equal(rubyForWord('食べ物','たべもの'), '食（た）べ物（もの）');
  assert.equal(rubyForWord('女の子','おんなのこ'), '女（おんな）の子（こ）');
  assert.equal(rubyForWord('受け取る','うけとる'), '受（う）け取（と）る');
});
test('単漢字', () => { assert.equal(rubyForWord('日','ひ'), '日（ひ）'); });
test('空/一致は素通し', () => { assert.equal(rubyForWord('',''), ''); assert.equal(rubyForWord('あ','あ'), 'あ'); });
