// 合格リングの幾何(HTML統合案と同一座標系: 中心200,200・0°は上・時計回り)。
export const C = 200;
export const R_OUT = 172, R_MID = 128, R_IN = 90;
export const SEG = 72, GAP = 9; // 外リング5科目=各72°・間隔9°

export function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

// SVGパス文字列(Skiaの MakeFromSVGString に渡す)。start→end を時計回りに描く弧。
export function arcPath(r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = (((a1 - a0) % 360) + 360) % 360 > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
