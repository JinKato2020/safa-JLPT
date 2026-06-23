// 例文中の対象(語彙語/漢字/文法点)を下線ハイライト用セグメントに分割する共通ロジック。
// 全画面(辞書/クイズ/模試/学習セッション/Flashcard)で統一使用。
// 対応: ふりがな「基（ふり）」保持 ・ 変化系(活用語尾の連続かな) ・ A〜B型(離れた複数部分) ・ 1文字対象。
export interface Segment { text: string; hit: boolean; }

export function highlightSegments(exampleJa: string, point: string): Segment[] {
  const units: { base: string; disp: string }[] = [];
  const re = /(.)（[^）]*）|([\s\S])/gu; // 「基（ふり）」1組 または 1文字
  let m: RegExpExecArray | null;
  while ((m = re.exec(exampleJa))) units.push({ base: m[1] ?? m[2] ?? '', disp: m[0] });
  const bases = units.map((u) => u.base).join('');
  const flags = new Array<boolean>(units.length).fill(false);
  const KANA = /[぀-ゟ]/;
  // 文法点/語を 〜/～ で分割(A〜B型対応)。各部分を順に探す。
  const parts = point
    .replace(/（[^）]*）/g, '')
    .split(/[〜～]/)
    .map((p) => p.replace(/\s/g, '').trim())
    .filter(Boolean);
  let from = 0;
  for (const part of parts) {
    let at = -1;
    let len = 0;
    // 活用差に強い最長前方一致。1文字対象(区/公 等)も拾えるよう下限は min(2, 長さ)。
    for (let L = part.length; L >= Math.min(2, part.length); L--) {
      const i = bases.indexOf(part.slice(0, L), from);
      if (i >= 0) { at = i; len = L; break; }
    }
    if (at < 0) continue;
    let end = at + len;
    if (len < part.length) while (end < units.length && KANA.test(units[end].base)) end++; // 変化系も下線
    for (let j = at; j < end; j++) flags[j] = true;
    from = end;
  }
  const segs: Segment[] = [];
  for (let i = 0; i < units.length; i++) {
    const last = segs[segs.length - 1];
    if (last && last.hit === flags[i]) last.text += units[i].disp;
    else segs.push({ text: units[i].disp, hit: flags[i] });
  }
  return segs;
}

/** ヒットが1つでもあるか(無ければ下線表示しない判断に使う)。 */
export function hasHit(segs: Segment[]): boolean { return segs.some((s) => s.hit); }
