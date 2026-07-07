import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreStrokes, recognize, PASS_SCORE, type Pt } from './score';
import sample from '../data/kakitoriSample.json' with { type: 'json' };

const tpl = sample as { char: string; strokes: number[][][] }[];
const by = (c: string): Pt[][] => tpl.find((k) => k.char === c)!.strokes as Pt[][];

// L字(横線＋縦線)= 2画
const L: Pt[][] = [
  [[0.1, 0.1], [0.5, 0.1], [0.9, 0.1]],
  [[0.5, 0.1], [0.5, 0.5], [0.5, 0.9]],
];

test('exact shape scores high', () => {
  assert.ok(scoreStrokes(L, L) >= 90, `got ${scoreStrokes(L, L)}`);
});

test('empty input scores 0', () => {
  assert.equal(scoreStrokes([], L), 0);
  assert.equal(scoreStrokes(L, []), 0);
});

test('same shape shifted+scaled still passes (position/size invariant)', () => {
  const moved: Pt[][] = L.map((st) => st.map(([x, y]) => [x * 0.5 + 0.3, y * 0.5 - 0.05] as Pt));
  assert.ok(scoreStrokes(moved, L) >= 90, `got ${scoreStrokes(moved, L)}`);
});

// ユーザー報告の再現: 大(3画)を木(4画)と誤判定してはならない
test('大 is recognized as 大, not 木', () => {
  const r = recognize(by('大'), tpl);
  assert.equal(r[0].char, '大', `top=${r[0].char} ${r[0].score}, 木=${r.find((x) => x.char === '木')?.score}`);
});

test('大 scores higher on 大 than on 木 (stroke-count aware)', () => {
  const sDai = scoreStrokes(by('大'), by('大'));
  const sKi = scoreStrokes(by('大'), by('木'));
  assert.ok(sDai > sKi, `大=${sDai} 木=${sKi}`);
});

test('stroke-count mismatch (3-stroke drawn vs 4-stroke template) does not pass', () => {
  assert.ok(scoreStrokes(by('大'), by('木')) < PASS_SCORE, `got ${scoreStrokes(by('大'), by('木'))}`);
});

test('大 with proportional variation is still recognized as 大', () => {
  const drawn: Pt[][] = by('大').map((st) => st.map(([x, y]) => [x * 0.85 + 0.1, y * 1.05] as Pt));
  assert.equal(recognize(drawn, tpl)[0].char, '大');
});

test('each sample kanji recognizes itself (perfect template)', () => {
  for (const k of tpl) {
    const top = recognize(by(k.char), tpl)[0];
    assert.equal(top.char, k.char, `${k.char} -> ${top.char}`);
  }
});
