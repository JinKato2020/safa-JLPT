// 番人: 漢字カバー率は「単独提示(書斎タブ)で証明した分」だけを計上する(設計書 04_・段階A)。
//  ① 語彙を覚えても、その語に含まれる漢字は自動では「覚えた」にならない(旧 selectors.ts:418 の文脈回収を撤去したことの回帰防止)。
//  ② 書き取り由来の 読み(read)・書き(write) の面平均 ≥0.6 なら、その字は「覚えた」に計上される。
import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageBars } from './selectors.ts';
import { recordFacet } from '../review/facetMastery.ts';
import type { FacetTarget, Facet } from '../review/facetMap.ts';
import type { MasterySlice } from '../review/facetMastery.ts';
import { KANJI, VOCAB } from '../data';
import type { AppState } from './state';

const NOW = 1_700_000_000_000;
const mkState = (mastery: MasterySlice): AppState =>
  ({ settings: { level: 'N5', targetExam: 'jlpt' }, mastery } as unknown as AppState);
const kanjiBar = (m: MasterySlice) => coverageBars(mkState(m), NOW).find((b) => b.key === 'kanji')!;
const vocabBar = (m: MasterySlice) => coverageBars(mkState(m), NOW).find((b) => b.key === 'vocab')!;

// 何回か連続正解して面を底上げする(補強面=成功のみ底上げ)。
const drill = (m: MasterySlice, targets: FacetTarget[], reps: number): MasterySlice => {
  let cur = m;
  for (let i = 0; i < reps; i++) cur = recordFacet(cur, targets, true, 'practice', NOW);
  return cur;
};

test('母数=N5の漢字数・初期状態のカバーは0', () => {
  const bar = kanjiBar({});
  const n5count = KANJI.filter((k) => k.type === 'kanji' && k.level === 'N5').length;
  assert.equal(bar.total, n5count);
  assert.equal(bar.learned, 0);
});

test('① 語彙を覚えても、含まれる漢字は自動で覚えた扱いにならない(文脈回収の撤去)', () => {
  // N5の語で、漢字(N5)を含むものを1つ選ぶ。
  const n5KanjiChars = new Set(KANJI.filter((k) => k.type === 'kanji' && k.level === 'N5').map((k) => k.char));
  const v = VOCAB.find((x) => x.level === 'N5' && [...x.word].some((c) => n5KanjiChars.has(c)));
  assert.ok(v, 'N5漢字を含むN5語が見つかること');
  // その語を強く習得(読み面を連続正解)。
  const m = drill({}, [{ itemId: v!.id, facet: 'read' as Facet, weight: 1 }], 8);
  assert.ok(vocabBar(m).learned >= 1, '語彙側は覚えた扱いになる');
  assert.equal(kanjiBar(m).learned, 0, '語を覚えても漢字カバーは増えない(字を直接練習していないため)');
});

test('② 書き取り(読み+書き)で面平均≥0.6なら、その字は覚えたに計上', () => {
  const ch = KANJI.find((k) => k.type === 'kanji' && k.level === 'N5')!.char;
  const targets: FacetTarget[] = [
    { itemId: ch, facet: 'read', weight: 0.6 },
    { itemId: ch, facet: 'write', weight: 0.85 },
  ];
  const m = drill({}, targets, 14);
  assert.equal(kanjiBar(m).learned, 1, 'その1字だけが覚えたに計上される');
});
