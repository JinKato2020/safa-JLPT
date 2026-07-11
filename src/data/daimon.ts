// 大問(学習区分)モデル = 本番JLPTの大問で学習/出題/評価を統一する基盤。
//  ・文字語彙/文法は1項目を複数の大問で問う(漢字読み/表記/文脈規定/言い換え/用法・文法形式/組み立て/文章の文法)。
//    → 習得度は「項目#大問」キーで大問ごとに別管理(本番精度・ユーザー指定(A))。
//  ・各大問は出題形式を固定(makeQuestionにallowedで強制 or 知識バンクの4択)。
//  ・読解/聴解は1問=1ユニット(設問id)で既にサブタイプ別＝本モジュールは文字語彙/文法を担当。
import { VOCAB, GRAMMAR, GRAMMAR_CLOZE_OK, KNOWLEDGE_BANK, KANJI, VOCAB_EXAMPLE, KANJI_READ_BANK, CONTEXT_BANK, SYNONYM_BANK, ORTHOGRAPHY_BANK, SENTENCE_FURI, LEARN_FURI, JFT_EXPRESSION, passageGrammarSetsFor, type StudyItem } from './index';
import type { Daimon } from './examBlueprint';
import { hasKanji, makeQuestion, shuffleChoices, type Question, type QFormat, type Rng, type SaveRef } from '../quiz/quiz';
import type { Level } from '../engine/engine';

// my単語帳 saveRef 解決用の索引。
// 文法daimon(grammar_form/order/passage_grammar)の bank.pointId → grammar.json 実在id のみ採用(欠落/不整合は無視)。
const GRAMMAR_ID_SET = new Set(GRAMMAR.map((g) => g.id));
// 用法(usage)の bank.stem(語。ふりがな括弧を含み得る) → vocab.json id の逆引き。同語は最初の一致を採用。
const FURI_PAREN = /（[^）]*）/g;
const WORD_TO_VOCAB_ID = new Map<string, string>();
for (const v of VOCAB) { if (!WORD_TO_VOCAB_ID.has(v.word)) WORD_TO_VOCAB_ID.set(v.word, v.id); }
/** 用法バンクの stem(例: "出（だ）す")からふりがなを除いた語で vocab id を逆引き。解決不能なら null。 */
function saveRefForUsageStem(stem: string): SaveRef | null {
  const word = (stem || '').replace(FURI_PAREN, '');
  const id = WORD_TO_VOCAB_ID.get(word);
  return id ? { type: 'vocab', id } : null;
}
/** BANK_INDEX分岐(usage/文法系)の saveRef。解決不能(pointId欠落・未知id・stem不一致)なら undefined。 */
function saveRefForBank(bank: BankUnit): SaveRef | undefined {
  if (bank.daimon === 'grammar_form' || bank.daimon === 'order' || bank.daimon === 'passage_grammar') {
    return bank.pointId && GRAMMAR_ID_SET.has(bank.pointId) ? { type: 'grammar', id: bank.pointId } : undefined;
  }
  if (bank.daimon === 'usage') return saveRefForUsageStem(bank.stem) ?? undefined;
  return undefined;
}
/** `<vocabId>#daimon` 形式のユニットidから vocabId を取り出し saveRef を作る(漢字読み/表記/文脈規定/言い換え共通)。 */
function saveRefForVocabUnit(unit: string): SaveRef {
  return { type: 'vocab', id: unit.split('#')[0] };
}

