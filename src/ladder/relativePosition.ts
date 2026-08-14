// 相対的な位置(=公式受験者の中で上位何%相当か)。予想得点を公式の平均点/SD・得点分布と比べて算出。
//  ・セクション別 = 公式のセクション平均点/SD に対する正規近似(上位% = 100×P(X>得点))。
//  ・総合 = 公式の得点分布表(得点→上位%)を線形補間。分布そのものを使うのでより正確。
//  ・★は上位%から5段階(上位ほど星が多い)。値はすべて「予想得点=アプリ推定」に基づく“相当”値。
import {
  OFFICIAL_SECTION_STATS, OFFICIAL_TOP_PERCENT, OFFICIAL_TOTAL_STAT,
  type OfficialLevel, type OfficialSecKey,
} from '../data/officialStats';

export function isOfficialLevel(level: string): level is OfficialLevel {
  return level === 'N1' || level === 'N2' || level === 'N3' || level === 'N4' || level === 'N5';
}

// 標準正規分布の累積 Φ(z)。erf の Abramowitz & Stegun 7.1.26 近似(誤差<1.5e-7)。
function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  let p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  p = 1 - p;
  return z >= 0 ? p : 1 - p;
}

/** 得点(score)が平均mean・標準偏差sdの正規分布で「上位何%」か(=その得点より上の割合%)。0.1〜99.9でクランプ。 */
export function topPercentNormal(score: number, mean: number, sd: number): number {
  if (!(sd > 0)) return 50;
  const top = 100 * (1 - phi((score - mean) / sd));
  return Math.min(99.9, Math.max(0.1, top));
}

/** 総合得点 → 上位%。公式の得点分布表(昇順)を線形補間。表の範囲外はクランプ。 */
export function totalTopPercent(level: OfficialLevel, score: number): number {
  const tbl = OFFICIAL_TOP_PERCENT[level];
  if (!tbl || tbl.length === 0) return 50;
  if (score <= tbl[0].score) return tbl[0].top;
  const last = tbl[tbl.length - 1];
  if (score >= last.score) return last.top;
  for (let i = 1; i < tbl.length; i++) {
    if (score <= tbl[i].score) {
      const a = tbl[i - 1], b = tbl[i];
      const r = (score - a.score) / (b.score - a.score);
      return a.top + r * (b.top - a.top);
    }
  }
  return last.top;
}

/** 上位% → ★(1〜5)。上位12%→5, 24%→4, 43%→3 …の目安。 */
export function starsFromTop(top: number): number {
  if (top <= 15) return 5;
  if (top <= 30) return 4;
  if (top <= 50) return 3;
  if (top <= 70) return 2;
  return 1;
}

export interface SectionPosition { key: OfficialSecKey; score: number; max: number; top: number; stars: number }
export interface RelativePosition { sections: SectionPosition[]; total: { score: number; max: number; top: number; stars: number } | null }

type EstSection = { key: string; score: number; max: number; minPoint?: number };

/** 予想得点(セクション配列＋総合)から相対位置を算出。公式統計を持たないレベル/区分は除外。 */
export function relativePositionFor(level: string, sections: EstSection[], totalScore: number): RelativePosition | null {
  if (!isOfficialLevel(level)) return null;
  const stat = OFFICIAL_SECTION_STATS[level];
  const secs: SectionPosition[] = [];
  for (const s of sections) {
    const st = stat[s.key as OfficialSecKey];
    if (!st) continue;
    const top = topPercentNormal(s.score, st.mean, st.sd);
    secs.push({ key: s.key as OfficialSecKey, score: s.score, max: s.max, top, stars: starsFromTop(top) });
  }
  const hasTable = (OFFICIAL_TOP_PERCENT[level]?.length ?? 0) > 0;
  const totalMax = 180;
  const total = hasTable
    ? { score: totalScore, max: totalMax, top: totalTopPercent(level, totalScore), stars: starsFromTop(totalTopPercent(level, totalScore)) }
    : null;
  return { sections: secs, total };
}
