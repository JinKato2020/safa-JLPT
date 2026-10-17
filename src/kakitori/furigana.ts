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
  // 各runの後ろに漢字runが残っているか(=これが最後の漢字か)を先に求める。
  const kanjiAfter = new Array(runs.length).fill(false);
  for (let i = runs.length - 1, seen = false; i >= 0; i--) { kanjiAfter[i] = seen; if (runs[i].kanji) seen = true; }
  let ri = 0;
  let out = '';
  for (let idx = 0; idx < runs.length; idx++) {
    const run = runs[idx];
    if (!run.kanji) {
      out += run.text;
      if (reading.startsWith(run.text, ri)) ri += run.text.length; // 読み側の同じかなを消費
      continue;
    }
    let end: number;
    if (!kanjiAfter[idx]) {
      // これが最後の漢字run。以降は全て送り仮名(かな=自身の読み)なので、
      // 末尾から送り仮名の長さを差し引いて「右寄せ」で漢字の読みを確定する。
      // これにより 五つ=いつつ(五＝いつ／送りつ)を 五（い）つ と誤らず 五（いつ）つ にできる。
      // また 刺さる=ささる 等、漢字読みが送り仮名と同字で始まる語の「ルビ消失」も解消。
      let trailingKana = 0;
      for (let j = idx + 1; j < runs.length; j++) trailingKana += runs[j].text.length;
      end = reading.length - trailingKana;
      if (end <= ri) end = reading.length; // 異常時は末尾まで(従来挙動に退避)
    } else {
      // まだ後ろに漢字が続く。次のかな(送り/助詞)の頭で左から区切る。
      // 検索開始を ri+1 にして漢字が最低1モーラ消費するよう保証する
      // (言い訳=いいわけ で 言＝い が送りの い と衝突しルビ消失する問題を解消)。
      const next = runs[idx + 1];
      const nextKana = next && !next.kanji ? next.text[0] : '';
      end = nextKana ? reading.indexOf(nextKana, ri + 1) : reading.length;
      if (end < ri) end = reading.length;
    }
    const coreReading = reading.slice(ri, end);
    out += coreReading ? run.text + '（' + coreReading + '）' : run.text;
    ri = end;
  }
  return out;
}
