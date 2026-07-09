// 単語タブ(study)用: 区分別に割当mappingを選びカテゴリ別セクションを返す。
import { groupByCategory, type CatSection } from './groupByCategory';
import type { StudyItem } from '../data';
import type { Kubun } from './levelList';
import kanjiCat from '../data/kanjiCategory.json';
import vocabCat from '../data/vocabCategory.json';
import grammarCat from '../data/grammarCategory.json';

export function studySections(kubun: Kubun, items: StudyItem[]): CatSection<StudyItem>[] {
  if (kubun === 'kanji')
    return groupByCategory(items, kanjiCat as Record<string, string>, (i) => (i as { char: string }).char, 'kanji');
  if (kubun === 'grammar')
    return groupByCategory(items, grammarCat as Record<string, string>, (i) => i.id, 'grammar');
  return groupByCategory(items, vocabCat as Record<string, string>, (i) => i.id, 'vocab');
}
