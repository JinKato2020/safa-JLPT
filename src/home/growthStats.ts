// 成長カード用のデータ整形(純関数・テスト可能)。既存 growthCurve(日ごとの累積「覚えた語」)を使う。
import type { AppState } from '../store/state';
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
