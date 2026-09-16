// 番人: 大問⑧「文章の文法」(passage_grammar)を模試の語ユニーク化(usedWords)から
// "意図的に除外" している設計を固定する。永久ルール mock-cross-daimon-no-word-reuse の
// 唯一の例外(⑧はセット形式=文章まるごと専用プール出題ゆえ語単位で弾けない)。
// ここが失敗したら「⑧をusedWordsに参加させた/除外を解除した」等の変更が入ったということ。
// その変更は例外の解消(=ルール厳格化)か破壊のどちらか。必ず MockScreen.tsx の該当コメントと
// この例外の判断(B案で確定)を読み直してから、意図的なら本テストを更新すること。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../screens/MockScreen.tsx'), 'utf8');

test('⑧文章の文法は knowledge(usedWords共有)の組み立てから除外されている', () => {
  // daimonCounts から passage_grammar を除いて knowledgeForDaimon に渡す=usedWords 共有に参加しない。
  assert.match(SRC, /\.filter\(\s*\(d\)\s*=>\s*d\.daimon\s*!==\s*'passage_grammar'\s*\)/,
    '大問⑧を knowledge から除外する filter が見当たらない(usedWords に参加させた?=例外の解消/破壊)。判断を読み直すこと。');
});

test('passageGrammarItems は usedWords を受け取らない(語ユニーク化に不参加)', () => {
  const m = SRC.match(/function\s+passageGrammarItems\s*\(([^)]*)\)/);
  assert.ok(m, 'passageGrammarItems の定義が見つからない(改名された?)。');
  assert.ok(!/usedWords/.test(m![1]),
    'passageGrammarItems が usedWords を受け取っている(⑧を語ユニーク化に参加させた?)。意図的なら本テストを更新。');
});
