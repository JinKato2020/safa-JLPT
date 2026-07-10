// 予測正答率→大問→公式得点区分→モンテカルロ合格率。設計書 §6。
import { Level, LEVEL_SPECS, scoringSectionForDaimon } from './facets';
import { mulberry32 } from './rng';

export const GUESS_FLOOR = 0.25;
export const MC_DRAWS = 2000;

export function itemP(m: number, floor: number = GUESS_FLOOR): number {
  return floor + (1 - floor) * m;
}

export interface DaimonExpectation { daimon: string; n: number; mu: number }

// n回のベルヌーイ(mu)の和 = その大問の正答数。
function drawCorrect(rng: () => number, n: number, mu: number): number {
  let c = 0;
  for (let i = 0; i < n; i++) if (rng() < mu) c += 1;
  return c;
}

// 全区分が基準点以上 かつ 総合が合格ライン以上 になる割合(=合格率)。
export function passProbability(level: Level, daimons: DaimonExpectation[], draws: number = MC_DRAWS, seed: number = 1): number {
  const spec = LEVEL_SPECS[level];
  const rng = mulberry32(seed);
  let passes = 0;

  for (let d = 0; d < draws; d++) {
    // 区分ごとに (正答数, 出題数) を集計
    const acc = new Map<string, { correct: number; n: number }>();
    for (const dm of daimons) {
      const key = scoringSectionForDaimon(level, dm.daimon);
      const c = drawCorrect(rng, dm.n, dm.mu);
      const a = acc.get(key) ?? { correct: 0, n: 0 };
      a.correct += c; a.n += dm.n; acc.set(key, a);
    }
    // 区分点(0..max)へ換算し、基準点ゲート＋総合を判定
    let total = 0; let allGates = true;
    for (const sec of spec.sections) {
      const a = acc.get(sec.key);
      const frac = a && a.n > 0 ? a.correct / a.n : 0;
      const score = frac * sec.max;
      if (score < sec.minPoint) allGates = false;
      total += score;
    }
    if (allGates && total >= spec.passTotal) passes += 1;
  }
  return passes / draws;
}