// 大問 → 固定出題形式(makeQuestion用QFormat) / 'bank'(知識バンクの4択)。
export const DAIMON_FORMAT: Record<Daimon, QFormat | 'bank'> = {
  kanji_read: 'reading', orthography: 'orthography', context: 'cloze', synonym: 'synonym', usage: 'bank',
  grammar_form: 'cloze', order: 'bank', passage_grammar: 'bank',
};
// 文字語彙/文法のヒートマップ表示用に大問→QFormat(バンク系も近い形式へ寄せる)。
const DAIMON_QFORMAT: Record<Daimon, QFormat> = {
  kanji_read: 'reading', orthography: 'orthography', context: 'cloze', synonym: 'synonym', usage: 'usage',
  grammar_form: 'cloze', order: 'cloze', passage_grammar: 'cloze',
};
export const MOJI_DAIMON: Daimon[] = ['kanji_read', 'orthography', 'context', 'synonym', 'usage'];
export const BUNPOU_DAIMON: Daimon[] = ['grammar_form', 'order', 'passage_grammar'];

// 知識バンクの安定id(状態キー/重複排除用)。id = kb-NNNNNN(data由来・knowledgeBank.jsonに焼き込み済み。Task 1)。
export interface BankUnit { id: string; level: string; daimon: Daimon; stem: string; question: string; choices: string[]; answer: string; ambiguous?: boolean; pointId?: string; }
// 並べ替え(order)のうち一意性監査で「複数正解=曖昧」と判定された問題(ambiguous:true・108問)は出題プールから恒久除外。
// 日本語は副詞・主語の位置が自由で★の答えが一意にならないため。監査=LLM一括(2026-07-10)。id は data由来なので filter後も安定。
export const BANK: BankUnit[] = (KNOWLEDGE_BANK as BankUnit[])
  .filter((b) => !(b.daimon === 'order' && b.ambiguous))
  .filter((b) => b.daimon !== 'passage_grammar'); // 文章の文法は passageGrammar.json(セット形式)へ移行(Task 5)。PassageGrammarScreen+PassageSetPlayerで出題。
const BANK_BY = new Map<string, BankUnit[]>();
for (const b of BANK) { const k = `${b.level}:${b.daimon}`; (BANK_BY.get(k) ?? BANK_BY.set(k, []).get(k)!).push(b); }
const bankOf = (level: string, daimon: Daimon): BankUnit[] => BANK_BY.get(`${level}:${daimon}`) ?? [];
const BANK_INDEX = new Map(BANK.map((b) => [b.id, b] as const));
// 知識バンクid(kb-NNNNNN) → 級。skillWeight等、状態キーだけから難易度を逆引きしたい呼び出し元向け。
const BANK_LEVEL = new Map(BANK.map((b) => [b.id, b.level] as const));
export function bankLevelOf(id: string): string | undefined { return BANK_LEVEL.get(id); }

// 漢字読み/表記の対象語=固定問題集(KANJI_READ_BANK)にエントリがある語。交ぜ書き方式で作成済み。
// ユニットキー <vocabId>#kanji_read / #orthography の集合を単一ソースにする。
const KR_UNIT_SET = new Set(KANJI_READ_BANK.map((e) => `${e.id.slice(3)}#${e.daimon}`));
// 表記(公式形式)=固定問題集(ORTHOGRAPHY_BANK)にエントリがある語。ユニットキー <vocabId>#orthography。
const OG_UNIT_SET = new Set(ORTHOGRAPHY_BANK.map((e) => `${e.id.slice(3)}#orthography`));
// 文脈規定=固定問題集(CONTEXT_BANK)にエントリがある語。id cx:<vid> → ユニット <vid>#context。
const CTX_UNIT_SET = new Set(CONTEXT_BANK.map((e) => `${e.id.slice(3)}#context`));
// 言い換え類義=固定問題集(SYNONYM_BANK)にエントリがある語。id sy:<vid> → ユニット <vid>#synonym。
const SY_UNIT_SET = new Set(SYNONYM_BANK.map((e) => `${e.id.slice(3)}#synonym`));

