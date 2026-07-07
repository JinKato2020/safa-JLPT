// 書き取りの採点(純関数)。「画ごと・書き順どおり」に形を照合する:
//  ・全体(全点)を重心中心・RMSスケールで正規化 → 位置と大小には不変(タッチペン式)。
//  ・ユーザーの第i画 ↔ 手本の第i画 を対応させて類似度を測る(書き順どおりに描く前提)。
//  ・画数が違えば強く減点(余分/不足の画は0点扱い)。→ 大(3画)を木(4画)と誤判定しない。
export type Pt = [number, number];

const d2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
function nearest2(p: Pt, pts: Pt[]): number {
  let m = Infinity;
  for (const q of pts) {
    const d = d2(p, q);
    if (d < m) m = d;
  }
  return m;
}

// 全画をまとめて重心中心・RMSスケール1に正規化(平行移動・拡大縮小に不変)。空/一点集中なら null。
function normalizeStrokes(strokes: Pt[][]): Pt[][] | null {
  const all: Pt[] = [];
  for (const s of strokes) for (const p of s) all.push(p);
  if (all.length === 0) return null;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of all) { cx += x; cy += y; }
  cx /= all.length; cy /= all.length;
  let v = 0;
  for (const [x, y] of all) { v += (x - cx) ** 2 + (y - cy) ** 2; }
  const s = Math.sqrt(v / all.length);
  if (s < 1e-6) return null;
  return strokes.map((st) => st.map(([x, y]) => [(x - cx) / s, (y - cy) / s] as Pt));
}

const STROKE_TOL = 0.32; // 正規化空間での「同じ画」とみなす近傍しきい
// 1画どうしの対称類似度(0..1)。近さ(accuracy)と被覆(coverage)の平均。
function strokeSim(a: Pt[], b: Pt[]): number {
  if (!a.length || !b.length) return 0;
  const tol2 = STROKE_TOL * STROKE_TOL;
  let acc = 0;
  for (const p of a) acc += Math.max(0, 1 - Math.sqrt(nearest2(p, b)) / STROKE_TOL);
  let cov = 0;
  for (const q of b) if (nearest2(q, a) <= tol2) cov += 1;
  return 0.5 * (acc / a.length) + 0.5 * (cov / b.length);
}

// 手の傾きを許容するための候補回転(±24°程度)。90°回転(三→川もどき)は許さないよう範囲を限定。
const ROT_ANGLES = [-24, -16, -8, 0, 8, 16, 24].map((d) => (d * Math.PI) / 180);
function rotateStrokes(strokes: Pt[][], a: number): Pt[][] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return strokes.map((st) => st.map(([x, y]) => [x * c - y * s, x * s + y * c] as Pt));
}
// 画ごと(書き順どおり)の一致度0..1。画数違いは分母max()で強く減点。
function matchScore(u: Pt[][], t: Pt[][]): number {
  const n = Math.min(u.length, t.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += strokeSim(u[i], t[i]);
  return sum / Math.max(u.length, t.length);
}

// 0..100。100=画ごと・書き順どおりに形が一致。位置/大小/手の傾き(±24°)に不変、画数違いは強く減点。
export function scoreStrokes(userStrokes: Pt[][], templateStrokes: Pt[][]): number {
  const u0 = normalizeStrokes(userStrokes.filter((s) => s.length > 0));
  const t = normalizeStrokes(templateStrokes);
  if (!u0 || !t) return 0;
  // ユーザーの字を少しずつ回し、一番合う角度で採点(=手の傾きに寛容)。
  let best = 0;
  for (const a of ROT_ANGLES) {
    const sc = matchScore(a === 0 ? u0 : rotateStrokes(u0, a), t);
    if (sc > best) best = sc;
  }
  return Math.round(100 * best);
}

export const PASS_SCORE = 70;
export const RECOGNIZE_FLOOR = 45;

// タッチペン式の手書き認識: 描いた形(画ごと)を全テンプレと照合し、似ている順に返す。
export function recognize(
  userStrokes: Pt[][],
  templates: { char: string; strokes: number[][][] }[],
): { char: string; score: number }[] {
  return templates
    .map((tp) => ({ char: tp.char, score: scoreStrokes(userStrokes, tp.strokes as Pt[][]) }))
    .sort((a, b) => b.score - a.score);
}
