// 毎日の「今日の出迎え」を1日1回に絞る。減衰レイヤーの daily_greet 接点に委譲(lastGreetDay を吸収・§6)。
import { type AppState } from '../store/state';
import { intensityFor, recordDecay, type Intensity } from '../story/decay';

const GREET = 'daily_greet';

/** 今日まだ出迎えていなければ true(daily_greet が none 以外)。 */
export function shouldGreetToday(state: AppState, now: number): boolean {
  return intensityFor(state.storyDecay, GREET, { now }) !== 'none';
}

/** 今日の出迎えの強さ(full/short/none)。none は UI では出さない(先に shouldGreetToday で弾く)。 */
export function greetVariant(state: AppState, now: number, reduceMotion = false): Intensity {
  return intensityFor(state.storyDecay, GREET, { now, reduceMotion });
}

/** 出迎え済み(または見送り)を記録した新しい状態を返す(純粋・入力は不変)。 */
export function markGreetedToday(state: AppState, now: number, skipped = false): AppState {
  return { ...state, storyDecay: recordDecay(state.storyDecay, GREET, now, { skipped }) };
}
