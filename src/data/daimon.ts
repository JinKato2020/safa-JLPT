// 大問(学習区分)モデル = 本番JLPTの大問で学習/出題/評価を統一する基盤。
//  ・文字語彙/文法は1項目を複数の大問で問う(漢字読み/表記/文脈規定/言い換え/用法・文法形式/組み立て/文章の文法)。
//    → 習得度は「項目#大問」キーで大問ごとに別管理(本番精度・ユーザー指定(A))。
//  ・各大問は出題形式を固定(makeQuestionにallowedで強制 or 知識バンクの4択)。
//  ・読解/聴解は1問=1ユニット(設問id)で既にサブタイプ別＝本モジュールは文字語彙/文法を担当。
import { VOCAB, GRAMMAR, VOCAB_CLOZE_OK, VOCAB_SYN, GRAMMAR_CLOZE_OK, KNOWLEDGE_BANK, type StudyItem } from './index';
import type { Daimon } from './examBlueprint';
import { hasKanji, makeQuestion, shuffleChoices, type Question, type QFormat, type Rng } from '../quiz/quiz';
import type { Level } from '../engine/engine';

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

// 知識バンクに安定idを付与(状態キー/重複排除用)。id = bk:<level>:<daimon>:<index>。
export interface BankUnit { id: string; level: string; daimon: Daimon; stem: string; question: string; choices: string[]; answer: string; explain: string; }
export const BANK: BankUnit[] = (KNOWLEDGE_BANK as Omit<BankUnit, 'id'>[]).map((b, i) => ({ ...b, id: `bk:${b.level}:${b.daimon}:${i}` }));
const BANK_BY = new Map<string, BankUnit[]>();
for (const b of BANK) { const k = `${b.level}:${b.daimon}`; (BANK_BY.get(k) ?? BANK_BY.set(k, []).get(k)!).push(b); }
const bankOf = (level: string, daimon: Daimon): BankUnit[] => BANK_BY.get(`${level}:${daimon}`) ?? [];
const BANK_INDEX = new Map(BANK.map((b) => [b.id, b] as const));

// 大問に適格な「項目(語彙/文法)」。漢字読み/表記=漢字を含む語、文脈=cloze可、言い換え=類義あり、文法形式=cloze可文法。
function eligibleItems(level: Level, daimon: Daimon): StudyItem[] {
  if (daimon === 'kanji_read' || daimon === 'orthography') return VOCAB.filter((v) => v.level === level && hasKanji(v.word));
  if (daimon === 'context') return VOCAB.filter((v) => v.level === level && VOCAB_CLOZE_OK.has(v.id));
  if (daimon === 'synonym') return VOCAB.filter((v) => v.level === level && !!VOCAB_SYN[v.id]);
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
 *  context/grammar_form は item系＋バンク併用、usage/order/passage_grammar は純バンク。 */
export function daimonUnitIds(level: Level, daimon: Daimon, mode: 'all' | 'learn' | 'exam' = 'all'): string[] {
  const items = eligibleItems(level, daimon).map((it) => `${it.id}#${daimon}`);
  const fmt = DAIMON_FORMAT[daimon];
  const all = fmt === 'bank'
    ? bankOf(level, daimon).map((b) => b.id)
    : (daimon === 'context' || daimon === 'grammar_form')
      ? [...items, ...bankOf(level, daimon).map((b) => b.id)]
      : items;
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

/** 学習ユニットid → 4択問題(出題形式は大問で固定)。Question.itemId はユニットid(=状態キー)にする。 */
export function questionForUnit(unit: string, rng: Rng = Math.random): Question | null {
  const bank = BANK_INDEX.get(unit);
  if (bank) {
    const { choices, answerIndex } = shuffleChoices([bank.answer, ...bank.choices.filter((x) => x !== bank.answer)].slice(0, 4), 0, rng);
    return { itemId: unit, prompt: bank.stem, question: bank.question, format: DAIMON_QFORMAT[bank.daimon], choices, answerIndex };
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