// 大問に適格な「項目(語彙/文法)」。漢字読み/表記=固定問題集に在る語、文脈=固定問題集に在る語、言い換え=類義あり、文法形式=cloze可文法。
function eligibleItems(level: Level, daimon: Daimon): StudyItem[] {
  if (daimon === 'orthography') return VOCAB.filter((v) => v.level === level && OG_UNIT_SET.has(`${v.id}#orthography`));
  if (daimon === 'kanji_read') return VOCAB.filter((v) => v.level === level && KR_UNIT_SET.has(`${v.id}#kanji_read`));
  if (daimon === 'context') return VOCAB.filter((v) => v.level === level && CTX_UNIT_SET.has(`${v.id}#context`));
  if (daimon === 'synonym') return VOCAB.filter((v) => v.level === level && SY_UNIT_SET.has(`${v.id}#synonym`));
  if (daimon === 'grammar_form') return GRAMMAR.filter((g) => g.level === level && GRAMMAR_CLOZE_OK.has(g.id));
  return [];
}

// 学習/模試の分割: EXAM_EVERY 個に1つ(=末尾側)を模試専用(初見)に確保、残りが学習集合。
const EXAM_EVERY = 7;
function split(all: string[], mode: 'all' | 'learn' | 'exam'): string[] {
  if (mode === 'all') return all;
  return all.filter((_, i) => (i % EXAM_EVERY === EXAM_EVERY - 1) === (mode === 'exam'));
}
/** ある級・大問の学習ユニットid列。item系=`<itemId>#<daimon>`、bank系=bank id。mode=all/learn(学習)/exam(模試専用)。
 *  context/grammar_form は item系＋バンク併用、usage/order は純バンク、passage_grammar はセット(passageGrammar.json)設問id。 */
export function daimonUnitIds(level: Level, daimon: Daimon, mode: 'all' | 'learn' | 'exam' = 'all'): string[] {
  // 文章の文法=BANKから除外済(Task 5)。母数/リング/カバー率は passageGrammar.json の全設問idを分母にする
  // (PassageGrammarScreen+PassageSetPlayerが quizAnswer(q.id,...) を記録=同じ状態キー空間に乗る)。
  if (daimon === 'passage_grammar') return split(passageGrammarSetsFor(level).flatMap((s) => s.questions.map((q) => q.id)), mode);
  const items = eligibleItems(level, daimon).map((it) => `${it.id}#${daimon}`);
  const fmt = DAIMON_FORMAT[daimon];
  const all = fmt === 'bank'
    ? bankOf(level, daimon).map((b) => b.id)
    : daimon === 'grammar_form'
      ? bankOf(level, daimon).map((b) => b.id) // 文法形式も検証済の固定バンクのみ(旧例文clozeは廃止)
      : items; // context/kanji_read/orthography/synonym は固定問題集(item系)のみ
  return split(all, mode);
}

/** 文字語彙/文法セクションの大問。 */
export const SECTION_DAIMONS: Record<'moji_goi' | 'bunpou', Daimon[]> = { moji_goi: MOJI_DAIMON, bunpou: BUNPOU_DAIMON };
/** セクション(文字語彙/文法)の全大問の学習ユニットid(横断)。リング分母/カバー率/評価の母数用。 */
export function sectionUnitIds(level: Level, section: 'moji_goi' | 'bunpou', mode: 'all' | 'learn' | 'exam' = 'all'): string[] {
  return SECTION_DAIMONS[section].flatMap((d) => daimonUnitIds(level, d, mode));
}
/** ある級・セクションで実在する大問(ユニットが1件以上あるもの)。学習タブのサブカード用。 */
export function daimonsWithUnits(level: Level, section: 'moji_goi' | 'bunpou'): { daimon: Daimon; n: number }[] {
  return SECTION_DAIMONS[section].map((d) => ({ daimon: d, n: daimonUnitIds(level, d, 'all').length })).filter((x) => x.n > 0);
}

const ITEM_INDEX = new Map<string, StudyItem>([...VOCAB, ...GRAMMAR].map((it) => [it.id, it] as const));

