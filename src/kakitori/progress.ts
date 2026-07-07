// KAKITORI_PROGRESS の状態遷移(純関数)。store.tsx から呼ぶ。RN非依存でテスト可能。
import { scheduleKakitori, type KakitoriEntry } from './srs';
import { dayStr } from '../store/state';

export function applyKakitoriProgress(
  prev: KakitoriEntry | undefined,
  a: { step: number; score: number; skipped?: boolean; now?: number },
): KakitoriEntry {
  const base: KakitoriEntry = prev ?? { step: 0, stars: 0, best: 0 };
  const passed = !a.skipped;
  const stars = passed ? Math.max(base.stars, a.step) : base.stars;
  let next: KakitoriEntry = {
    ...base,
    step: Math.max(base.step, a.step),
    stars,
    best: Math.max(base.best, a.score),
  };
  if (passed && a.step >= 3) {
    const today = dayStr(a.now ?? Date.now());
    const mistakes = Math.max(0, Math.round((100 - a.score) / 8));
    next = scheduleKakitori(next, { mistakes, today });
  }
  return next;
}
