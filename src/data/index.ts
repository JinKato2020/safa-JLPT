// データローダー: 生成JSONを型付きで読み込み、JLPTエンジン用に「区分ごとの項目」を供給する。
// データ生成は ../data-build/build_data.py(再現可能ビルド)。
import kanji from './kanji.json';
import vocab from './vocab.json';
import grammar from './grammar.json';
import reading from './reading.json';
import listening from './listening.json';
import vocabExamples from './vocabExamples.json';
import vocabExtExamples from './vocabExtExamples.json';
import metaJson from './meta.json';
import grammarClozeOkJson from './grammarClozeOk.json';
import vocabClozeOkJson from './vocabClozeOk.json';
import vocabSynonymsJson from './vocabSynonyms.json';
import knowledgeBankJson from './knowledgeBank.json';
import dictExtJson from './dictExt.json';
import vocabFreqJson from './vocabFreq.json';
import jftBandsJson from './jftBands.json';
import vocabFurigana from './vocabFurigana.json';
import kanjiExamples from './kanjiExamples.json';
import kanjiExamplesMulti from './kanjiExamplesMulti.json';
import kanjiReadings from './kanjiReadings.json';
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

// 漢字の音/訓「表示」を整える(常用・頻出順・古語/稀を除外。kanjiReadings.json=並べ替え・取捨のみ・新造なし)。
export const KANJI = (kanji as KanjiItem[]).map((k) => {
  const r = (kanjiReadings as Record<string, { on: string; kun: string }>)[k.char];
  return r ? { ...k, on: r.on, kun: r.kun } : k;
});
export const VOCAB = vocab as VocabItem[];
export const GRAMMAR = grammar as GrammarItem[];
export const META = metaJson as Meta;

/** 穴埋め(cloze)が適切な文法ID集合(LLM判定・答えが一意にならない曖昧な文法は除外)。 */
export const GRAMMAR_CLOZE_OK = new Set(grammarClozeOkJson as string[]);

/** 穴埋め(cloze)が適切な語彙ID集合(LLM判定・答えが一意に決まる語のみ。彼/妻・青/赤等の曖昧語は除外)。 */
export const VOCAB_CLOZE_OK = new Set(vocabClozeOkJson as string[]);

/** 検証済みの類義語(言い換え類義)。vocabId → 意味が近い語。WordNet候補からLLM選別・検証(N5-N3)。 */
export const VOCAB_SYN = vocabSynonymsJson as Record<string, string>;

/** 知識バンク=実データから作れない大問(用法/文の組み立て/文章の文法)の生成問題。模試で本番比率に使う。 */
export interface KnowledgeBankItem { level: string; daimon: string; stem: string; question: string; choices: string[]; answer: string; explain: string; }
export const KNOWLEDGE_BANK = knowledgeBankJson as KnowledgeBankItem[];

/** 辞書Browse拡張(N2/N1・参考辞書・学習対象外)。JMdict/KANJIDIC由来。levelがN2/N1なのでcastで型を通す。 */
export const DICT_EXT_VOCAB = (dictExtJson.vocab as unknown) as VocabItem[];
export const DICT_EXT_KANJI = (dictExtJson.kanji as unknown) as KanjiItem[];

/** 語彙の難易度＝使用頻度スコア(小さいほど高頻度=易。JMdict頻度由来)。新出を易しい順に導入する材料。 */
export const VOCAB_FREQ = vocabFreqJson as Record<string, number>;

// 語彙の短い例文(無料・田中コーパス/EDRDG examples・CC-BY)。vocabId → { ja, en }。
// N5-N3コア(vocabExamples)＋N2/N1拡張辞書(vocabExtExamples)を統合＝辞書Browseで全級に例文＋下線。
export interface VocabExample { ja: string; en: string; }
export const VOCAB_EXAMPLE = {
  ...(vocabExamples as Record<string, VocabExample>),
  ...(vocabExtExamples as Record<string, VocabExample>),
};

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

