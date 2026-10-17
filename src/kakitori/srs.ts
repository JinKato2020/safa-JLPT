// 書き取りSRS(間隔反復・純関数)。本体学習エンジンとは別スライス。
import { addDays } from '../store/state';

export interface KakitoriEntry {
  step: number; stars: number; best: number;
  due?: string; interval?: number; reps?: number;
}

const INTERVALS = [1, 3, 7, 16, 35]; // 日

/** 前回間隔とミス数から次回間隔(日)を返す。3ミス以上は最短に戻す。 */
export function nextInterval(prevInterval: number | undefined, mistakes: number): number {
  if (mistakes >= 3) return INTERVALS[0];
  const idx = prevInterval ? INTERVALS.indexOf(prevInterval) : -1;
  const next = Math.min(idx + 1, INTERVALS.length - 1);
  return INTERVALS[Math.max(0, next)];
}

/** マスター/復習合格時に次回期日をスケジュール。 */
export function scheduleKakitori(prev: KakitoriEntry, args: { mistakes: number; today: string }): KakitoriEntry {
  const interval = nextInterval(prev.interval, args.mistakes);
  return { ...prev, interval, due: addDays(args.today, interval), reps: (prev.reps ?? 0) + 1 };
}

/** 期日(due)が today 以前の字の配列。 */
export function kakitoriDueToday(kakitori: Record<string, KakitoriEntry> | undefined, today: string): string[] {
  if (!kakitori) return [];
  return Object.entries(kakitori).filter(([, e]) => e.due != null && e.due <= today).map(([c]) => c);
}
