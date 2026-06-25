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
