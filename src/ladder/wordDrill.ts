// 単語タブ「新形式問題」の出題生成。試験タブ(本番形式)とは独立した産出/受容問題。
//  ・vProduce  語彙: 意味 → かなタイルで単語を組む(産出)。itemId=<vocabId>#produce → 語彙カバー率。
//  ・gBuild    文法: 例文の空所に入る文法語を、かなタイルを順に並べて作る(産出)。itemId=<gId>#gbuild → 文法カバー率。
//               ※文の並べ替えは日本語の語順自由で答えが一意にならないため廃止。文法語の綴りは一意=堅牢。
//  ・gMeaning  文法: 文法点の意味を4択(受容)。itemId=<gId>#gmeaning → 文法カバー率。
// 出題順は SRS(state.items の忘却/未習を優先)。専門用語はUIに出さない。タイルは約8個(ダミー多め)。
import vocab from '../data/shared/vocab.json';
import grammar from '../data/shared/grammar.json';
import grammarDrillBlank from '../data/shared/grammarDrillBlank.json';
import vocabExamplesAi from '../data/dict/vocabExamplesAi.json';
import vocabProduceOverride from '../data/shared/vocabProduceOverride.json';
const VOCAB_EXAMPLE = vocabExamplesAi as Record<string, { ja?: string }>;
// 産出(語彙パズル)の上書き。機械的な～除去では正しい産出形にならない語(いくら～ても→いくら/～おわる→おわり)用。
const PRODUCE_OVERRIDE = (vocabProduceOverride as { items: Record<string, { reading: string; example: string }> }).items;
import { grammarMeaningProblem, vocabMeaningProblem, vocabReadingProblem, vocabWritingProblem } from './wordTabProblems';
import { mulberry32 } from './rng';

export type DrillKind = 'vProduce' | 'gBuild' | 'gMeaning' | 'vMeaning' | 'vReading' | 'vWriting' | 'mixed';

export type DrillProblem =
  | { kind: 'vProduce'; itemId: string; prompt: string; hint?: string; example?: string; reading: string; answer: string[]; tiles: string[] }
  | { kind: 'gBuild'; itemId: string; prompt: string; hint?: string; reading: string; answer: string[]; tiles: string[] }
  | { kind: 'gMeaning'; itemId: string; prompt: string; choices: string[]; answerIndex: number; example?: string; hit?: string }
  // 語彙 意味認識(受容): 語(表記)を単独提示→意味を4択。文脈が無いので当てずっぽが効かない。reading=採点後に表示。
  | { kind: 'vMeaning'; itemId: string; prompt: string; reading: string; choices: string[]; answerIndex: number }
  // 語彙 読み認識(受容): 語(表記)を単独提示→読みを4択。ルビは出さない(ルビ=答え)。meaning=採点後に表示。
  | { kind: 'vReading'; itemId: string; prompt: string; meaning: string; choices: string[]; answerIndex: number }
  // 語彙 表記認識(受容・かたち): 意味を提示→正しい漢字表記の語を4択。文脈なし。reading=採点後に表示。
  | { kind: 'vWriting'; itemId: string; prompt: string; reading: string; choices: string[]; answerIndex: number };

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
// カタカナ語(アパート/カメラ等)の産出用タイル。ひらがな→カタカナは符号位置 +0x60。
const KATAKANA_POOL = KANA_POOL.map((h) => String.fromCharCode(h.charCodeAt(0) + 0x60));
const isKatakana = (s: string) => /[ァ-ヶ]/.test(s);

const strip = (s: string) => (s || '').replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');

function shuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  return arr.map((v) => ({ v, r: rng() })).sort((a, b) => a.r - b.r).map((x) => x.v);
}

// 答えのモーラ＋ダミーで約8タイルを作る。ダミー=答えに無いかな。カタカナ語はカタカナのダミーを使う。
function buildTiles(answer: string[], seed: number): string[] {
  const inAns = new Set(answer);
  const distractCount = Math.max(2, TARGET_TILES - answer.length);
  const src = answer.some(isKatakana) ? KATAKANA_POOL : KANA_POOL;
  const pool = shuffle(src.filter((k) => !inAns.has(k)), seed);
  const distractors = pool.slice(0, distractCount);
  return shuffle([...answer, ...distractors], seed ^ 0x9e3779b9);
}

