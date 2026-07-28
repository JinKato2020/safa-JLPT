// 毎回起動の「今日の出迎え」を1日1回だけ出すための純関数。UI配線は後続プランで行う。
import { dayStr, type AppState } from '../store/state';

/** 今日まだ出迎えていなければ true（lastGreetDay が今日と違う）。 */
export function shouldGreetToday(state: AppState, now: number): boolean {
  return state.lastGreetDay !== dayStr(now);
}

/** 出迎え済みとして当日を記録した新しい状態を返す（純粋・入力は不変）。 */
export function markGreetedToday(state: AppState, now: number): AppState {
  return { ...state, lastGreetDay: dayStr(now) };
}
