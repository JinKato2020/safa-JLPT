// 番人: 漢字カバー率は「単独提示(書斎タブ)で証明した分」だけを計上する(設計書 04_)。
//  漢字の面=4面: read(読み認識)/mean(意味認識)/listen(聞き取り)/form(形の弁別)。作れない面は分母から除外。
//  ① 語彙を覚えても、その語に含まれる漢字は自動では「覚えた」にならない(文脈回収の撤去の回帰防止)。
//  ② 書き取り(write)は「練習」＝漢字の面に計上しない(手書き産出は難度が高い。ユーザー方針2026-08-26)。
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

test('② 書き(write)面を積んでも漢字カバーは増えない(書き取り=練習・面に非計上)', () => {
  const ch = KANJI.find((k) => k.type === 'kanji' && k.level === 'N5')!.char;
  // write 面だけを強く積んでも、漢字の面(read/mean/listen/form)には含まれないので計上されない。
  const m = drill({}, [{ itemId: ch, facet: 'write' as Facet, weight: 1 }], 20);
  assert.equal(kanjiBar(m).learned, 0, '書き(write)は漢字の面に数えない=覚えた判定に使わない');
});

// 段階B①: 認識テストの結果(mean/read 面)がカバー率に効くか＋作れない面(mean)の除外。
test('③ 認識テスト(意味)で mean 面が上がれば覚えたに計上', () => {
  const ch = '水'; // meaningClear=true の N5 字
  assert.ok(KANJI.some((k) => k.type === 'kanji' && k.char === ch && k.level === 'N5'));
  const m = drill({}, [{ itemId: ch, facet: 'mean' as Facet, weight: 1 }], 8);
  assert.equal(kanjiBar(m).learned, 1, '意味の認識だけでも1字計上される');
});

test('③ 認識テスト(読み)は read 面のみでも計上', () => {
  const ch = '水';
  const m = drill({}, [{ itemId: ch, facet: 'read' as Facet, weight: 1 }], 8);
  assert.equal(kanjiBar(m).learned, 1, '読みの認識だけでも1字計上される');
});

test('④ 形の弁別(form)面が上がれば覚えたに計上(似た字が揃う字)', () => {
  const ch = '上'; // formMakeable=true(似た字 下/止/卜)の N5 字
  assert.ok(KANJI.some((k) => k.type === 'kanji' && k.char === ch && k.level === 'N5'));
  const m = drill({}, [{ itemId: ch, facet: 'form' as Facet, weight: 1 }], 8);
  assert.equal(kanjiBar(m).learned, 1, '形の弁別だけでも1字計上される');
});

test('③ 方針A(2026-08-28): 全字に意味面 → 校も mean 認識で覚えた扱いになる', () => {
  // 旧: 音のみ字(校)は meaningClear=false で mean を分母から除外していた。
  // 方針Aで辞書glossがあれば全字 meaningClear=true → 校も mean 面を作れる=覚えた判定に使う。
  // ※「作れない面は分母から除外」する facetMakeable の仕組みは残る(現データでは全字全4面makeableのため発火せず)。
  const ch = '校';
  assert.ok(KANJI.some((k) => k.type === 'kanji' && k.char === ch && k.level === 'N5'));
  const m = drill({}, [{ itemId: ch, facet: 'mean' as Facet, weight: 1 }], 20);
  assert.equal(kanjiBar(m).learned, 1, '校も mean 面を作れる(方針A)ので覚えた判定に計上');
});
