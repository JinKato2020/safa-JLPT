// 単語タブ「新形式問題」の出題生成。試験タブ(本番形式)とは独立した産出/受容問題。
//  ・vProduce  語彙: 意味 → かなタイルで単語を組む(産出)。itemId=<vocabId>#produce → 語彙カバー率に加算。
//  ・gOrder    文法: 全タイルを正しい順に並べる(完全並べ替え・産出)。一意性監査済みの orderFull のみ。
//               itemId=<pointId>#order(pointId=grammar.id) → 文法カバー率に加算。
//  ・gMeaning  文法: 文法点の意味を4択(受容)。itemId=<gId>#gmeaning → 文法カバー率に加算。
// 出題順は SRS(state.items の忘却/未習を優先)。専門用語はUIに出さない。
import vocab from '../data/vocab.json';
import grammar from '../data/grammar.json';
import knowledgeBank from '../data/knowledgeBank.json';
import orderFull from '../data/orderFull.json';
import { grammarMeaningProblem } from './wordTabProblems';
import { mulberry32 } from './rng';

export type DrillKind = 'vProduce' | 'gOrder' | 'gMeaning';

export type DrillProblem =
  | { kind: 'vProduce'; itemId: string; prompt: string; word: string; reading: string; answer: string[]; tiles: string[] }
  | { kind: 'gOrder'; itemId: string; tiles: string[]; correctOrder: number[]; scrambled: number[] }
  | { kind: 'gMeaning'; itemId: string; prompt: string; choices: string[]; answerIndex: number };

type V = { id: string; level: string; word: string; reading: string; meaning: string };
const VOCAB = vocab as V[];
type G = { id: string; level: string; point: string; meaning: string };
const GRAMMAR = grammar as G[];
type KB = { level: string; daimon: string; choices: string[]; pointId?: string; ambiguous?: boolean };
const KB = knowledgeBank as KB[];
const ORDER_FULL = orderFull as Record<string, number[]>;

// 拗音・小書き・長音は直前のかなに結合して1タイル(モーラ)にする。促音「っ」は独立タイルのまま。
const COMBINE = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ', 'ー', 'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ']);
export function toMorae(reading: string): string[] {
  const out: string[] = [];
  for (const ch of reading) {
    if (COMBINE.has(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}
const KANA_POOL = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだづでどばびぶべぼぱぴぷぺぽ'.split('');

// seed付き決定論シャッフル(配列を返す)。
function shuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  return arr.map((v) => ({ v, r: rng() })).sort((a, b) => a.r - b.r).map((x) => x.v);
}

// ── 語彙 産出(意味→かな) ────────────────────────────────
// 対象=当該レベルで読みが2〜6モーラの語(タイル操作に適した長さ)。ダミー=答えに無いかな数個。
function vProduce(v: V, seed: number): DrillProblem {
  const answer = toMorae(v.reading);
  const distractCount = Math.min(4, Math.max(2, 7 - answer.length));
  const inAns = new Set(answer);
  const pool = shuffle(KANA_POOL.filter((k) => !inAns.has(k)), seed);
  const distractors = pool.slice(0, distractCount);
  const tiles = shuffle([...answer, ...distractors], seed ^ 0x9e3779b9);
  return { kind: 'vProduce', itemId: `${v.id}#produce`, prompt: v.meaning, word: v.word, reading: v.reading, answer, tiles };
}
export function produceEligible(level: string): V[] {
  return VOCAB.filter((v) => v.level === level && /^[ぁ-ゖー]+$/.test(v.reading) && v.reading.length >= 2 && toMorae(v.reading).length <= 6 && toMorae(v.reading).length >= 2);
}

// ── 文法 完全並べ替え(産出) ──────────────────────────────
// orderFull(一意性監査済み569問)のうち当該レベル。itemId は pointId(=grammar.id)優先、無ければ bank id。
interface OrderSrc { idx: number; kb: KB; order: number[] }
export function orderEligible(level: string): OrderSrc[] {
  const out: OrderSrc[] = [];
  for (const key of Object.keys(ORDER_FULL)) {
    const idx = Number(key);
    const kb = KB[idx];
    if (kb && kb.level === level && kb.daimon === 'order' && !kb.ambiguous) out.push({ idx, kb, order: ORDER_FULL[key] });
  }
  return out;
}
function gOrder(src: OrderSrc, seed: number): DrillProblem {
  const tiles = src.kb.choices;
  const itemId = src.kb.pointId ? `${src.kb.pointId}#order` : `bk:order:${src.idx}`;
  // 表示順は元順のまま偏らないようシャッフル。correctOrder は tiles(元順)に対する正しい並び。
  const scrambled = shuffle(tiles.map((_, i) => i), seed);
  return { kind: 'gOrder', itemId, tiles, correctOrder: src.order, scrambled };
}

// ── 文法 意味(受容4択) ──────────────────────────────────
export function meaningEligible(level: string): G[] {
  return GRAMMAR.filter((g) => g.level === level && !!g.meaning);
}

// SRS優先度: 未習(state無し)を最優先、次に p(習得度)が低い順。state未提供なら seed シャッフル。
function orderBySrs<T>(items: T[], keyOf: (t: T) => string, itemsState: Record<string, { p: number }> | undefined, seed: number): T[] {
  const shuffled = shuffle(items, seed);
  if (!itemsState) return shuffled;
  return shuffled.sort((a, b) => {
    const pa = itemsState[keyOf(a)]?.p ?? -1; // 未習=-1で最優先
    const pb = itemsState[keyOf(b)]?.p ?? -1;
    return pa - pb;
  });
}

/** 指定形式・レベルの出題バッチ(count問)。itemsState を渡すと SRS(未習/低習得優先)で並べる。 */
export function buildDrill(kind: DrillKind, level: string, count = 10, seed = 1, itemsState?: Record<string, { p: number }>): DrillProblem[] {
  if (kind === 'vProduce') {
    const pool = orderBySrs(produceEligible(level), (v) => `${v.id}#produce`, itemsState, seed);
    return pool.slice(0, count).map((v, i) => vProduce(v, seed + i * 7919));
  }
  if (kind === 'gOrder') {
    const pool = orderBySrs(orderEligible(level), (s) => (s.kb.pointId ? `${s.kb.pointId}#order` : `bk:order:${s.idx}`), itemsState, seed);
    return pool.slice(0, count).map((s, i) => gOrder(s, seed + i * 7919));
  }
  const pool = orderBySrs(meaningEligible(level), (g) => `${g.id}#gmeaning`, itemsState, seed);
  return pool.slice(0, count)
    .map((g, i) => {
      const p = grammarMeaningProblem(g.id, seed + i * 7919);
      if (!p) return null;
      return { kind: 'gMeaning' as const, itemId: `${g.id}#gmeaning`, prompt: p.prompt, choices: p.choices, answerIndex: p.answerIndex };
    })
    .filter((x): x is Extract<DrillProblem, { kind: 'gMeaning' }> => x !== null);
}
