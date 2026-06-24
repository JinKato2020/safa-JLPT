// 診断クイズの出題ロジック(純粋・RN非依存・テスト可)。
// 4択生成 / 出題キュー(優先順) / 間違い再挿入(分散学習)。
import type { StudyItem } from '../data';
import { VOCAB_EXAMPLE, GRAMMAR_CLOZE_OK, VOCAB_CLOZE_OK, VOCAB_SYN } from '../data';
import { highlightSegments } from './highlight';
import { effectiveP, type ItemState } from '../engine/engine';

// 問題形式(弱点ヒートマップの軸＋出題の多様化)。
export type QFormat = 'reading' | 'meaning' | 'reverse' | 'cloze' | 'usage' | 'orthography' | 'synonym';
export const FORMAT_LABEL: Record<QFormat, string> = {
  reading: '読み',
  meaning: '意味',
  reverse: '意味→語',
  orthography: '表記',
  synonym: '類義語',
  cloze: '穴埋め',
  usage: '文法・用法',
};

// 例文ヒント = 下線セグメント列(共通 highlightSegments の結果)。多部分(A〜B)・1文字対応。
export type ExampleHint = { text: string; hit: boolean }[];

export interface Question {
  itemId: string;
  prompt: string;     // 提示(語/漢字/文法点)
  reading?: string;   // 補助(ローマ字など)
  example?: ExampleHint; // 例文ヒント(下線付き・文法用)
  question: string;   // 設問文
  format: QFormat;    // 問題形式(ヒートマップ集計用)
  choices: string[];
  answerIndex: number;
}

export type Rng = () => number;

