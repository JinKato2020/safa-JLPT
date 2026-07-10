// 漢字の筆画データ(animCJK日本語・HanziWriter形式)を同梱JSONから同期ルックアップする。
// WebViewはネットに触れず、ここで得たJSONを KW.load(char, json) で注入する。完全オフライン。
import strokes from '../data/words/kakitoriStrokes.json';

type Entry = { strokes: string[]; medians: number[][][] };
const DATA = strokes as Record<string, Entry>;

export function hasCharData(char: string): boolean {
  return Object.prototype.hasOwnProperty.call(DATA, char);
}

/** 同梱の字形JSON(生文字列)を返す。互換のためPromise。収録外はreject(呼び出し側はエラーUI)。 */
export async function fetchCharData(char: string): Promise<string> {
  const e = DATA[char];
  if (!e) throw new Error('no stroke data: ' + char);
  return JSON.stringify(e);
}
