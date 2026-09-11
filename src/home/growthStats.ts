// 成長カード用のデータ整形(純関数・テスト可能)。既存 growthCurve(日ごとの累積「覚えた語」)を使う。
import type { AppState } from '../store/state';
import { lastNDays } from '../store/state';
import { growthCurve, coverageCurve } from '../store/selectors';

/** 直近n日の累積「覚えた語」配列(バー・スパークライン用)。growthCurveは常にn点返す=空でも0埋め。 */
export function growthBars(state: AppState, today: string, n = 14): number[] {
  return growthCurve(state, today, n).map((p) => p.learned);
}

/** 直近days日での増加分(覚えた語)。負値は0にクランプ。 */
export function weekGain(state: AppState, today: string, days = 7): number {
  const c = growthCurve(state, today, days + 1); // days+1点=今日〜days日前
  if (c.length < 2) return 0;
  return Math.max(0, c[c.length - 1].learned - c[0].learned);
}

/** 直近days日でのカバー率(覚えた数=漢字+語彙+文法)の増加分。負値は0にクランプ。合格率を使わない成長指標。 */
export function coverGain(state: AppState, today: string, days = 7): number {
  const c = coverageCurve(state, today, days + 1);
  if (c.length < 2) return 0;
  const sum = (p: { kanji: number; vocab: number; grammar: number }) => p.kanji + p.vocab + p.grammar;
  return Math.max(0, sum(c[c.length - 1]) - sum(c[0]));
}

/** 直近n日の予想得点(点)推移。predが記録されていない日は直前値をキャリーフォワード(無ければ0)。予想得点は成長表示の正本。 */
export function scoreCurve(state: AppState, today: string, n = 14): number[] {
  const pts = state.growth ?? [];
  let i = 0;
  let cur = 0;
  return lastNDays(today, n).map((day) => {
    while (i < pts.length && pts[i].day <= day) {
      if (typeof pts[i].pred === 'number') cur = pts[i].pred as number;
      i++;
    }
    return cur;
  });
}

/** 直近days日での予想得点の変化(点)。上下どちらもありうる。データ不足時は0。 */
export function scoreGain(state: AppState, today: string, days = 7): number {
  const c = scoreCurve(state, today, days + 1);
  if (c.length < 2) return 0;
  return c[c.length - 1] - c[0];
}