// 漢字の音訓 例語(複数読み・頻度順)。char → { on:[{reading(カナ),word,wordReading}], kun:[{reading(かな),word,wordReading}] }。
// 生成: data-build/_build_kanji_multi.js(例語の読みが その音/訓を実際に含む検証済＝捏造ゼロ)。N5-N1対応。
export interface KanjiReadingExample { reading: string; word: string; wordReading: string; }
export interface KanjiExampleMulti { on?: KanjiReadingExample[]; kun?: KanjiReadingExample[]; }
export const KANJI_EXAMPLE_MULTI = kanjiExamplesMulti as Record<string, KanjiExampleMulti>;
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
  subtype?: ReadingSubtype; // 小区分の明示指定(データ正本)。無ければ format から推定。
}
export interface ListeningItem {
  id: string; level: Level; category: 'choukai'; type: 'listening';
  title: string; script: string; questions: PassageQuestion[];
  qtype?: string; // 公式型ラベル: 課題理解/ポイント理解/概要理解/発話表現/即時応答 等(任意)
  subtype?: ListeningSubtype; // 小区分の明示指定(データ正本)。無ければ qtype→台本構造で推定。
  illust?: string; // 発話表現など: イラストのキー(listeningImage.illustSource でDL)。
  audio?: boolean; // 音声(mp3)あり=オンデマンドDLで再生(listeningSource)。無ければテキスト/イラスト表示。
  audioChoices?: boolean; // 発話/即時: 選択肢を音声で読む(本文＋番号→選択肢の連結mp3)。画面は番号のみ・シャッフル不可・回答後に本文/選択肢開示。
}

export const READING = reading as ReadingItem[];
export const LISTENING = listening as ListeningItem[];

/** 学習用の読解(後ろ EXAM_READING 本は模試専用に除外)。 */
export function readingItemsFor(level: Level): ReadingItem[] {
  const all = READING.filter((i) => i.level === level);
  return all.length > EXAM_READING ? all.slice(0, all.length - EXAM_READING) : all;
}

/** 読解の小区分(JLPT大問型)。学習タブで区分の下にさらに分ける。長文=N3大問6。 */
export type ReadingSubtype = 'naiyou_tan' | 'naiyou_chu' | 'choubun' | 'joho';
const FORMAT_SUB: Record<string, ReadingSubtype> = {
  'お知らせ': 'naiyou_tan', 'メール': 'naiyou_tan', 'メモ': 'naiyou_tan', '掲示': 'naiyou_tan', '予定': 'naiyou_tan', '案内': 'naiyou_tan', '説明書': 'naiyou_tan', '紹介': 'naiyou_tan',
  '中文': 'naiyou_chu', '説明文': 'naiyou_chu', '意見文': 'naiyou_chu', '随筆': 'naiyou_chu', '手紙': 'naiyou_chu',
  '長文': 'choubun',
  '情報検索': 'joho',
};
/** 読解1本の小区分(明示 subtype を優先。無ければ format→本文長で推定)。 */
export function readingSubtype(it: ReadingItem): ReadingSubtype {
  if (it.subtype) return it.subtype;
  return FORMAT_SUB[it.format] ?? ((it.body?.replace(/\s/g, '').length ?? 0) > 200 ? 'naiyou_chu' : 'naiyou_tan');
}
/** レベル×小区分の読解(その級・区分の全本=学習で全コンテンツに到達できる)。 */
export function readingItemsForSub(level: Level, sub: ReadingSubtype): ReadingItem[] {
  return READING.filter((it) => it.level === level && readingSubtype(it) === sub);
}
export const READING_SUBTYPES: { key: ReadingSubtype; labelKey: string }[] = [
  { key: 'naiyou_tan', labelKey: 'study.sub_naiyou_tan' },
  { key: 'naiyou_chu', labelKey: 'study.sub_naiyou_chu' },
  { key: 'choubun', labelKey: 'study.sub_choubun' },
  { key: 'joho', labelKey: 'study.sub_joho' },
];
export function examReadingFor(level: Level): ReadingItem[] {
  const all = READING.filter((i) => i.level === level);
  return all.length > EXAM_READING ? all.slice(all.length - EXAM_READING) : [];
}
export function listeningItemsFor(level: Level): ListeningItem[] {
  const all = LISTENING.filter((i) => i.level === level);
  return all.length > EXAM_LISTENING ? all.slice(0, all.length - EXAM_LISTENING) : all;
}

