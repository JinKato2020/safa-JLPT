// 継続トリガーの純関数(副作用なし・テスト対象の中核)。
// 適格学習日=その日に1セット(約60問)以上を完了した日。install〜install+14日の窓内で
// distinct 7日に達したら成立。判定はサーバーでも同一シグネチャで再計算する(クライアント値は信用しない)。
const DAY = 86400000;

/** 適格学習日を distinct 追加(同日は無視)＋ソート維持。 */
export function recordQualifyingDay(days: string[], today: string): string[] {
  if (days.includes(today)) return days;
  return [...days, today].sort();
}

/** install_date ≤ d ≤ install_date+14日 の窓内で、適格学習日 distinct ≥ 7 なら成立。 */
export function isTriggerMet(installDate: number, qualifyingDays: string[], now: number): boolean {
  const start = new Date(installDate).toISOString().slice(0, 10);
  const end = new Date(installDate + 14 * DAY).toISOString().slice(0, 10);
  const inWindow = new Set(qualifyingDays.filter((d) => d >= start && d <= end));
  return inWindow.size >= 7;
}
