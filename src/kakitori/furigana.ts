// 例語をRubyText解釈可能な「漢字コア（読み）」形に変換する純関数。
// 共有する先頭/末尾のかな(送り仮名)を剥がし、漢字コアだけに読みを付ける。
const isKana = (ch: string): boolean => /[ぁ-ゖァ-ヶー]/.test(ch);

/** 例: 美しい/うつくしい → 美（うつく）しい ・ 上手/じょうず → 上手（じょうず） ・ お茶/おちゃ → お茶（ちゃ）。 */
export function rubyForWord(word: string, reading: string): string {
  if (!word || !reading) return word;
  let i = 0;
  while (i < word.length && i < reading.length && word[i] === reading[i] && isKana(word[i])) i++;
  let we = word.length, re = reading.length;
  while (we > i && re > i && word[we - 1] === reading[re - 1] && isKana(word[we - 1])) { we--; re--; }
  const lead = word.slice(0, i), core = word.slice(i, we), trail = word.slice(we);
  const coreReading = reading.slice(i, re);
  if (!core || !/[一-龿々]/.test(core) || coreReading === core) return word; // 漢字コア無し/読み不要は素通し
  return lead + core + '（' + coreReading + '）' + trail;
}
