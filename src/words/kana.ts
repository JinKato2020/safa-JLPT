// 仮名書き取り用の文字リスト(五十音順)＋ローマ字。字形データは kakitoriStrokes.json に収録済み。
// 清音46 → 濁音/半濁音25 の順。小書き・ゐゑヰヱは練習対象外(簡潔さ優先)。

export const HIRAGANA: string[] = [
  ...'あいうえお', ...'かきくけこ', ...'さしすせそ', ...'たちつてと', ...'なにぬねの',
  ...'はひふへほ', ...'まみむめも', ...'やゆよ', ...'らりるれろ', ...'わをん',
  ...'がぎぐげご', ...'ざじずぜぞ', ...'だぢづでど', ...'ばびぶべぼ', ...'ぱぴぷぺぽ',
];

export const KATAKANA: string[] = [
  ...'アイウエオ', ...'カキクケコ', ...'サシスセソ', ...'タチツテト', ...'ナニヌネノ',
  ...'ハヒフヘホ', ...'マミムメモ', ...'ヤユヨ', ...'ラリルレロ', ...'ワヲン',
  ...'ガギグゲゴ', ...'ザジズゼゾ', ...'ダヂヅデド', ...'バビブベボ', ...'パピプペポ',
];

// 表示用ローマ字(ひらがな基準・カタカナは同音で共用)。
const ROMAJI: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
};

// カタカナ→対応ひらがな(コード差 0x60)でローマ字を引く。
export function romajiOf(kana: string): string {
  if (ROMAJI[kana]) return ROMAJI[kana];
  const cp = kana.codePointAt(0) ?? 0;
  if (cp >= 0x30a1 && cp <= 0x30f6) return ROMAJI[String.fromCodePoint(cp - 0x60)] ?? '';
  return '';
}

// 書き取りの「行」選択用(ア行〜ワ行＋濁音/半濁音)。label=代表字。h=ひらがな, k=カタカナ。
export interface KanaRow { key: string; label: string; h: string; k: string; }
export const KANA_ROWS: KanaRow[] = [
  { key: 'a',  label: 'あ', h: 'あいうえお', k: 'アイウエオ' },
  { key: 'ka', label: 'か', h: 'かきくけこ', k: 'カキクケコ' },
  { key: 'sa', label: 'さ', h: 'さしすせそ', k: 'サシスセソ' },
  { key: 'ta', label: 'た', h: 'たちつてと', k: 'タチツテト' },
  { key: 'na', label: 'な', h: 'なにぬねの', k: 'ナニヌネノ' },
  { key: 'ha', label: 'は', h: 'はひふへほ', k: 'ハヒフヘホ' },
  { key: 'ma', label: 'ま', h: 'まみむめも', k: 'マミムメモ' },
  { key: 'ya', label: 'や', h: 'やゆよ',   k: 'ヤユヨ' },
  { key: 'ra', label: 'ら', h: 'らりるれろ', k: 'ラリルレロ' },
  { key: 'wa', label: 'わ', h: 'わをん',   k: 'ワヲン' },
  { key: 'ga', label: 'が', h: 'がぎぐげご', k: 'ガギグゲゴ' },
  { key: 'za', label: 'ざ', h: 'ざじずぜぞ', k: 'ザジズゼゾ' },
  { key: 'da', label: 'だ', h: 'だぢづでど', k: 'ダヂヅデド' },
  { key: 'ba', label: 'ば', h: 'ばびぶべぼ', k: 'バビブベボ' },
  { key: 'pa', label: 'ぱ', h: 'ぱぴぷぺぽ', k: 'パピプペポ' },
];

/** 指定の行(key)の文字配列を返す。script でひらがな/カタカナを切替。 */
export function kanaRowChars(script: 'hiragana' | 'katakana', rowKey: string): string[] {
  const row = KANA_ROWS.find((r) => r.key === rowKey);
  if (!row) return [];
  return [...(script === 'katakana' ? row.k : row.h)];
}
