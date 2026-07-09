// フル模試の月1ロック判定(純関数)。旧TestScreenのthisMonth/lastFull/nextAvailロジックを移植。
// history各要素は { day: 'YYYY-MM-DD'; full: boolean } を含む(state.mockHistory)。
export interface MockHistoryEntry { day: string; full: boolean; pct?: number }

function ym(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 同一暦月にフル模試を受けていれば locked。next = 翌月1日。 */
export function fullMockLocked(
  history: MockHistoryEntry[],
  now: number,
): { locked: boolean; next: { y: number; m: number; d: number } } {
  const thisMonth = ym(now);
  const lastFull = [...history].reverse().find((m) => m.full);
  const locked = !!lastFull && lastFull.day.slice(0, 7) === thisMonth;
  const [y, m] = thisMonth.split('-').map(Number);
  const next = { y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1, d: 1 };
  return { locked, next };
}