/** 聴解の小区分(JLPT聴解 大問型)。学習タブで聴解の下にさらに分ける。 */
export type ListeningSubtype = 'kadai' | 'point' | 'gaiyou' | 'hatsuwa' | 'sokuji';
const QTYPE_SUB: Record<string, ListeningSubtype> = {
  '課題理解': 'kadai', '指示・アナウンス': 'kadai',
  'ポイント理解': 'point', '店・公共機関': 'point',
  '概要理解': 'gaiyou', '発話表現': 'hatsuwa', '即時応答': 'sokuji',
};
/** 聴解1本の小区分(明示 subtype 優先→qtype→台本構造で推定)。 */
export function listeningSubtype(it: ListeningItem): ListeningSubtype {
  if (it.subtype) return it.subtype;
  if (it.qtype && QTYPE_SUB[it.qtype]) return QTYPE_SUB[it.qtype];
  const turns = it.script ? it.script.split('　').map((s) => s.trim()).filter(Boolean).length : 0;
  const len = it.script ? it.script.replace(/\s/g, '').length : 0;
  if (turns <= 1 && len < 40) return 'sokuji'; // 短い1発話=即時応答
  if (turns <= 1) return 'gaiyou';             // 1話者の独話=概要理解
  return 'kadai';                              // 会話=課題理解(既定)
}
/** レベル×小区分の聴解(その級・区分の全本)。 */
export function listeningItemsForSub(level: Level, sub: ListeningSubtype): ListeningItem[] {
  return LISTENING.filter((it) => it.level === level && listeningSubtype(it) === sub);
}
export const LISTENING_SUBTYPES: { key: ListeningSubtype; labelKey: string }[] = [
  { key: 'kadai', labelKey: 'study.lsub_kadai' },
  { key: 'point', labelKey: 'study.lsub_point' },
  { key: 'gaiyou', labelKey: 'study.lsub_gaiyou' },
  { key: 'hatsuwa', labelKey: 'study.lsub_hatsuwa' },
  { key: 'sokuji', labelKey: 'study.lsub_sokuji' },
];
export function examListeningFor(level: Level): ListeningItem[] {
  const all = LISTENING.filter((i) => i.level === level);
  return all.length > EXAM_LISTENING ? all.slice(all.length - EXAM_LISTENING) : [];
}

/** そのレベルの全聴解音声id(学習＋模試)。レベル一括プリフェッチ用。音声(mp3)を持つ問題のみ(発話/即時も音声化済なので含む)。 */
export function listeningAudioIdsFor(level: Level): string[] {
  return LISTENING.filter((i) => i.level === level && i.audio).map((i) => i.id);
}

/** レベルの読解設問idを小区分別に(full=学習＋模試 / !full=学習集合)。評価の大問加重用。 */
export function readingIdsBySub(level: Level, full: boolean): Partial<Record<ReadingSubtype, string[]>> {
  const items = full ? READING.filter((i) => i.level === level) : readingItemsFor(level);
  const out: Partial<Record<ReadingSubtype, string[]>> = {};
  for (const it of items) { const s = readingSubtype(it); (out[s] ??= []).push(...it.questions.map((q) => q.id)); }
  return out;
}
/** レベルの聴解設問idを区分別に(full=学習＋模試 / !full=学習集合)。評価の大問加重用。 */
export function listeningIdsBySub(level: Level, full: boolean): Partial<Record<ListeningSubtype, string[]>> {
  const items = full ? LISTENING.filter((i) => i.level === level) : listeningItemsFor(level);
  const out: Partial<Record<ListeningSubtype, string[]>> = {};
  for (const it of items) { const s = listeningSubtype(it); (out[s] ??= []).push(...it.questions.map((q) => q.id)); }
  return out;
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

// --- JFT-Basic 知識スコープ = A1+A2 = N5+N4(統合・レベル選択なし)。N3は上積み(介護)で範囲外。 ---
const JFT_LEVELS: Level[] = ['N5', 'N4'];
/** JFT学習集合(小リング分母) = N5+N4 の学習項目。 */
export function jftItemIdsFor(category: Category): string[] {
  return JFT_LEVELS.flatMap((lv) => ringItemIdsFor(lv, category));
}
/** JFT到達度の分母 = N5+N4 の学習＋模試。 */
export function allJftItemIdsFor(category: Category): string[] {
  return JFT_LEVELS.flatMap((lv) => allItemIdsFor(lv, category));
}

/** JFT難易度帯タグ(itemId → A1/A2.1/A2.2)。level＋頻度から自作(クリーン・いろどり非使用)。 */
export const JFT_BANDS = jftBandsJson as Record<string, 'A1' | 'A2.1' | 'A2.2'>;
