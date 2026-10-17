// 目標試験プロファイル: 知識ベースは共通、選んだ試験で 到達度ゲージ/合否判定/区分ラベル を切替。
//   JLPT = レベル選択(N5/N4/N3)・総合＋各区分足切り(19/60)・準備度%ゲージ。
//   JFT-Basic = 単一試験・250点満点/合格200・帯145(A1)/175(A2.1)/200(A2.2)・足切りなし・レベル選択なし。
// 仕様の正＝JLPTアプリ掲示板.md「販売戦略→JLPT JFT-Basic対応(2026-06-25)」。
import type { Category } from './engine';
import type { TargetExam } from '../store/state';

export interface ExamProfile {
  exam: TargetExam;
  hasLevels: boolean;     // JLPT=true / JFT=false(単一試験)
  sectionGates: boolean;  // JLPT=true(各区分足切り) / JFT=false(総合のみ・区分は診断)
  catLabel: Record<Category, string>; // 4区分のi18nラベルキー(②のみ試験で名称差)
  gaugeMax: number;       // ゲージ表示スケール最大: JLPT=100(%) / JFT=250(点)
  bandMarksPct: number[]; // ゲージ上の基準線(overallPct 0-100換算): JFT=[58,70,80]=145/175/200
  jftPassPct: number;     // JFT合格の総合%(=200/250=80)。JLPTは未使用(METAを使用)。
}

const JLPT_CATS: Record<Category, string> = {
  moji_goi: 'home.cat_moji_goi', bunpou: 'home.cat_bunpou', dokkai: 'home.cat_dokkai', choukai: 'home.cat_choukai',
};
// JFTは ①文字と語彙 ②会話と表現 ③聴解 ④読解。①②のラベルのみ差(リング作り直し不要)。
const JFT_CATS: Record<Category, string> = {
  moji_goi: 'exam.jft_cat_moji', bunpou: 'exam.jft_cat_hyougen', dokkai: 'home.cat_dokkai', choukai: 'home.cat_choukai',
};

export const EXAM_PROFILE: Record<TargetExam, ExamProfile> = {
  jlpt: { exam: 'jlpt', hasLevels: true, sectionGates: true, catLabel: JLPT_CATS, gaugeMax: 100, bandMarksPct: [], jftPassPct: 0 },
  jft: { exam: 'jft', hasLevels: false, sectionGates: false, catLabel: JFT_CATS, gaugeMax: 250, bandMarksPct: [58, 70, 80], jftPassPct: 80 },
};

export function examOf(s?: TargetExam): ExamProfile { return EXAM_PROFILE[s ?? 'jlpt']; }

// JFT到達度の帯(A1/A2.1/A2.2/合格)を overallPct(0-100) から判定。
export function jftBand(overallPct: number | null): { key: string; pass: boolean } {
  if (overallPct == null) return { key: 'exam.jft_band_none', pass: false };
  if (overallPct >= 80) return { key: 'exam.jft_band_a22', pass: true };  // 200+ = 合格(A2.2)
  if (overallPct >= 70) return { key: 'exam.jft_band_a21', pass: false }; // 175-199 = A2.1
  if (overallPct >= 58) return { key: 'exam.jft_band_a1', pass: false };  // 145-174 = A1
  return { key: 'exam.jft_band_below', pass: false };                      // <145
}

// overallPct(0-100) → JFT250点尺度の推定総合。
export const jftScore = (overallPct: number | null): number => (overallPct == null ? 0 : Math.round((overallPct / 100) * 250));
