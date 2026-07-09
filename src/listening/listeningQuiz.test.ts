import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickItems, nearDistractors, buildVocabQuiz, buildKanjiQuiz, type LQItem, type KanjiRep } from './listeningQuiz.ts';

const rng0 = () => 0;
const seq = (a: number[]) => { let i = 0; return () => a[i++ % a.length]; };
const VP: LQItem[] = [
  { id: 'a', word: '会社', reading: 'かいしゃ', meaning: 'company' },
  { id: 'b', word: '会話', reading: 'かいわ', meaning: 'conversation' },
  { id: 'c', word: '社会', reading: 'しゃかい', meaning: 'society' },
  { id: 'd', word: '電車', reading: 'でんしゃ', meaning: 'train' },
  { id: 'e', word: '天気', reading: 'てんき', meaning: 'weather' },
];

test('pickItems は count 件重複なし・pool超で頭打ち', () => {
  assert.equal(pickItems(VP, 3, seq([0.1, 0.5, 0.9])).length, 3);
  assert.equal(pickItems(VP, 99, rng0).length, VP.length);
});
test('nearDistractors: 正解除外・共通漢字優先(会社→会話/社会)', () => {
  const d = nearDistractors(VP[0], VP, 2, rng0);
  assert.equal(d.length, 2);
  assert.ok(d.every((x) => x.id !== 'a'));
  assert.ok(d.some((x) => x.id === 'b' || x.id === 'c'));
});
test('buildVocabQuiz: 4択・正解含む・label=意味', () => {
  const qs = buildVocabQuiz([VP[0]], VP, seq([0.1, 0.3, 0.6, 0.9]));
  const q = qs[0];
  assert.equal(q.choices.length, 4);
  assert.equal(new Set(q.choices).size, 4);
  assert.equal(q.choices[q.answerIndex], 'company');
  assert.equal(q.audioReading, 'かいしゃ');
});

const KP: KanjiRep[] = [
  { id: 'k1', char: '火', level: 'N5', bound: false, word: '火', reading: 'ひ' },
  { id: 'k2', char: '水', level: 'N5', bound: false, word: '水', reading: 'みず' },
  { id: 'k3', char: '木', level: 'N5', bound: false, word: '木', reading: 'き' },
  { id: 'k4', char: '日', level: 'N5', bound: false, word: '日', reading: 'ひ' }, // 火と同音(ひ)
  { id: 'k5', char: '月', level: 'N5', bound: false, word: '月', reading: 'つき' },
  { id: 'k6', char: '校', level: 'N5', bound: true, word: '', reading: 'こう' },
];

test('buildKanjiQuiz: 選択肢=漢字1字・正解含む・同音字を誤答に入れない', () => {
  const qs = buildKanjiQuiz([KP[0]], KP, rng0); // 火(ひ)
  const q = qs[0];
  assert.equal(q.choices.length, 4);
  assert.ok(q.choices.includes('火'));
  assert.equal(q.choices[q.answerIndex], '火');
  assert.ok(!q.choices.includes('日')); // 日=ひ は同音なので除外
  assert.equal(q.audioReading, 'ひ');
});
test('buildKanjiQuiz: 拘束字は音読みが audioReading・audioVocabId は null', () => {
  const qs = buildKanjiQuiz([KP[5]], KP, rng0); // 校(こう)
  assert.equal(qs[0].audioReading, 'こう');
  assert.equal(qs[0].audioVocabId, null);
});