const KANJI_RE = /[㐀-龯豈-﫿]/;
export function hasKanji(s: string): boolean {
  return KANJI_RE.test(s);
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 選択肢の語義は最初の1つだけ(英gloss はカンマ区切りで長いため短く) */
function firstSense(meaning: string): string {
  return meaning.split(/[,、;；]/)[0].trim();
}

// 正解と候補の「紛らわしさ」スコア。文字の共有・先頭/末尾一致・長さの近さで近いほど高い。
function similarity(answer: string, v: string): number {
  const a = new Set(answer);
  const b = new Set(v);
  let shared = 0;
  for (const ch of a) if (b.has(ch)) shared++;
  const union = new Set([...answer, ...v]).size || 1;
  const jaccard = shared / union;
  const first = answer[0] === v[0] ? 1 : 0;
  const last = answer[answer.length - 1] === v[v.length - 1] ? 1 : 0;
  const lenPenalty = Math.abs(answer.length - v.length) * 0.5;
  return jaccard * 3 + first + last - lenPenalty;
}

/** 誤答=正解に「紛らわしい(似た)」上位プールから無作為に n 件(完全ランダムより弁別力UP)。 */
function distractors(values: string[], answer: string, n: number, rng: Rng): string[] {
  const uniq = Array.from(new Set(values.filter((v) => v && v !== answer)));
  const ranked = uniq
    .map((v) => ({ v, score: similarity(answer, v) }))
    .sort((x, y) => y.score - x.score)
    .map((x) => x.v);
  const pool = ranked.slice(0, Math.max(n * 3, 8)); // 似ている上位だけに絞る
  return shuffle(pool, rng).slice(0, n);
}

const FURI = /（[^）]*）/g;
const KANA_RE = /[ぁ-ゟ]/;
const noWave = (s: string) => (s || '').replace(/[～~]/g, '');

/** 語彙の例文中の語を〔　〕に。例文が無い/語が含まれないなら null。 */
function vocabCloze(item: StudyItem): string | null {
  if (item.type !== 'vocab') return null;
  const ex = VOCAB_EXAMPLE[item.id];
  const w = noWave(item.word);
  if (!ex || !ex.ja || !w || !ex.ja.includes(w)) return null;
  return ex.ja.replace(w, '〔　〕');
}
/** 文法の例文中の該当文法を〔　〕に(活用語尾も含める)。見つからなければ null。
 * ※穴埋めの出題可否は GRAMMAR_CLOZE_OK(LLM判定の適性ホワイトリスト)で別途ゲートする。 */
function grammarCloze(item: StudyItem): string | null {
  if (item.type !== 'grammar' || !item.exampleJa) return null;
  const plain = item.exampleJa.replace(FURI, '');
  const core = item.point
    .replace(FURI, '')
    .split(/[〜～]/)
    .map((p) => p.replace(/\s/g, '').trim())
    .filter(Boolean)[0] ?? '';
  if (core.length < 2) return null;
  let at = -1;
  let len = 0;
  for (let L = core.length; L >= 2; L--) {
    const i = plain.indexOf(core.slice(0, L));
    if (i >= 0) { at = i; len = L; break; }
  }
  if (at < 0) return null;
  let end = at + len;
  if (len < core.length) while (end < plain.length && KANA_RE.test(plain[end])) end++;
  return `${plain.slice(0, at)}〔　〕${plain.slice(end)}`;
}
/** 文法の例文中の該当文法の位置を返す(下線表示用・furigana除去)。見つからなければ null。 */
function grammarHighlight(item: StudyItem): ExampleHint | null {
  if (item.type !== 'grammar' || !item.exampleJa) return null;
  const segs = highlightSegments(item.exampleJa.replace(FURI, ''), item.point);
  return segs.some((sg) => sg.hit) ? segs : null;
}

interface Built {
  prompt: string;
  reading?: string;
  example?: ExampleHint;
  question: string;
  format: QFormat;
  answer: string;
  valueOf: (x: StudyItem) => string;
}

/** itemの型ごとの出題フォーマット候補(複数)。makeQuestion が rng で1つ選ぶ＝多様化。 */
function buildersFor(item: StudyItem): Built[] {
  const out: Built[] = [];
  if (item.type === 'vocab') {
    const meaning = firstSense(item.meaning);
    const vMean = (x: StudyItem) => (x.type === 'vocab' ? firstSense(x.meaning) : '');
    const vWord = (x: StudyItem) => (x.type === 'vocab' ? x.word : '');
    if (hasKanji(item.word)) {
      out.push({ prompt: item.word, question: '読みは？', format: 'reading', answer: item.reading, valueOf: (x) => (x.type === 'vocab' ? x.reading : '') });
    }
    out.push({ prompt: item.word, question: '意味は？', format: 'meaning', answer: meaning, valueOf: vMean });
    out.push({ prompt: meaning, question: 'この意味の語は？', format: 'reverse', answer: item.word, valueOf: vWord });
    const cz = vocabCloze(item);
    // 穴埋めは「答えが一意に決まる」とLLM判定された語彙のみ(VOCAB_CLOZE_OK)。曖昧語(彼/妻・青/赤等)は除外。
    if (cz && VOCAB_CLOZE_OK.has(item.id)) out.push({ prompt: cz, question: '〔　〕に入る語は？', format: 'cloze', answer: item.word, valueOf: vWord });
    // 表記(JLPT問題2): ひらがな(読み)→正しい漢字。漢字を含む語のみ。
    if (hasKanji(item.word)) {
      out.push({ prompt: item.reading, question: '正しい漢字（表記）は？', format: 'orthography', answer: item.word, valueOf: vWord });
    }
    // 類義語(JLPT問題4 言い換え類義): 検証済みの近い意味の語があるもののみ。
    const syn = VOCAB_SYN[item.id];
    if (syn) out.push({ prompt: item.word, question: '意味がいちばん近いのは？', format: 'synonym', answer: syn, valueOf: vWord });
  } else if (item.type === 'kanji') {
    const meaning = firstSense(item.meaning);
    out.push({ prompt: item.char, question: '意味は？', format: 'meaning', answer: meaning, valueOf: (x) => (x.type === 'kanji' ? firstSense(x.meaning) : '') });
    out.push({ prompt: meaning, question: 'この意味の漢字は？', format: 'reverse', answer: item.char, valueOf: (x) => (x.type === 'kanji' ? x.char : '') });
  } else {
    const meaning = firstSense(item.meaning);
    const gPoint = (x: StudyItem) => (x.type === 'grammar' ? x.point : '');
    const exPlain = item.exampleJa ? item.exampleJa.replace(FURI, '') : '';
    const hl = grammarHighlight(item);
    out.push({
      prompt: item.point,
      reading: hl ? undefined : exPlain || item.romaji,
      example: hl ?? undefined,
      question: hl ? '意味・用法は？（下線部の文法）' : exPlain ? '意味・用法は？（例文がヒント）' : '意味・用法は？',
      format: 'usage', answer: meaning, valueOf: (x) => (x.type === 'grammar' ? firstSense(x.meaning) : ''),
    });
    out.push({ prompt: meaning, question: 'この意味の文法は？', format: 'reverse', answer: item.point, valueOf: gPoint });
    // 穴埋め(cloze)は「答えが一意に決まる」とLLM判定された文法のみ(GRAMMAR_CLOZE_OK)。曖昧なものは除外。
    if (GRAMMAR_CLOZE_OK.has(item.id)) {
      const cz = grammarCloze(item);
      if (cz) out.push({ prompt: cz, question: '〔　〕に入るのは？', format: 'cloze', answer: item.point, valueOf: gPoint });
    }
  }
  return out;
}

/** 1項目 → 4択問題。型ごとに複数形式(読み/意味/意味→語/穴埋め 等)から rng で選び多様化。誤答は同型プールから賢く。 */
export function makeQuestion(item: StudyItem, pool: StudyItem[], rng: Rng = Math.random): Question {
  const builders = buildersFor(item);
  const b = builders[Math.floor(rng() * builders.length)] ?? builders[0];
  const wrongs = distractors(pool.map(b.valueOf).filter((v) => v !== b.prompt), b.answer, 3, rng);
  const choices = shuffle([b.answer, ...wrongs], rng);
  return { itemId: item.id, prompt: b.prompt, reading: b.reading, example: b.example, question: b.question, format: b.format, choices, answerIndex: choices.indexOf(b.answer) };
}

/** 出題キュー: ①再学習/期限切れ(古い順・learning優先) → ②未測定(シャッフル) を最大 n 件。 */
export function buildQueue(
  items: StudyItem[],
  states: Record<string, ItemState>,
  now: number,
  n: number,
  rng: Rng = Math.random,
): StudyItem[] {
  const due: StudyItem[] = [];
  const fresh: StudyItem[] = [];
  for (const it of items) {
    const st = states[it.id];
    if (st && st.dueAt <= now) due.push(it);
    else if (!st) fresh.push(it);
  }
  due.sort((a, b) => {
    const sa = states[a.id];
    const sb = states[b.id];
    const la = sa.reps === 0 ? 0 : 1; // learning(reps0)を先に
    const lb = sb.reps === 0 ? 0 : 1;
    return la !== lb ? la - lb : sa.dueAt - sb.dueAt;
  });
  return [...due, ...shuffle(fresh, rng)].slice(0, n);
}

/** 間違えた item を現在位置から gap 問後に差し込む(分散学習・末尾超過は末尾)。 */
export function reinsertForRelearn<T>(remaining: T[], item: T, gap: number): T[] {
  const next = remaining.slice();
  next.splice(Math.min(gap, next.length), 0, item);
  return next;
}

/** 配列から重複なく最大 n 件を無作為抽出(模試の総合サンプリング用)。 */
export function sample<T>(arr: T[], n: number, rng: Rng = Math.random): T[] {
  return shuffle(arr, rng).slice(0, n);
}

/** 手書き4択(読解/聴解)の選択肢をシャッフルし正答位置を再計算。データは正答=先頭で持ち、表示で位置をランダム化。 */
export function shuffleChoices(choices: string[], answerIndex: number, rng: Rng = Math.random): { choices: string[]; answerIndex: number } {
  const correct = choices[answerIndex];
  const sh = shuffle(choices, rng);
  return { choices: sh, answerIndex: Math.max(0, sh.indexOf(correct)) };
}

export interface DueStats {
  due: number;     // 期限切れ=今日の復習
  fresh: number;   // 未測定=新規
  learned: number; // 習得済(減衰後 p>=0.6)
  total: number;
}

/** 学習ホームのカード用件数。buildQueue と同じ区分け(due/fresh)＋習得済を数える。 */
export function dueStats(
  items: { id: string }[],
  states: Record<string, ItemState>,
  now: number,
): DueStats {
  let due = 0;
  let fresh = 0;
  let learned = 0;
  for (const it of items) {
    const st = states[it.id];
    if (!st) {
      fresh++;
      continue;
    }
    if (st.dueAt <= now) due++;
    if (effectiveP(st, now) >= 0.6) learned++;
  }
  return { due, fresh, learned, total: items.length };
}
