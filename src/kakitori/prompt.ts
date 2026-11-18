import levelReadings from '../data/dict/kanjiLevelReadings.json';
import kanjiDrillReps from '../data/words/kanjiDrillReps.json';
import { kanjiInfo } from './list';

type Reading = { reading: string; type: 'on' | 'kun'; examples?: [string, string][] };
const READINGS = levelReadings as unknown as Record<string, Reading[]>;
const REPS = kanjiDrillReps as Record<string, { word: string; reading: string }>;

// 「漢字1字＋送り仮名」と「語幹＋同じ送り仮名」が一致する実在の例語だけを使う。
// 食べ物など、別の漢字を含む複合語から送り仮名を推測しない。
function exampleOkuri(char: string, stem: string, word: string, reading: string): string | undefined {
  if (!word.startsWith(char)) return undefined;
  const suffix = word.slice(char.length);
  return /^[ぁ-ゖー]+$/.test(suffix) && reading === stem + suffix ? suffix : undefined;
}

/** 書き取りのヒント。読み上げと同じ代表語を優先し、訓読みの送り仮名を省略しない。 */
export function kakitoriReadingLine(char: string): string {
  const rep = REPS[char];
  return (READINGS[char] ?? []).slice(0, 3).map(({ reading, type, examples }) => {
    if (type === 'on') return reading.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
    let okuri = rep ? exampleOkuri(char, reading, rep.word, rep.reading) : undefined;
    if (!okuri) {
      // 代表語が熟語の時は、辞書の「か.く」の区切りを利用する。
      const raw = (kanjiInfo(char)?.kun ?? '').split(/[、,]/)
        .map((r) => r.trim().replace(/^-+|-+$/g, ''))
        .find((r) => r.startsWith(reading + '.'));
      okuri = raw?.slice(reading.length + 1);
    }
    if (!okuri) {
      okuri = examples?.map(([word, kana]) => exampleOkuri(char, reading, word, kana)).find(Boolean);
    }
    return okuri ? `${reading}（${okuri}）` : reading;
  }).join('・');
}