// ── 語彙 産出(意味→かな) ────────────────────────────────
// 接辞(～付き)は ～ を外した形で作問する(ユーザー方針: 接辞は～を外して例文の中でパズル化)。
const stripWave = (s: string) => s.replace(/[～~]/g, '');
const producedForm = (v: V): { word: string; reading: string } =>
  /[～~]/.test(v.word) ? { word: stripWave(v.word), reading: stripWave(v.reading) } : { word: v.word, reading: v.reading };

function vProduce(v: V, seed: number): DrillProblem {
  const ov = PRODUCE_OVERRIDE[v.id]; // 上書きがあれば その読み/例文で作問
  const { word, reading } = producedForm(v); // 接辞は～除去後の語/読みで作問
  const ansReading = ov ? ov.reading : reading;
  const answer = toMorae(ansReading);
  // ヒント=単語(漢字表記)。ただし かな語(word===reading)は hint が答えそのものになるので出さない(意味だけで想起)。
  const hint = word !== reading ? word : undefined;
  // 対象語を隠した例文(文脈ヒント)。例文に産出形が出現する時のみ空所〔　　〕に置換。
  const exJa = ov ? ov.example : VOCAB_EXAMPLE[v.id]?.ja;
  const blank = ov ? ov.reading : word;
  const example = exJa && exJa.includes(blank) ? exJa.replace(blank, '〔　　〕') : undefined;
  return { kind: 'vProduce', itemId: `${v.id}#produce`, prompt: v.meaning, hint, example, reading: ansReading, answer, tiles: buildTiles(answer, seed) };
}
export function produceEligible(level: string): V[] {
  // 読みは純ひらがな or 純カタカナ(外来語=カタカナタイルで組む)。2〜8モーラ(一生懸命等の長語も可)。
  // 接辞(～)は ～ を外した語/読みで判定し、かつ例文にその語が出て空所化できる時だけ採用(例文なし=失格スタブを出さない)。
  return VOCAB.filter((v) => {
    if (v.level !== level) return false;
    const ov = PRODUCE_OVERRIDE[v.id];
    if (ov) { // 上書き語=その読みが純かな2〜8モーラで、例文に含まれること
      const r = ov.reading;
      if (!(/^[ぁ-ゖー]+$/.test(r) || /^[ァ-ヶー]+$/.test(r))) return false;
      const m = toMorae(r).length;
      return m >= 2 && m <= 8 && !!ov.example && ov.example.includes(r);
    }
    const affix = /[～~]/.test(v.word);
    const { word, reading } = producedForm(v);
    if (!word) return false;
    if (!(/^[ぁ-ゖー]+$/.test(reading) || /^[ァ-ヶー]+$/.test(reading))) return false;
    const m = toMorae(reading).length;
    if (m < 2 || m > 8) return false;
    if (affix) {
      const ex = VOCAB_EXAMPLE[v.id]?.ja;
      if (!ex || !ex.includes(word)) return false; // 接辞は例文必須(空所化できること)
    }
    return true;
  });
}

// ── 文法 産出(例文の空所に文法語をかなタイルで作る) ─────────
const isKana = (s: string) => /^[ぁ-ゖァ-ヶーん]+$/.test(s);
// 文法点のクリーンなかな表層形(だけ/ちゃいけない 等)。複数形は先頭、〜や記号は除去。
const DRILL_BLANK = grammarDrillBlank as Record<string, { target: string; reading: string }>;
// 漢字（かな）→ かな で純かな読みを得る(#2: 漢字を含む文法点の読みタイル用)。
const toKanaReading = (s: string): string =>
  s.replace(/[一-龥々〆ヶ]+（([ぁ-ゖァ-ヶー]+)）/g, '$1').replace(/（[^）]*）/g, '');
