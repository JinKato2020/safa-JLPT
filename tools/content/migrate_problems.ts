// app/tools/content/migrate_problems.ts — 単票バンク(文字語彙・文法)を新形式(言語非依存＋i18n)へ変換。
import { type ContentFile, type ContentItem, type DaimonSpec } from './schema.ts';

export function toItem(raw: Record<string, unknown>, spec: DaimonSpec): ContentItem {
  const item: ContentItem = { id: String(raw.id), i18n: {} };
  for (const k of spec.neutral) if (raw[k] !== undefined) item[k] = raw[k];
  // JA解説(synonymは元 reason)。空文字は入れない。
  const jaField = spec.daimon === 'synonym' ? 'reason' : 'explain';
  for (const outField of spec.translate) {
    const ja = raw[jaField];
    if (typeof ja === 'string' && ja) (item.i18n.ja ??= {})[outField] = ja;
    const neKey = spec.neField;
    const ne = neKey ? raw[neKey] : undefined;
    if (typeof ne === 'string' && ne) (item.i18n.ne ??= {})[outField] = ne;
  }
  return item;
}
export function groupToFiles(raw: Record<string, unknown>[], spec: DaimonSpec): ContentFile[] {
  const byLevel = new Map<string, ContentItem[]>();
  for (const r of raw) { const lv = String(r.level); (byLevel.get(lv) ?? byLevel.set(lv, []).get(lv)!).push(toItem(r, spec)); }
  return [...byLevel.entries()].map(([level, items]) => ({ schema: 1, daimon: spec.daimon, level, languages: ['ja', 'ne'], items }));
}
