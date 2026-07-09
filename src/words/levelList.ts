// 単語タブ(自レベル学習)用: コアデータの当該レベルのみを返す純関数。拡張辞書(DICT_EXT)は含めない。
import { KANJI, VOCAB, GRAMMAR } from '../data';
import type { StudyItem } from '../data';

export type Kubun = 'kanji' | 'vocab' | 'grammar';

/** kubun の当該 level のコア項目(安定順=元データ順)。
 * 語彙は「～付き」が同レベルに素の基語を持つ場合は重複として除外(例: ～前/前, ～時間/時間)。 */
export function levelListFor(kubun: Kubun, level: string): StudyItem[] {
  const src: StudyItem[] = kubun === 'kanji' ? KANJI : kubun === 'vocab' ? VOCAB : GRAMMAR;
  const list = src.filter((i) => i.level === level);
  if (kubun !== 'vocab') return list;
  const wordOf = (i: StudyItem) => (i as { word?: string }).word ?? '';
  const plain = new Set(list.filter((i) => !/[～~]/.test(wordOf(i))).map(wordOf));
  return list.filter((i) => !(/[～~]/.test(wordOf(i)) && plain.has(wordOf(i).replace(/[～~]/g, ''))));
}
