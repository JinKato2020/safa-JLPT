// 試験の出題構成(正本)。頭脳/JLPT_JFT_試験構造.xlsx の「問題数(目安)」を区分合計でデータ化。
//   フル模試=この問題数(本番厳密一致)。ミニ模試=round(÷3)(構成・割合は同一)。
//   ※大問の内訳(漢字読み/表記…)は将来の問題バンク統合で更に厳密化。現状は区分(4カテゴリ)レベルで一致。
export type ExamSec = 'moji_goi' | 'bunpou' | 'dokkai' | 'choukai';
export const EXAM_SECS: ExamSec[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];

// JLPT 本番の区分別 出題数(典型構成)。文字語彙=漢字読み+表記+文脈規定+言い換え類義(+用法)、文法=文法形式+組み立て+文章の文法。
export const JLPT_BLUEPRINT: Record<string, Record<ExamSec, number>> = {
  N5: { moji_goi: 21, bunpou: 17, dokkai: 5, choukai: 24 }, // 計67
  N4: { moji_goi: 35, bunpou: 25, dokkai: 10, choukai: 28 }, // 計98
  N3: { moji_goi: 35, bunpou: 23, dokkai: 16, choukai: 28 }, // 計102
};
// JFT-Basic 4セクション(①文字と語彙②会話と表現③聴解④読解 ≈各12・読解14・計50)。
export const JFT_BLUEPRINT: Record<ExamSec, number> = { moji_goi: 12, bunpou: 12, choukai: 12, dokkai: 14 };

/** 模試の区分別 出題数。full=本番数、!full=round(÷3)(区分が0でなければ最低1で構成維持)。 */
export function blueprintCounts(level: string, full: boolean, jft: boolean): Record<ExamSec, number> {
  const bp = jft ? JFT_BLUEPRINT : (JLPT_BLUEPRINT[level] ?? JLPT_BLUEPRINT.N4);
  const out = {} as Record<ExamSec, number>;
  for (const k of EXAM_SECS) out[k] = full ? bp[k] : (bp[k] > 0 ? Math.max(1, Math.round(bp[k] / 3)) : 0);
  return out;
}

// ── 大問(知識区分)内訳 ──────────────────────────────────────
// 文字語彙=漢字読み/表記/文脈規定/言い換え類義/用法、文法=文法形式の判断/文の組み立て/文章の文法。
export type Daimon = 'kanji_read' | 'orthography' | 'context' | 'synonym' | 'usage' | 'grammar_form' | 'order' | 'passage_grammar';
export const DAIMON_SEC: Record<Daimon, ExamSec> = {
  kanji_read: 'moji_goi', orthography: 'moji_goi', context: 'moji_goi', synonym: 'moji_goi', usage: 'moji_goi',
  grammar_form: 'bunpou', order: 'bunpou', passage_grammar: 'bunpou',
};
// 各大問の出題形式。配列=makeQuestionに渡す許可QFormat / '@bank'=生成バンクから出題。
export const DAIMON_ALLOWED: Record<Daimon, string[] | '@bank'> = {
  kanji_read: ['reading'], orthography: ['orthography'], context: ['cloze'], synonym: ['synonym'], usage: '@bank',
  grammar_form: ['cloze', 'usage'], order: '@bank', passage_grammar: '@bank',
};
export const DAIMON_LABEL: Record<Daimon, string> = {
  kanji_read: 'mock.dai_kanji_read', orthography: 'mock.dai_orthography', context: 'mock.dai_context', synonym: 'mock.dai_synonym',
  usage: 'mock.dai_usage', grammar_form: 'mock.dai_grammar_form', order: 'mock.dai_order', passage_grammar: 'mock.dai_passage_grammar',
};
// 級別 大問別 出題数(本番典型構成)。区分合計は JLPT_BLUEPRINT と一致。
export const DAIMON_BLUEPRINT: Record<string, Partial<Record<Daimon, number>>> = {
  N5: { kanji_read: 7, orthography: 5, context: 6, synonym: 3, grammar_form: 9, order: 4, passage_grammar: 4 },
  N4: { kanji_read: 9, orthography: 6, context: 10, synonym: 5, usage: 5, grammar_form: 15, order: 5, passage_grammar: 5 },
  N3: { kanji_read: 8, orthography: 6, context: 11, synonym: 5, usage: 5, grammar_form: 13, order: 5, passage_grammar: 5 },
};
/** 知識区分の大問別 出題数。full=本番数、!full=round(÷3)。 */
export function daimonCounts(level: string, full: boolean): { daimon: Daimon; count: number }[] {
  const bp = DAIMON_BLUEPRINT[level] ?? DAIMON_BLUEPRINT.N4;
  return (Object.keys(bp) as Daimon[]).map((d) => {
    const c = bp[d] ?? 0;
    return { daimon: d, count: full ? c : Math.max(1, Math.round(c / 3)) };
  });
}
