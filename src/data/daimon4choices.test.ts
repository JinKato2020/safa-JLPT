// 誤答プールの動的3抽出(Task 0)。実行: node --import tsx --test src/data/daimon4choices.test.ts
// 狙い: 誤答を4〜6個持つ大問(言い換え/文脈規定/漢字読み/表記)で、毎回同じ3個が出て暗記されないこと。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build4Choices, questionForUnit } from './daimon.ts';
import { SYNONYM_BANK } from './index.ts';

// 決定的な擬似乱数(テストを毎回同じ結果にする)。
// 注意: 連番シードで毎回作り直すと初手が相関して特定の誤答が出ない。必ず1本のストリームを回すこと。
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const POOL6 = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];

test('誤答6個: 選択肢は常に4・正解を必ず含む', () => {
  const rng = seeded(1);
  for (let i = 0; i < 30; i++) {
    const { choices, answerIndex } = build4Choices('ans', POOL6, rng);
    assert.equal(choices.length, 4, `4択のまま: ${JSON.stringify(choices)}`);
    assert.equal(choices[answerIndex], 'ans', '正解が answerIndex を指す');
    assert.equal(new Set(choices).size, 4, '選択肢が重複しない');
  }
});

test('誤答6個: 出題ごとに誤答の組が変わる(=暗記防止・先頭3固定ではない)', () => {
  const rng = seeded(1);
  const sets = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const { choices } = build4Choices('ans', POOL6, rng);
    sets.add(choices.filter((c) => c !== 'ans').sort().join('|'));
  }
  // 先頭3個(d1,d2,d3)しか出ない旧実装なら1種しか出ず、この行で落ちる
  assert.ok(sets.size >= 3, `誤答の組が十分に散る(固定3個ではない): ${sets.size}種`);
});

test('誤答6個: プール全体がいずれ出題される(死蔵ゼロ)', () => {
  const rng = seeded(1);
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    for (const c of build4Choices('ans', POOL6, rng).choices) if (c !== 'ans') seen.add(c);
  }
  assert.deepEqual([...seen].sort(), POOL6, `6個すべて使われる(旧実装は d1..d3 のみ): ${[...seen].sort()}`);
});

test('誤答5個・4個(密集語の下限)でも4択が成立', () => {
  for (const pool of [['d1', 'd2', 'd3', 'd4', 'd5'], ['d1', 'd2', 'd3', 'd4']]) {
    const { choices, answerIndex } = build4Choices('ans', pool, seeded(9));
    assert.equal(choices.length, 4, `誤答${pool.length}個でも4択: ${JSON.stringify(choices)}`);
    assert.equal(choices[answerIndex], 'ans');
  }
});

test('誤答3個以下: プールを全て使う(4択が崩れない)', () => {
  const { choices, answerIndex } = build4Choices('ans', ['d1', 'd2', 'd3'], seeded(5));
  assert.equal(choices.length, 4);
  assert.equal(choices[answerIndex], 'ans');
  for (const d of ['d1', 'd2', 'd3']) assert.ok(choices.includes(d), `誤答3個は全て出る: ${d}`);
});

test('正解が誤答プールに混入していても重複しない', () => {
  const { choices } = build4Choices('ans', ['ans', 'd1', 'd2', 'd3'], seeded(3));
  assert.equal(new Set(choices).size, choices.length, `重複なし: ${JSON.stringify(choices)}`);
  assert.equal(choices.filter((c) => c === 'ans').length, 1, '正解が2回出ない');
});

test('実データ結線: 言い換えの実バンクから4択が組める', () => {
  const e = SYNONYM_BANK[0];
  const q = questionForUnit(`${e.id.slice(3)}#synonym`, seeded(3));
  assert.ok(q, '問題が生成される');
  assert.equal(q.choices.length, 4);
  assert.equal(q.choices[q.answerIndex], e.answer, '正解が answerIndex にある');
  assert.equal(new Set(q.choices).size, 4, '選択肢が重複しない');
});
