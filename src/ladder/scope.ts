// 語→漢字スコープ判定。語の「漢字読み・表記」は構成漢字(漢字アイテム)の習得から合成するため、
// その語の漢字が全て「学習対象(カード集合612 かつ ≤当該レベル)」に収まるかを判定する。設計書 §1.3。
import kanjiCards from '../data/words/kanjiCards.json';
import { Level } from './facets';

const LEVELS: readonly Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const lvIdx = (l: Level): number => LEVELS.indexOf(l);

const KANJI_LEVEL: Record<string, Level> = {};
for (const [ch, card] of Object.entries(kanjiCards as Record<string, { level: string }>)) {
  const up = card.level.toUpperCase();
  if ((LEVELS as readonly string[]).includes(up)) KANJI_LEVEL[ch] = up as Level;
}

export function kanjiInWord(word: string): string[] {
  return [...word].filter((c) => /[一-鿿]/.test(c));
}

// 全ての構成漢字が「カード集合内 かつ ≤level」なら true(漢字を含まない語も vacuously true)。
export function wordInScope(word: string, level: Level): boolean {
  const wl = lvIdx(level);
  for (const ch of kanjiInWord(word)) {
    const kl = KANJI_LEVEL[ch];
    if (kl === undefined) return false;   // カード外(上位/未収録)
    if (lvIdx(kl) > wl) return false;      // 語より上位レベルの漢字
  }
  return true;
}

// スコープ内の漢字を実際に持つ語か(=漢字読み/表記の対象になり得る)。
export function hasInScopeKanji(word: string, level: Level): boolean {
  return kanjiInWord(word).length > 0 && wordInScope(word, level);
}
