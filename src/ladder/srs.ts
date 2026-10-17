// SM-2系スケジュール＋忘却順の出題選択。設計書 §4。
import { FacetState, clamp, DAY, updateMastery, RECEIVED_INTERVAL_DAYS } from './mastery';

export type Grade = 'again' | 'good' | 'easy';

function schedule(s: FacetState, correct: boolean, now: number): Pick<FacetState, 'reps' | 'intervalDays' | 'ease' | 'dueAt'> {
  let { reps, intervalDays, ease } = s;
  if (!correct) {
    reps = 0; intervalDays = 0; ease = clamp(ease - 0.2, 1.3, 2.8);
    return { reps, intervalDays, ease, dueAt: now + 600_000 }; // 10分後=すぐ復習
  }
  if (reps === 0) intervalDays = 1;
  else if (reps === 1) intervalDays = 6;
  else intervalDays = Math.round(intervalDays * ease);
  reps += 1;
  return { reps, intervalDays, ease, dueAt: now + intervalDays * DAY };
}

// 習得度更新とスケジュール更新を一体で行う(状態は不変で新オブジェクトを返す)。
export function recordResult(s: FacetState, correct: boolean, weight: number, now: number): FacetState {
  const updated = updateMastery(s, correct ? 1 : 0, weight, now);
  return { ...updated, ...schedule(s, correct, now) };
}

export function isReceived(s: FacetState): boolean {
  return s.intervalDays >= RECEIVED_INTERVAL_DAYS;
}

// due超過が大きいほど優先。同点は弱い(m小)を優先。limit件返す。
export function selectByForgetting<T extends { state: FacetState }>(items: T[], now: number, limit: number): T[] {
  return [...items]
    .sort((a, b) => (a.state.dueAt - b.state.dueAt) || (a.state.m - b.state.m))
    .slice(0, limit);
}
