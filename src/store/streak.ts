// 継続(streak)ロジック = 純粋関数。掲示板 自分タブ②継続。サーバ不要・日付だけで判定。
import { type Streak, daysBetween } from './state';

/** その日に学習した事実を反映。連続/最長/フリーズ消費を更新。 */
export function applyStudyDay(streak: Streak, today: string): Streak {
  if (streak.lastStudyDay === today) return streak; // 同日2回目はノーカウント

  let current: number;
  let freezes = streak.freezes;

  if (streak.lastStudyDay === null) {
    current = 1;
  } else {
    const gap = daysBetween(streak.lastStudyDay, today);
    if (gap <= 0) return streak;          // 過去日/未来巻き戻し: 安全側でノーオペ
    if (gap === 1) {
      current = streak.current + 1;       // 連日 → +1
    } else {
      const missed = gap - 1;             // 空いた日数
      if (freezes >= missed) {            // フリーズで穴埋め → 連続維持
        freezes -= missed;
        current = streak.current + 1;
      } else {
        current = 1;                      // 途切れ → リセット
      }
    }
  }

  const longest = Math.max(streak.longest, current);
  const history = streak.history.includes(today) ? streak.history : [...streak.history, today];
  return { current, longest, lastStudyDay: today, freezes, history };
}