// 漢字読み/表記の固定問題集(id kr:<vid>/og:<vid> → ユニット <vid>#kanji_read / #orthography)。
const KR_BANK_INDEX = new Map<string, (typeof KANJI_READ_BANK)[number]>(
  KANJI_READ_BANK.filter((e) => e.daimon === 'kanji_read').map((e) => [`${e.id.slice(3)}#kanji_read`, e]),
);
// 表記(大問2・公式形式)の固定問題集(id og:<vid> → ユニット <vid>#orthography)。
const OG_BANK_INDEX = new Map<string, (typeof ORTHOGRAPHY_BANK)[number]>(
  ORTHOGRAPHY_BANK.map((e) => [`${e.id.slice(3)}#orthography`, e]),
);
// 文脈規定の固定問題集(id cx:<vid> → ユニット <vid>#context)。
const CTX_BANK_INDEX = new Map<string, (typeof CONTEXT_BANK)[number]>(
  CONTEXT_BANK.map((e) => [`${e.id.slice(3)}#context`, e]),
);
// 言い換え類義の固定問題集(id sy:<vid> → ユニット <vid>#synonym)。
const SY_BANK_INDEX = new Map<string, (typeof SYNONYM_BANK)[number]>(
  SYNONYM_BANK.map((e) => [`${e.id.slice(3)}#synonym`, e]),
);
// JFT会話と表現(id=jx-… をユニットidにそのまま使う)。JFTの学習/模試で場面→適切な表現を出題。
const EXPR_INDEX = new Map<string, (typeof JFT_EXPRESSION)[number]>(JFT_EXPRESSION.map((e) => [e.id, e]));
/** JFT会話と表現の全ユニットid(A1+A2)。 */
export const expressionUnitIds = (): string[] => JFT_EXPRESSION.map((e) => e.id);
// 文＋下線スパンを ExampleHint(下線セグメント列)へ。
function underlineSegments(sentence: string, span: string): { text: string; hit: boolean }[] {
  const i = span ? sentence.indexOf(span) : -1;
  if (i < 0) return [{ text: sentence, hit: false }];
  const segs = [] as { text: string; hit: boolean }[];
  if (i > 0) segs.push({ text: sentence.slice(0, i), hit: false });
  segs.push({ text: span, hit: true });
  if (i + span.length < sentence.length) segs.push({ text: sentence.slice(i + span.length), hit: false });
  return segs;
}