const onceIn = (ex: string, s: string): boolean => {
  if (!s) return false;
  const i = ex.indexOf(s);
  return i >= 0 && ex.indexOf(s, i + s.length) < 0;
};
type Blank = { target: string; reading: string }; // target=例文中の空所にする連続部分 / reading=純かな
// 例文のどこを空所にし、答えは何読みか。優先: ①手当て済み活用形/漢字点(grammarDrillBlank)
//   ②かな表層がそのまま1回出る(既存) ③ふりがな込みトークンが1回出る漢字点(#2)。無ければ null。
function resolveBlank(g: G): Blank | null {
  const ex = g.exampleJa;
  if (!ex) return null;
  const ov = DRILL_BLANK[g.id]; // #3: 活用形/表記ずれを手当て
  if (ov && onceIn(ex, ov.target) && isKana(ov.reading) && toMorae(ov.reading).length >= 2 && toMorae(ov.reading).length <= 8) return ov;
  const kana = strip(g.point).split(/[・／/、,]/)[0].replace(/[〜～\s　]/g, ''); // 既存: かな表層
  if (kana && isKana(kana) && kana.length >= 2 && kana.length <= 8 && onceIn(ex, kana)) return { target: kana, reading: kana };
  const token = g.point.split(/[・／/、,]/)[0].replace(/[〜～\s　]/g, ''); // #2: ふりがな込みトークン(漢字含む)
  if (token && /[一-龥]/.test(token) && onceIn(ex, token)) {
    const reading = toKanaReading(token);
    if (isKana(reading) && toMorae(reading).length >= 2 && toMorae(reading).length <= 8) return { target: token, reading };
  }
  return null;
}
export function buildEligible(level: string): { g: G; blank: Blank }[] {
  const out: { g: G; blank: Blank }[] = [];
  for (const g of GRAMMAR) {
    if (g.level !== level || !g.exampleJa) continue;
    const blank = resolveBlank(g);
    if (blank) out.push({ g, blank });
  }
  return out;
}
function gBuild(src: { g: G; blank: Blank }, seed: number): DrillProblem {
  const answer = toMorae(src.blank.reading);
  // 例文中の文法語を空所〔　〕に(ふりがな付きのまま最初の1箇所を置換)。
  const prompt = (src.g.exampleJa as string).replace(src.blank.target, '〔　　〕');
  return { kind: 'gBuild', itemId: `${src.g.id}#gbuild`, prompt, hint: src.g.meaning, reading: src.blank.reading, answer, tiles: buildTiles(answer, seed) };
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
  if (kind === 'vMeaning') {
    // 全語対象(意味は全語にある)。SRSで未習/低習得を優先。itemId=<vocabId>#vrecog_mean → mean面。
    const pool = orderBySrs(VOCAB.filter((v) => v.level === level), (v) => `${v.id}#vrecog_mean`, itemsState, seed);
    return pool.slice(0, count)
      .map((v, i): DrillProblem | null => {
        const p = vocabMeaningProblem(v.id, seed + i * 7919);
        if (!p) return null;
        // prompt=語の表記(文脈なし)。意味の4択は vocabMeaningProblem 由来(同レベル・同品詞ダミー)。
        return { kind: 'vMeaning' as const, itemId: `${v.id}#vrecog_mean`, prompt: v.word, reading: v.reading, choices: p.choices, answerIndex: p.answerIndex };
      })
      .filter((x): x is Extract<DrillProblem, { kind: 'vMeaning' }> => x !== null);
  }
  if (kind === 'vReading') {
    // 漢字を含む語のみ(かな語は表記=答え)。SRSで未習/低習得を優先。itemId=<vocabId>#vrecog_read → read面。
    const pool = orderBySrs(VOCAB.filter((v) => v.level === level && v.word !== v.reading), (v) => `${v.id}#vrecog_read`, itemsState, seed);
    return pool.slice(0, count)
      .map((v, i): DrillProblem | null => {
        const p = vocabReadingProblem(v.id, seed + i * 7919);
        if (!p) return null;
        // prompt=語の表記(ルビ無しで提示)。読みの4択は vocabReadingProblem 由来(同レベル・近モーラ長ダミー)。
        return { kind: 'vReading' as const, itemId: `${v.id}#vrecog_read`, prompt: v.word, meaning: v.meaning, choices: p.choices, answerIndex: p.answerIndex };
      })
      .filter((x): x is Extract<DrillProblem, { kind: 'vReading' }> => x !== null);
  }
  if (kind === 'vWriting') {
    // 漢字を含む語のみ(かな語は綴りが無い)。意味→漢字表記を4択。itemId=<vocabId>#vrecog_write → write面。
    const pool = orderBySrs(VOCAB.filter((v) => v.level === level && v.word !== v.reading), (v) => `${v.id}#vrecog_write`, itemsState, seed);
    return pool.slice(0, count)
      .map((v, i): DrillProblem | null => {
        const p = vocabWritingProblem(v.id, seed + i * 7919);
        if (!p) return null;
        // prompt=意味(語を一意特定)。漢字表記の4択は vocabWritingProblem 由来(同音異字を優先)。
        return { kind: 'vWriting' as const, itemId: `${v.id}#vrecog_write`, prompt: v.meaning, reading: v.reading, choices: p.choices, answerIndex: p.answerIndex };
      })
      .filter((x): x is Extract<DrillProblem, { kind: 'vWriting' }> => x !== null);
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
