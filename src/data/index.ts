// データローダー: 生成JSONを型付きで読み込み、JLPTエンジン用に「区分ごとの項目」を供給する。
// データ生成は ../data-build/build_data.py(再現可能ビルド)。
import kanji from './kanji.json';
import vocab from './vocab.json';
import grammar from './grammar.json';
import reading from './reading.json';
import listening from './listening.json';
import vocabExamples from './vocabExamples.json';
import metaJson from './meta.json';
import grammarClozeOkJson from './grammarClozeOk.json';
import vocabFurigana from './vocabFurigana.json';
import kanjiExamples from './kanjiExamples.json';
import type { Category, Level } from '../engine/engine';

export interface KanjiItem {
  id: string; level: Level; category: 'moji_goi'; type: 'kanji';
  char: string; on: string; kun: string; meaning: string; strokes: number; grade: number;
}
export interface VocabItem {
  id: string; level: Level; category: 'moji_goi'; type: 'vocab';
  word: string; reading: string; meaning: string; tags: string[];
}
export interface GrammarItem {
  id: string; level: Level; category: 'bunpou'; type: 'grammar';
  point: string; romaji: string; meaning: string; exampleJa: string; exampleEn: string;
}
export type StudyItem = KanjiItem | VocabItem | GrammarItem;

export interface Meta {
  levels: Level[];
  ringCategories: Category[];
  ringLabels: Record<Category, string>;
  passMarks: Record<Level, {
    overall: number; maxTotal: number; timeMin: number;
    sections: Record<string, { max: number; min: number }>;
  }>;
  license: string;
}

export const KANJI = kanji as KanjiItem[];
export const VOCAB = vocab as VocabItem[];
export const GRAMMAR = grammar as GrammarItem[];
export const META = metaJson as Meta;

/** 穴埋め(cloze)が適切な文法ID集合(LLM判定・答えが一意にならない曖昧な文法は除外)。 */
export const GRAMMAR_CLOZE_OK = new Set(grammarClozeOkJson as string[]);

// 語彙の短い例文(無料・田中コーパス/EDRDG examples・CC-BY)。vocabId → { ja, en }。
export interface VocabExample { ja: string; en: string; }
export const VOCAB_EXAMPLE = vocabExamples as Record<string, VocabExample>;

/** 語彙例文のふりがな付き版(MeCab生成・漢字(よみ)形式)。vocabId → ふりがな文。無い語は素のjaを使う。 */
export const VOCAB_FURIGANA = vocabFurigana as Record<string, string>;

// 各漢字の用例(無料・同梱JMdict由来): 音読み=熟語(漢字2字+)／訓読み=送り仮名 or 単漢字(主要訓を優先)。
// 読みが難しい字(止→止まる, 出→出口+出 等)も音訓2例を併記。
const KANJI_RE = /[㐀-鿿]/;
const ALL_HIRA = /^[ぁ-ゖー]+$/;
const MULTI_FORM = /[;；/／\s]/; // 「川; 河」のような多形は熟語ではない
const stripWave = (s: string | null | undefined) => (s || '').replace(/[～~]/g, '');
// 送り仮名「.」を含まない=名詞的な訓(漢字単独で読める)
const nounKunSet = (field: string | null | undefined) =>
  new Set((field || '').split('、').map((r) => r.replace(/-/g, '').trim()).filter((r) => r && !r.includes('.')));
// 主要訓(先頭エントリ)の語幹。例: 止「と.まる、…」→ と
const primaryKunStem = (field: string | null | undefined) =>
  ((field || '').split('、')[0] || '').replace(/-/g, '').split('.')[0].trim();
const kanjiCountOf = (w: string) => Array.from(w).filter((x) => KANJI_RE.test(x)).length;

export interface KanjiExample {
  word: string;
  reading: string;
  kun?: { word: string; reading: string };
}
export const KANJI_EXAMPLE: Record<string, KanjiExample> = (() => {
  const byChar: Record<string, VocabItem[]> = {};
  for (const v of VOCAB) {
    const word = stripWave(v.word);
    if (!word || !v.reading) continue;
    for (const ch of new Set(word.split(''))) {
      if (KANJI_RE.test(ch)) (byChar[ch] ||= []).push(v);
    }
  }
  const out: Record<string, KanjiExample> = {};
  for (const k of KANJI) {
    const ch = k.char;
    const cands = byChar[ch];
    if (!cands) continue;
    const nkun = nounKunSet(k.kun);
    const pk = primaryKunStem(k.kun);
    const byLen = [...cands].sort((a, b) => stripWave(a.word).length - stripWave(b.word).length);
    // 訓: 単漢字(名詞訓) or 漢字+送り仮名。主要訓で始まる読みを優先(止→止まる, 止むより優先)。
    const isKun = (v: VocabItem) => {
      const w = stripWave(v.word);
      const rd = v.reading || '';
      return (w === ch && nkun.has(rd)) || (w.length >= 2 && w[0] === ch && ALL_HIRA.test(w.slice(1)));
    };
    const kuns = byLen.filter(isKun);
    const kunEx = (pk && kuns.find((v) => (v.reading || '').startsWith(pk))) || kuns[0];
    // 音: 漢字2字以上の熟語(多形・送り仮名は除外)。無ければ訓以外の何か。
    const isCompound = (v: VocabItem) => {
      const w = stripWave(v.word);
      return !MULTI_FORM.test(w) && kanjiCountOf(w) >= 2;
    };
    const onEx = byLen.find(isCompound) || byLen.find((v) => v !== kunEx) || byLen[0];
    if (!onEx) continue;
    const ex: KanjiExample = { word: stripWave(onEx.word), reading: onEx.reading || '' };
    if (kunEx && kunEx !== onEx) ex.kun = { word: stripWave(kunEx.word), reading: kunEx.reading || '' };
    out[ch] = ex;
  }
  // キュレート版(LLM精選・読み検証済 kanjiExamples.json)で上書き=音/訓を適正化(上→以上いじょう/天→天の川/気→訓なし 等)。未カバー字は導出のまま。
  Object.assign(out, kanjiExamples as Record<string, KanjiExample>);
  return out;
})();