/** 学習ユニットid → 4択問題(出題形式は大問で固定)。Question.itemId はユニットid(=状態キー)にする。 */
export function questionForUnit(unit: string, rng: Rng = Math.random): Question | null {
  const bank = BANK_INDEX.get(unit);
  if (bank) {
    const { choices, answerIndex } = shuffleChoices([bank.answer, ...bank.choices.filter((x) => x !== bank.answer)].slice(0, 4), 0, rng);
    return { itemId: unit, prompt: bank.stem, question: bank.question, format: DAIMON_QFORMAT[bank.daimon], choices, answerIndex, saveRef: saveRefForBank(bank) };
  }
  // 表記=固定問題集(公式形式・文中の対象語をかなで下線→正しい漢字/カタカナを4択)。prompt空・exampleに下線付き文。
  const og = OG_BANK_INDEX.get(unit);
  if (og) {
    const { choices, answerIndex } = shuffleChoices([og.answer, ...og.choices.filter((x) => x !== og.answer)].slice(0, 4), 0, rng);
    return { itemId: unit, prompt: '', example: underlineSegments(og.sentence, og.underline), furi: SENTENCE_FURI[og.id], furiTarget: og.underline, question: '下線の言葉を漢字・カタカナで書くと？', format: 'orthography', choices, answerIndex, explain: og.explain, explainNe: og.explainNe, saveRef: saveRefForVocabUnit(unit) };
  }
  // 漢字読み=固定問題集(公式形式・文中の漢字を下線→読み方を4択)。prompt空・exampleに下線付き文。
  const kr = KR_BANK_INDEX.get(unit);
  if (kr) {
    const { choices, answerIndex } = shuffleChoices([kr.answer, ...kr.choices.filter((x) => x !== kr.answer)].slice(0, 4), 0, rng);
    return { itemId: unit, prompt: '', example: underlineSegments(kr.sentence, kr.underline), furi: SENTENCE_FURI[kr.id], furiTarget: kr.underline, noTargetRuby: true, question: '下線の言葉の読み方は？', format: 'reading', choices, answerIndex, saveRef: saveRefForVocabUnit(unit) };
  }
  // 文脈規定=固定問題集(全内容語のオリジナル文＋非競合誤答)。
  const cx = CTX_BANK_INDEX.get(unit);
  if (cx) {
    const { choices, answerIndex } = shuffleChoices([cx.answer, ...cx.choices.filter((x) => x !== cx.answer)].slice(0, 4), 0, rng);
    return { itemId: unit, prompt: cx.prompt, furi: SENTENCE_FURI[cx.id], question: cx.question, format: 'cloze', choices, answerIndex, explain: cx.explain, explainNe: cx.explainNe, saveRef: saveRefForVocabUnit(unit) };
  }
  // 言い換え類義=固定問題集(文＋下線部→意味が近い語)。prompt空・exampleに下線付き文。
  const sy = SY_BANK_INDEX.get(unit);
  if (sy) {
    const { choices, answerIndex } = shuffleChoices([sy.answer, ...sy.choices.filter((x) => x !== sy.answer)].slice(0, 4), 0, rng);
    return { itemId: unit, prompt: '', example: underlineSegments(sy.sentence, sy.underline), furi: SENTENCE_FURI[sy.id], furiTarget: sy.underline, question: '下線の言葉と意味がいちばん近いのは？', format: 'synonym', choices, answerIndex, explain: sy.reason, explainNe: sy.reasonNe, saveRef: saveRefForVocabUnit(unit) };
  }
  // JFT会話と表現=場面(situation)に適切な表現を4択で。
  const ex = EXPR_INDEX.get(unit);
  if (ex) {
    const { choices, answerIndex } = shuffleChoices([ex.answer, ...ex.choices.filter((x) => x !== ex.answer)].slice(0, 4), 0, rng);
    return { itemId: unit, prompt: ex.situation, question: '', format: 'usage', choices, answerIndex, explain: ex.explain };
  }
  const hash = unit.lastIndexOf('#');
  if (hash < 0) return null;
  const itemId = unit.slice(0, hash); const daimon = unit.slice(hash + 1) as Daimon;
  const item = ITEM_INDEX.get(itemId);
  if (!item) return null;
  const pool = (item.type === 'grammar' ? GRAMMAR : VOCAB) as StudyItem[];
  const q = makeQuestion(item, pool, rng, [DAIMON_FORMAT[daimon] as QFormat]);
  return { ...q, itemId: unit }; // 状態キーを項目#大問に
}

export const isBankUnit = (unit: string): boolean => BANK_INDEX.has(unit);

