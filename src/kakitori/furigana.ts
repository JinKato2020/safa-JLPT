// 例語をRubyText解釈可能な「漢字群（読み）」形に変換する純関数。
// 漢字連続/かな連続に分割し、各漢字群にその読みを付ける(中間送り仮名も対応)。
// 例: 食べ物/たべもの → 食（た）べ物（もの） ・ 女の子/おんなのこ → 女（おんな）の子（こ） ・ 上手/じょうず → 上手（じょうず）
const isKanji = (ch: string): boolean => /[一-龿々〆]/.test(ch);

export function rubyForWord(word: string, reading: string): string {
  if (!word || !reading || word === reading) return word;
  // 漢字連続 / 非漢字(かな)連続のトークンに分割
  const runs: { kanji: boolean; text: string }[] = [];
  for (const ch of word) {
    const k = isKanji(ch);
    const last = runs[runs.length - 1];
    if (last && last.kanji === k) last.text += ch;
    else runs.push({ kanji: k, text: ch });
  }
  let ri = 0;
  let out = '';
  for (let idx = 0; idx < runs.length; idx++) {
    const run = runs[idx];
    if (!run.kanji) {
      out += run.text;
      if (reading.startsWith(run.text, ri)) ri += run.text.length; // 読み側の同じかなを消費
      continue;
    }
    const next = runs[idx + 1];
    const nextKana = next && !next.kanji ? next.text[0] : '';
    let end = nextKana ? reading.indexOf(nextKana, ri) : reading.length;
    if (end < ri) end = reading.length; // 見つからなければ末尾まで
    const coreReading = reading.slice(ri, end);
    out += coreReading ? run.text + '（' + coreReading + '）' : run.text;
    ri = end;
  }
  return out;
}
