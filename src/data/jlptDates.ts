// JLPTの試験日ヘルパ。年2回(7月・12月の第1日曜)。オンボと設定で共有。
export function firstSundayOf(year: number, month: number): string {
  for (let d = 1; d <= 7; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0) {
      return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** 今日より後のJLPT(7月・12月の第1日曜)を最大2つ。 */
export function upcomingExams(today: string): string[] {
  const y = Number(today.slice(0, 4));
  return [firstSundayOf(y, 7), firstSundayOf(y, 12), firstSundayOf(y + 1, 7), firstSundayOf(y + 1, 12)]
    .filter((d) => d > today)
    .slice(0, 2);
}
