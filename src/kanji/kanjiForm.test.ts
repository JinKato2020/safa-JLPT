// 番人: 形の弁別テスト出題(kanjiForm)。似た字4択・正解を必ず含む・3つ揃わない字はスキップ。
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKanjiFormQuiz, makeFormQuestion, type KFItem } from './kanjiForm.ts';

// 決定論rng(線形合同)。
const mkRng = (seed: number) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

test('4択=正解＋似た字3・正解を必ず含む・answerIndexが正しい', () => {
  const it: KFItem = { char: '待', hint: 'wait（まつ）', similar: ['持', '侍', '特'] };
  const q = makeFormQuestion(it, mkRng(1));
  assert.ok(q, '問題が作れる');
  assert.equal(q!.choices.length, 4, '4択');
  assert.ok(q!.choices.includes('待'), '正解の字を含む');
  assert.equal(q!.choices[q!.answerIndex], '待', 'answerIndexが正解を指す');
  assert.equal(q!.answerId, '待#kdiscrim_form', 'form面へ写像するanswerId');
  assert.equal(new Set(q!.choices).size, 4, '重複なし');
});

test('似た字が3つ未満の字は出題できない(null)', () => {
  assert.equal(makeFormQuestion({ char: '一', hint: 'one', similar: ['二'] }, mkRng(2)), null);
  assert.equal(makeFormQuestion({ char: '以', hint: 'by', similar: ['似'] }, mkRng(3)), null);
});

test('自分自身・重複は誤答から除去される', () => {
  // similar に self(待)・重複(持)が混ざる → 除去後 [持,侍,特] の3つで4択が成立。
  const q = makeFormQuestion({ char: '待', hint: 'x', similar: ['待', '持', '持', '侍', '特'] }, mkRng(4));
  assert.ok(q, 'self/重複を除いても3つ揃えば作れる');
  assert.ok(!q!.choices.filter((ch) => ch === '待').length || q!.choices.filter((ch) => ch === '待').length === 1, 'self(待)は正解1個のみ');
  assert.equal(new Set(q!.choices).size, 4, '重複なし4択');
  // self除去・重複除去で2つしか残らなければ null。
  assert.equal(makeFormQuestion({ char: '待', hint: 'x', similar: ['待', '持', '持'] }, mkRng(7)), null);
});

test('buildKanjiFormQuiz: 作れる字だけ・上限count', () => {
  const pool: KFItem[] = [
    { char: '待', hint: 'a', similar: ['持', '侍', '特'] },
    { char: '未', hint: 'b', similar: ['末', '朱', '味'] },
    { char: '一', hint: 'c', similar: ['二'] }, // 作れない
  ];
  const qs = buildKanjiFormQuiz(pool, 10, mkRng(5));
  assert.equal(qs.length, 2, '作れる2字だけ');
  assert.ok(qs.every((q) => q.choices.length === 4));
  const capped = buildKanjiFormQuiz(pool, 1, mkRng(6));
  assert.equal(capped.length, 1, 'count上限で打ち切り');
});
