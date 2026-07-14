// 単語タブ「新形式問題」の出題生成。試験タブ(本番形式)とは独立した産出/受容問題。
//  ・vProduce  語彙: 意味 → かなタイルで単語を組む(産出)。itemId=<vocabId>#produce → 語彙カバー率。
//  ・gBuild    文法: 例文の空所に入る文法語を、かなタイルを順に並べて作る(産出)。itemId=<gId>#gbuild → 文法カバー率。
//               ※文の並べ替えは日本語の語順自由で答えが一意にならないため廃止。文法語の綴りは一意=堅牢。
//  ・gMeaning  文法: 文法点の意味を4択(受容)。itemId=<gId>#gmeaning → 文法カバー率。
// 出題順は SRS(state.items の忘却/未習を優先)。専門用語はUIに出さない。タイルは約8個(ダミー多め)。
import vocab from '../data/shared/vocab.json';
import grammar from '../data/shared/grammar.json';
import { grammarMeaningProblem } from './wordTabProblems';
import { mulberry32 } from './rng';

export type DrillKind = 'vProduce' | 'gBuild' | 'gMeaning' | 'mixed';

export type DrillProblem =
  | { kind: 'vProduce'; itemId: string; prompt: string; hint?: string; reading: string; answer: string[]; tiles: string[] }
  | { kind: 'gBuild'; itemId: string; prompt: string; hint?: string; reading: string; answer: string[]; tiles: string[] }
  | { kind: 'gMeaning'; itemId: string; prompt: string; choices: string[]; answerIndex: number; example?: string; hit?: string };

type V = { id: string; level: string; word: string; reading: string; meaning: string };
const VOCAB = vocab as V[];
type G = { id: string; level: string; point: string; meaning: string; exampleJa?: string };
const GRAMMAR = grammar as G[];

const TARGET_TILES = 8; // タイル総数の目安(答えのモーラ＋ダミー)

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
const KANA_POOL = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ'.split('');

const strip = (s: string) => (s || '').replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');

function shuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  return arr.map((v) => ({ v, r: rng() })).sort((a, b) => a.r - b.r).map((x) => x.v);
}

// 答えのモーラ＋ダミーで約8タイルを作る。ダミー=答えに無いかな。
function buildTiles(answer: string[], seed: number): string[] {
  const inAns = new Set(answer);
  const distractCount = Math.max(2, TARGET_TILES - answer.length);
  const pool = shuffle(KANA_POOL.filter((k) => !inAns.has(k)), seed);
  const distractors = pool.slice(0, distractCount);
  return shuffle([...answer, ...distractors], seed ^ 0x9e3779b9);
}

// ── 語彙 産出(意味→かな) ────────────────────────────────
function vProduce(v: V, seed: number): DrillProblem {
  const answer = toMorae(v.reading);
  return { kind: 'vProduce', itemId: `${v.id}#produce`, prompt: v.meaning, hint: v.word, reading: v.reading, answer, tiles: buildTiles(answer, seed) };
}
export function produceEligible(level: string): V[] {
  return VOCAB.filter((v) => v.level === level && /^[ぁ-ゖー]+$/.test(v.reading) && toMorae(v.reading).length >= 2 && toMorae(v.reading).length <= 6);
}

// ── 文法 産出(例文の空所に文法語をかなタイルで作る) ─────────
const isKana = (s: string) => /^[ぁ-ゖァ-ヶーん]+$/.test(s);
// 文法点のクリーンなかな表層形(だけ/ちゃいけない 等)。複数形は先頭、〜や記号は除去。
function pointSurface(g: G): string | null {
  const pt = strip(g.point).split(/[・／/、,]/)[0].replace(/[〜～\s　]/g, '');
  return pt && isKana(pt) && pt.length >= 2 && pt.length <= 8 ? pt : null;
}
export function buildEligible(level: string): { g: G; pt: string }[] {
  const out: { g: G; pt: string }[] = [];
  for (const g of GRAMMAR) {
    if (g.level !== level || !g.exampleJa) continue;
    const pt = pointSurface(g);
    if (!pt) continue;
    if (strip(g.exampleJa).replace(/\s|　/g, '').includes(pt)) out.push({ g, pt });
  }
  return out;
}
function gBuild(src: { g: G; pt: string }, seed: number): DrillProblem {
  const answer = toMorae(src.pt);
  // 例文中の文法語を空所〔　〕に(ふりがな付きのまま最初の1箇所を置換)。
  const prompt = (src.g.exampleJa as string).replace(src.pt, '〔　　〕');
  return { kind: 'gBuild', itemId: `${src.g.id}#gbuild`, prompt, hint: src.g.meaning, reading: src.pt, answer, tiles: buildTiles(answer, seed) };
}

// ── 文法 意味(受容4択) ──────────────────────────────────
export function meaningEligible(level: string): G[] {
  return GRAMMAR.filter((g) => g.level === level && !!g.meaning);
}

// SRS優先度: 未習(state無し)を最優先、次に p(習得度)が低い順。state未提供なら seed シャッフル。
function orderBySrs<T>(items: T[], keyOf: (t: T) => string, itemsState: Record<string, { p: number }> | undefined, seed: number): T[] {
  const shuffled = shuffle(items, seed);
  if (!itemsState) return shuffled;
  return shuffled.sort((a, b) => (itemsState[keyOf(a)]?.p ?? -1) - (itemsState[keyOf(b)]?.p ?? -1));
}

/** 指定形式・レベルの出題バッチ(count問)。itemsState を渡すと SRS(未習/低習得優先)で並べる。
 *  mixed=今日のオススメ: 語彙産出/文法作成/文法意味の3形式を横断で交互出題(単語タブ内で完結・試験タブとは独立)。 */
export function buildDrill(kind: DrillKind, level: string, count = 10, seed = 1, itemsState?: Record<string, { p: number }>): DrillProblem[] {
  if (kind === 'mixed') {
    const per = Math.ceil(count / 3);
    const a = buildDrill('vProduce', level, per, seed, itemsState);
    const b = buildDrill('gBuild', level, per, seed + 101, itemsState);
    const g = buildDrill('gMeaning', level, per, seed + 202, itemsState);
    const mixed: DrillProblem[] = [];
    for (let i = 0; i < per; i++) { if (a[i]) mixed.push(a[i]); if (b[i]) mixed.push(b[i]); if (g[i]) mixed.push(g[i]); }
    return mixed.slice(0, count);
  }
  if (kind === 'vProduce') {
    const pool = orderBySrs(produceEligible(level), (v) => `${v.id}#produce`, itemsState, seed);
    return pool.slice(0, count).map((v, i) => vProduce(v, seed + i * 7919));
  }
  if (kind === 'gBuild') {
    const pool = orderBySrs(buildEligible(level), (s) => `${s.g.id}#gbuild`, itemsState, seed);
    return pool.slice(0, count).map((s, i) => gBuild(s, seed + i * 7919));
  }
  const pool = orderBySrs(meaningEligible(level), (g) => `${g.id}#gmeaning`, itemsState, seed);
  return pool.slice(0, count)
    .map((g, i): DrillProblem | null => {
      const p = grammarMeaningProblem(g.id, seed + i * 7919);
      if (!p) return null;
      // 例文＋対象文法点(下線用)を併設=意味だけでは判別しづらいため用例で示す。
      return { kind: 'gMeaning' as const, itemId: `${g.id}#gmeaning`, prompt: p.prompt, choices: p.choices, answerIndex: p.answerIndex, example: g.exampleJa, hit: g.point };
    })
    .filter((x): x is Extract<DrillProblem, { kind: 'gMeaning' }> => x !== null);
}
