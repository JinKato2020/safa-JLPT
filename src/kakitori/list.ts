// 級別の書き取り対象漢字リストと字情報。データ源=kanji.json。
import kanji from '../data/dict/kanji.json';
import type { Level } from '../engine/engine';

export interface KanjiRow {
  char: string; level: string; type: string;
  on?: string; kun?: string; meaning?: string; strokes?: number; grade?: number;
}

const ROWS = kanji as KanjiRow[];

/** 指定級の漢字(char)配列。データ順(grade→頻度)を維持。 */
export function kanjiListFor(level: Level): string[] {
  return ROWS.filter((k) => k.type === 'kanji' && k.level === level).map((k) => k.char);
}

/** 漢字1字の情報(読み/意味/画数)。 */
export function kanjiInfo(char: string): KanjiRow | undefined {
  return ROWS.find((k) => k.type === 'kanji' && k.char === char);
}
