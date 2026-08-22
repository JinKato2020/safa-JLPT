// 番人: 漢字認識テストの出題(段階B①)。①答えは選択肢に一意 ②意味Qは meaningClear の字だけ
//  ③読みQの誤答に「答えと同音」「その字の他の読み」を入れない(特に音読みのみの字=校)。
import test from 'node:test';
import assert from 'node:assert/strict';
import { KANJI, cardFaceReadings } from '../data';
import kanjiFacetFlags from '../data/words/kanjiFacets.json';
import { buildKanjiRecognitionQuiz, pickAnswerReading, type KRItem } from './kanjiRecognition.ts';

const FLAGS = kanjiFacetFlags as Record<string, { meaningClear?: boolean }>;
// 決定的rng(mulberry32)。テストの再現性のため Math.random を使わない。
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hiraToKata = (s: string): string => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
const showR = (r: { type: 'on' | 'kun'; reading: string }) => (r.type === 'on' ? hiraToKata(r.reading) : r.reading);

function poolFor(level: string): KRItem[] {
  const pool: KRItem[] = [];
  for (const k of KANJI) {
    if (k.type !== 'kanji' || k.level !== level) continue;
    const readings = cardFaceReadings(k.char, level).map((r) => ({ type: r.type, reading: r.reading }));
    pool.push({ char: k.char, meaning: k.meaning ?? '', meaningClear: FLAGS[k.char]?.meaningClear ?? false, readings });
  }
  return pool;
}
const meaningClearOf = (ch: string) => FLAGS[ch]?.meaningClear ?? false;
const readingsSet = (ch: string, level: string) => new Set(cardFaceReadings(ch, level).map((r) => showR({ type: r.type, reading: r.reading })));

test('N5プールから十分な問題が作れる', () => {
  const qs = buildKanjiRecognitionQuiz(poolFor('N5'), 10, rng(1));
  assert.equal(qs.length, 10);
});

for (const seed of [1, 7, 42, 99]) {
  test(`不変条件(seed=${seed}): 答えは選択肢に一意・重複なし・意味QはmeaningClearのみ・読みQは同音/自字読み除外`, () => {
    const level = 'N5';
    // count=プール全数 → ほぼ全字が1問になり網羅的に検査できる。
    const pool = poolFor(level);
    const qs = buildKanjiRecognitionQuiz(pool, pool.length, rng(seed));
    for (const q of qs) {
      // 選択肢は重複なし、答えは1つだけ、answerIndex は答えを指す。
      assert.equal(new Set(q.choices).size, q.choices.length, `${q.char} 選択肢に重複`);
      assert.ok(q.answerIndex >= 0 && q.answerIndex < q.choices.length, `${q.char} answerIndex 範囲外`);
      if (q.kind === 'mean') {
        assert.ok(meaningClearOf(q.char), `${q.char} は meaningClear でないのに意味Qが出た`);
      } else {
        const ans = q.choices[q.answerIndex];
        const own = readingsSet(q.char, level); // その字の全読み(表示形)
        for (let i = 0; i < q.choices.length; i++) {
          if (i === q.answerIndex) continue;
          assert.notEqual(q.choices[i], ans, `${q.char} 誤答が答えと同音`);
          assert.ok(!own.has(q.choices[i]), `${q.char} 誤答がその字の別の読み(二重正解)`);
        }
      }
    }
  });
}

test('音読みのみの字(校)は必ず読みQ＝答えコウ・同音の誤答なし', () => {
  const level = 'N5';
  const pool = poolFor(level);
  assert.equal(meaningClearOf('校'), false, '校は meaningClear=false の前提');
  const ans = pickAnswerReading(pool.find((p) => p.char === '校')!);
  assert.ok(ans && showR(ans) === 'コウ', '校の出題読みは音コウ');
  // 校を含む問題を探し、コウが選択肢に1つだけであることを確認。
  const qs = buildKanjiRecognitionQuiz(pool, pool.length, rng(3));
  const kq = qs.find((q) => q.char === '校');
  assert.ok(kq && kq.kind === 'read', '校は読みQになる(意味Qは作れない)');
  assert.equal(kq!.choices.filter((ch) => ch === 'コウ').length, 1, 'コウは答えの1つだけ(同音誤答なし)');
});
