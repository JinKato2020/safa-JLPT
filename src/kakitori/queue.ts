// 書き取りドリルの出題順(SRS優先・純関数)。①due到来→②未着手→③苦手→④習得済。
import type { KakitoriEntry } from './srs';

export function kakitoriDrillQueue(
  kakitori: Record<string, KakitoriEntry> | undefined,
  chars: string[],
  today: string,
): string[] {
  if (!kakitori) return [...chars];
  const rank = (c: string): number => {
    const e = kakitori[c];
    if (e?.due && e.due <= today) return 0;      // ①due到来
    if (!e) return 1;                            // ②未着手
    if ((e.stars ?? 0) < 3) return 2;            // ③苦手
    return 3;                                    // ④習得済
  };
  return chars
    .map((c, i) => ({ c, i, r: rank(c) }))
    .sort((a, b) => {
      if (a.r !== b.r) return a.r - b.r;
      if (a.r === 2) { // 苦手内: stars昇順→best昇順
        const ea = kakitori[a.c]!, eb = kakitori[b.c]!;
        if ((ea.stars ?? 0) !== (eb.stars ?? 0)) return (ea.stars ?? 0) - (eb.stars ?? 0);
        if ((ea.best ?? 0) !== (eb.best ?? 0)) return (ea.best ?? 0) - (eb.best ?? 0);
      }
      return a.i - b.i; // 安定
    })
    .map((x) => x.c);
}
