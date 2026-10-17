// 例語(word|reading)を vocab.json の id へ解決。完全一致のみ。一致=mp3再利用、無し=呼び側TTS。
// app語彙に無い漢字カード例語(根本/生ビール 等)は補助音声index(kx-*)で解決する。
import vocab from '../data/shared/vocab.json';
import kanjiExampleAudio from '../data/dict/kanjiExampleAudio.json';

const INDEX = new Map<string, string>();
for (const v of vocab as { id: string; word: string; reading: string }[]) {
  const key = `${v.word}|${v.reading}`;
  if (!INDEX.has(key)) INDEX.set(key, v.id);
}
// 補助(kx-*): app語彙に無い語のみ登録(既存idを上書きしない)。
for (const e of kanjiExampleAudio as { id: string; word: string; reading: string }[]) {
  const key = `${e.word}|${e.reading}`;
  if (!INDEX.has(key)) INDEX.set(key, e.id);
}

export function vocabIdForWord(word: string, reading: string): string | null {
  return INDEX.get(`${word}|${reading}`) ?? null;
}
