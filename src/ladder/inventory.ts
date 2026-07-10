// 面付きの学習アイテム在庫。実データ(vocab/kanji/grammar + kanjiFacets)から構築。
// カバー率の分母・出題選択の母集団に使う。設計書 §1。React非依存(静的JSONのみ)。
import vocab from '../data/vocab.json';
import grammar from '../data/grammar.json';
import kanjiCards from '../data/kanjiCards.json';
import kanjiFacets from '../data/kanjiFacets.json';
import { Level } from './facets';
import { Facet } from './mastery';

export type ItemType = 'vocab' | 'kanji' | 'grammar';
export interface LadderItem { id: string; type: ItemType; level: Level; facets: Facet[] }

const LEVELS: readonly Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
function asLevel(s: string): Level | null {
  const up = s.toUpperCase();
  return (LEVELS as readonly string[]).includes(up) ? (up as Level) : null;
}

export function buildInventory(): LadderItem[] {
  const items: LadderItem[] = [];

  for (const v of vocab as { id: string; level: string }[]) {
    const lv = asLevel(v.level);
    if (lv) items.push({ id: v.id, type: 'vocab', level: lv, facets: ['on', 'meaning'] });
  }

  const facetsMap = kanjiFacets as Record<string, { meaningClear: boolean }>;
  for (const [ch, card] of Object.entries(kanjiCards as Record<string, { level: string }>)) {
    const lv = asLevel(card.level);
    if (!lv) continue;
    const clear = facetsMap[ch]?.meaningClear ?? false;
    const facets: Facet[] = ['kanji_reading', 'kanji_write', ...(clear ? (['kanji_meaning'] as Facet[]) : [])];
    items.push({ id: `kanji:${ch}`, type: 'kanji', level: lv, facets });
  }

  for (const g of grammar as { id: string; level: string }[]) {
    const lv = asLevel(g.level);
    if (lv) items.push({ id: g.id, type: 'grammar', level: lv, facets: ['g_order', 'g_meaning'] });
  }

  return items;
}

export function inventoryCount(items: LadderItem[], level: Level, type: ItemType): number {
  let n = 0;
  for (const it of items) if (it.level === level && it.type === type) n += 1;
  return n;
}
