// 例語(word|reading)を vocab.json の id へ解決。完全一致のみ。一致=mp3再利用、無し=呼び側TTS。
import vocab from '../data/vocab.json';

const INDEX = new Map<string, string>();
for (const v of vocab as { id: string; word: string; reading: string }[]) {
  const key = `${v.word}|${v.reading}`;
  if (!INDEX.has(key)) INDEX.set(key, v.id);
}

export function vocabIdForWord(word: string, reading: string): string | null {
  return INDEX.get(`${word}|${reading}`) ?? null;
}
