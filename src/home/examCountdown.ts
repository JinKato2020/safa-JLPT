// 試験までの残り日数(AIコーチの合格見込みカード・桜の応援・アカウントの試験情報で共用)。
//  ・試験日＝設定の試験日(未来のみ)。未設定/過去なら次回JLPT(7月・12月の第1日曜)を「目安」として使う。
//  ・JFT-Basic目標で試験日が未設定なら null(通年CBTで決まった試験日が無い＝出さない)。
import type { AppState } from '../store/state';
import { dayStr, daysBetween } from '../store/state';

// 7月・12月の「第1日曜」= JLPT実施日(ProfileScreenと同じ算出)。
export function firstSundayOf(year: number, month: number): string {
  for (let d = 1; d <= 7; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0) {
      return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
// 今日より後で最も近いJLPT実施日。設定の試験日が無い/過去の時のフォールバック。
export function nextJlpt(today: string): string {
  const y = Number(today.slice(0, 4));
  return (
    [firstSundayOf(y, 7), firstSundayOf(y, 12), firstSundayOf(y + 1, 7), firstSundayOf(y + 1, 12)].find((d) => d > today) ??
    firstSundayOf(y + 1, 7)
  );
}

export interface ExamCountdown {
  date: string;        // YYYY-MM-DD
  days: number;        // 今日からの日数(0=今日が試験日)
  estimated: boolean;  // true=設定が無く次回JLPTを目安にした
  jft: boolean;        // JFT-Basic目標(表示名を「試験」にする)
}

export function examCountdown(state: AppState, now: number): ExamCountdown | null {
  const today = dayStr(now);
  const set = state.settings.examDate;
  const jft = (state.settings.targetExam ?? 'jlpt') === 'jft';
  if (set && set >= today) return { date: set, days: daysBetween(today, set), estimated: false, jft };
  if (jft) return null;
  const d = nextJlpt(today);
  return { date: d, days: daysBetween(today, d), estimated: true, jft };
}
