// 成長カード用のデータ整形(純関数・テスト可能)。既存 growthCurve(日ごとの累積「覚えた語」)を使う。
import type { AppState } from '../store/state';
import { lastNDays } from '../store/state';
import { growthCurve } from '../store/selectors';

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

/** 直近n日の合格率(%)推移。passProbが記録されていない日は直前値をキャリーフォワード(無ければ0)。 */
export function passCurve(state: AppState, today: string, n = 14): number[] {
  const pts = state.growth ?? [];
  let i = 0;
  let cur = 0;
  return lastNDays(today, n).map((day) => {
    while (i < pts.length && pts[i].day <= day) {
      if (typeof pts[i].passProb === 'number') cur = pts[i].passProb as number;
      i++;
    }
    return cur;
  });
}

/** 直近days日での合格率の変化(pt)。上下どちらもありうる。データ不足時は0。 */
export function passGain(state: AppState, today: string, days = 7): number {
  const c = passCurve(state, today, days + 1);
  if (c.length < 2) return 0;
  return c[c.length - 1] - c[0];
}