/** 学習カード表示用データ。大問の4択に入る前に「まず覚える」ための1枚分。 */
export interface LearnCard { title: string; sub?: string; body?: string; note?: string; hit?: string; }
/** ふりがな付き文(漢字（かな）)の中で、素の対象語(target)を見つけて【】で囲う(下線用)。targetの各文字は直後に(かな)を伴い得る。 */
function markFuri(furi: string, target: string): string {
  if (!target || !furi) return furi;
  const esc = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pat = [...target].map((ch) => `${esc(ch)}(?:[（(][^）)]*[）)])?`).join('');
  try { return furi.replace(new RegExp(pat), (m) => `【${m}】`); } catch { return furi; }
}
/** 学習ユニットid → 学習カード。項目系=語/文法の情報、バンク系=正解＋文脈＋解説。 */
export function learnCardFor(unit: string): LearnCard | null {
  const bank = BANK_INDEX.get(unit);
  if (bank) {
    // 用法=対象語＋正しい使い方の文。文法(⑥⑦⑧)=正解＋空所を埋めた例文のみ(解説は学習カードでは出さない)。
    // ⑤用法はLEARN_FURI(kuroshiro＋校正)でふりがなを付ける。ルビ描画は上位のLearnTextがレベル適応で行う。
    // ⑤用法: 例文(answer)の中の対象語(stem)を下線＋ルビで示す。hitで対象語を明示し、
    // RubyTextのhighlightHits(活用語尾も追従)で下線するので、活用した動詞でも正しく引ける。
    if (bank.daimon === 'usage') {
      const title = LEARN_FURI[bank.stem] ?? bank.stem;
      const plain = title.replace(/[（(][ぁ-ゖァ-ヶー]+[）)]/g, '');
      const sent = LEARN_FURI[bank.answer] ?? bank.answer;
      return { title, body: sent, hit: plain };
    }
    // ⑦文の組み立て・⑧文章の文法は「解いて学ぶ」技能問題(語順の組み立て/文脈の流れ)。
    // 学習カードで完成文や正解を先に見せるとテストの意味が無くなるため、学習カードは出さない。
    if (bank.daimon === 'order' || bank.daimon === 'passage_grammar') return null;
    const filled = bank.stem.includes('〔　〕') ? bank.stem.replace('〔　〕', `【${bank.answer}】`) : bank.stem;
    return { title: bank.answer, body: filled };
  }
  const hash = unit.lastIndexOf('#');
  if (hash < 0) return null;
  const itemId = unit.slice(0, hash);
  const daimon = unit.slice(hash + 1) as Daimon;
  const item = ITEM_INDEX.get(itemId);
  if (!item) return null;
  if (item.type === 'vocab') {
    const ex = VOCAB_EXAMPLE[item.id];
    // ①〜④の例文はSENTENCE_FURI(ふりがな付き)を使い、対象語(下線)をmarkFuriで【】囲い。ルビ描画はLearnTextがレベル適応で行う。
    if (daimon === 'synonym') {
      const sy = SY_BANK_INDEX.get(unit);
      const note = sy ? markFuri(SENTENCE_FURI[sy.id] ?? sy.sentence, sy.underline) : ex?.ja;
      return { title: item.word, sub: item.reading, body: `≒ ${sy?.answer ?? ''}`, note };
    }
    if (daimon === 'context') {
      const cx = CTX_BANK_INDEX.get(unit);
      const base = cx ? (SENTENCE_FURI[cx.id]?.includes('〔　〕') ? SENTENCE_FURI[cx.id] : cx.prompt) : '';
      const filled = cx ? base.replace('〔　〕', `【${cx.answer}】`) : ex?.ja;
      return { title: item.word, sub: item.reading, body: item.meaning, note: filled };
    }
    // ①漢字読み・②表記: クイズと同じ固定問題集の例文を使い、対象語(下線)を【】で囲って下線＋ルビ表示する。
    if (daimon === 'kanji_read') {
      const kr = KR_BANK_INDEX.get(unit);
      return { title: item.word, sub: item.reading, body: item.meaning, note: kr ? markFuri(SENTENCE_FURI[kr.id] ?? kr.sentence, kr.underline) : ex?.ja };
    }
    if (daimon === 'orthography') {
      const og = OG_BANK_INDEX.get(unit);
      return { title: item.word, sub: item.reading, body: item.meaning, note: og ? markFuri(SENTENCE_FURI[og.id] ?? og.sentence, og.underline) : ex?.ja };
    }
    return { title: item.word, sub: item.reading, body: item.meaning, note: ex?.ja };
  }
  if (item.type === 'grammar') return { title: item.point, sub: item.romaji, body: item.meaning, note: item.exampleJa };
  return null;
}
