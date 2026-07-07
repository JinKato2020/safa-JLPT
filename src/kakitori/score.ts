// 書き取りの「手本への近さ」採点(純関数・ピクセル処理なし)。
// user=描いた点列(全画連結可), model=手本の画ごと点列。すべて0..1正規化。
export type Pt = [number, number];

const TOL = 0.08; // 手本近傍とみなす正規化距離
const SPILL = 2 * TOL; // これを超えたら「はみ出し」

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function nearest(p: Pt, pts: Pt[]): number {
  let m = Infinity;
  for (const q of pts) {
    const d = dist(p, q);
    if (d < m) m = d;
  }
  return m;
}

/** 0..100の整数。100=手本にほぼ一致, 0=無関係/空。 */
export function scoreDrawing(user: Pt[], model: Pt[][]): number {
  const modelPts = model.flat();
  if (user.length === 0 || modelPts.length === 0) return 0;
  let accSum = 0;
  let spill = 0;
  for (const p of user) {
    const d = nearest(p, modelPts);
    accSum += Math.max(0, 1 - d / TOL); // 手本上=1, TOL以遠=0
    if (d > SPILL) spill += 1;
  }
  const accuracy = accSum / user.length;
  const spillRatio = spill / user.length;
  let covered = 0;
  for (const q of modelPts) if (nearest(q, user) <= TOL) covered += 1;
  const coverage = covered / modelPts.length;
  const raw = 0.5 * accuracy + 0.5 * coverage - 0.3 * spillRatio;
  return Math.round(100 * Math.min(1, Math.max(0, raw)));
}

export const PASS_SCORE = 70;
