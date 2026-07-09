// 単語タブ(自レベル学習)用: コアデータの当該レベルのみを返す純関数。拡張辞書(DICT_EXT)は含めない。
import { KANJI, VOCAB, GRAMMAR } from '../data';
import type { StudyItem } from '../data';

export type Kubun = 'kanji' | 'vocab' | 'grammar';

/** kubun の当該 level のコア項目(安定順=元データ順)。 */
export function levelListFor(kubun: Kubun, level: string): StudyItem[] {
  const src: StudyItem[] = kubun === 'kanji' ? KANJI : kubun === 'vocab' ? VOCAB : GRAMMAR;
  return src.filter((i) => i.level === level);
}
