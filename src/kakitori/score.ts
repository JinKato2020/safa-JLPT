// 書き取りの採点(純関数)。絶対位置ではなく「形の一致」で採点する:
// 描いた点列と手本を、それぞれ重心中心・RMSスケールで正規化(=平行移動と拡大縮小に不変)
// してから近さを測る。タッチペンで書いた字が、位置や大きさが違っても形が合えば高得点になる。
export type Pt = [number, number];

const TOL = 0.3; // 正規化(単位分散)空間での近傍しきい
const SPILL = 2 * TOL; // これを超えたら「はみ出し」

const d2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
function nearest2(p: Pt, pts: Pt[]): number {
  let m = Infinity;
  for (const q of pts) {
    const d = d2(p, q);
    if (d < m) m = d;
  }
  return m;
}

// 点列を重心中心・RMSスケール1に正規化(平行移動・拡大縮小に不変)。点が一点集中なら null。
function normalize(pts: Pt[]): Pt[] | null {
  const n = pts.length;
  if (n === 0) return null;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts) { cx += x; cy += y; }
  cx /= n; cy /= n;
  let s = 0;
  for (const [x, y] of pts) { s += (x - cx) ** 2 + (y - cy) ** 2; }
  s = Math.sqrt(s / n);
  if (s < 1e-6) return null;
  return pts.map(([x, y]) => [(x - cx) / s, (y - cy) / s] as Pt);
}

// 0..100の整数。100=形がほぼ一致, 0=無関係/空。位置・大きさには不変。
export function scoreDrawing(user: Pt[], model: Pt[][]): number {
  const um = normalize(user);
  const mm = normalize(model.flat());
  if (!um || !mm) return 0;
  const tol2 = TOL * TOL;
  const spill2 = SPILL * SPILL;
  let accSum = 0;
  let spill = 0;
  for (const p of um) {
    const dd = nearest2(p, mm);
    accSum += Math.max(0, 1 - Math.sqrt(dd) / TOL);
    if (dd > spill2) spill += 1;
  }
  const accuracy = accSum / um.length;
  const spillRatio = spill / um.length;
  let covered = 0;
  for (const q of mm) if (nearest2(q, um) <= tol2) covered += 1;
  const coverage = covered / mm.length;
  const raw = 0.5 * accuracy + 0.5 * coverage - 0.3 * spillRatio;
  return Math.round(100 * Math.min(1, Math.max(0, raw)));
}

export const PASS_SCORE = 70;

// タッチペン式の手書き認識: 描いた形を全テンプレと照合し、似ている順に返す。
// 位置・大きさに不変(scoreDrawingが正規化するため)。top1が対象字なら「その字に見える」。
export function recognize(
  user: Pt[],
  templates: { char: string; strokes: number[][][] }[],
): { char: string; score: number }[] {
  return templates
    .map((tp) => ({ char: tp.char, score: scoreDrawing(user, tp.strokes as Pt[][]) }))
    .sort((a, b) => b.score - a.score);
}

// 認識の最低ライン(これ未満なら、たとえ最も近くても「その字」とは認めない)。
export const RECOGNIZE_FLOOR = 45;