// --- 学習(study) / 模試専用(exam・初見) の分割 ---
// 模試は「学習で答えを覚えた問題」を避けるため、各区分の一部を模試専用に held-out(初見)。
//   語彙/文法: EXAM_EVERY 個に1つ。 読解/聴解: 各級 後ろ EXAM_* 本。
// 小リング(区分別)=学習集合のみ(学習だけで100%に届く)。 大リング(到達度/合格)=学習＋模試(allItemIds)で、模試が重みで反映。
const EXAM_EVERY = 7;
const EXAM_READING = 3;
const EXAM_LISTENING = 3;

function wordsOf(level: Level, category: Category): StudyItem[] {
  if (category === 'moji_goi') return [...KANJI, ...VOCAB].filter((i) => i.level === level);
  if (category === 'bunpou') return GRAMMAR.filter((i) => i.level === level);
  return [];
}
const isExamIndex = (i: number) => i % EXAM_EVERY === EXAM_EVERY - 1;

/** 学習で使う語(漢字+語彙 / 文法)。模試専用を除外。読解/聴解は readingItemsFor 等で。 */
export function itemsFor(level: Level, category: Category): StudyItem[] {
  return wordsOf(level, category).filter((_, i) => !isExamIndex(i));
}
/** 模試専用の語(初見・学習には出ない)。 */
export function examWordsFor(level: Level, category: Category): StudyItem[] {
  return wordsOf(level, category).filter((_, i) => isExamIndex(i));
}
/** 全語(学習＋模試)。誤答候補プールや弱点ドリルの照合に使う。 */
export function allWordsFor(level: Level, category: Category): StudyItem[] {
  return wordsOf(level, category);
}
export function totalItemsFor(level: Level, category: Category): number {
  return itemsFor(level, category).length;
}

// --- 読解/聴解(本セッション作成。設問単位でリング/採点に合流) ---
export interface PassageQuestion {
  id: string; q: string; choices: string[]; answerIndex: number; explain: string;
}
export interface ReadingItem {
  id: string; level: Level; category: 'dokkai'; type: 'reading';
  format: string; title: string; body: string; questions: PassageQuestion[];
}
export interface ListeningItem {
  id: string; level: Level; category: 'choukai'; type: 'listening';
  title: string; script: string; questions: PassageQuestion[];
}

export const READING = reading as ReadingItem[];
export const LISTENING = listening as ListeningItem[];

/** 学習用の読解(後ろ EXAM_READING 本は模試専用に除外)。 */
export function readingItemsFor(level: Level): ReadingItem[] {
  const all = READING.filter((i) => i.level === level);
  return all.length > EXAM_READING ? all.slice(0, all.length - EXAM_READING) : all;
}
export function examReadingFor(level: Level): ReadingItem[] {
  const all = READING.filter((i) => i.level === level);
  return all.length > EXAM_READING ? all.slice(all.length - EXAM_READING) : [];
}
export function listeningItemsFor(level: Level): ListeningItem[] {
  const all = LISTENING.filter((i) => i.level === level);
  return all.length > EXAM_LISTENING ? all.slice(0, all.length - EXAM_LISTENING) : all;
}
export function examListeningFor(level: Level): ListeningItem[] {
  const all = LISTENING.filter((i) => i.level === level);
  return all.length > EXAM_LISTENING ? all.slice(all.length - EXAM_LISTENING) : [];
}

/** 小リング/学習カウントの分母 = 学習集合(模試専用を除外)。学習だけで100%に届く。 */
export function ringItemIdsFor(level: Level, category: Category): string[] {
  if (category === 'moji_goi' || category === 'bunpou') return itemsFor(level, category).map((i) => i.id);
  if (category === 'dokkai') return readingItemsFor(level).flatMap((r) => r.questions.map((q) => q.id));
  return listeningItemsFor(level).flatMap((l) => l.questions.map((q) => q.id));
}
/** 大リング(到達度/合格)の分母 = 学習＋模試(全項目)。模試を受けて初めて満ちる。 */
export function allItemIdsFor(level: Level, category: Category): string[] {
  if (category === 'moji_goi' || category === 'bunpou') return wordsOf(level, category).map((i) => i.id);
  if (category === 'dokkai') return READING.filter((i) => i.level === level).flatMap((r) => r.questions.map((q) => q.id));
  return LISTENING.filter((i) => i.level === level).flatMap((l) => l.questions.map((q) => q.id));
}
