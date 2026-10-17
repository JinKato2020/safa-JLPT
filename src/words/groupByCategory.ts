// 項目配列を割当mappingでカテゴリ別セクションに分ける純関数。順序=taxonomy order・空カテゴリ除外。
import { CATS, type CatKind, type Cat } from '../data/categories';

export interface CatSection<T> { catId: string; label: string; umbrella?: string; data: T[] }

export function groupByCategory<T>(
  items: T[], mapping: Record<string, string>, keyOf: (t: T) => string, kind: CatKind,
): CatSection<T>[] {
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const cid = mapping[keyOf(it)];
    if (!cid) continue; // 未割当は表示しない(データ側テストで0保証)
    let arr = buckets.get(cid);
    if (!arr) { arr = []; buckets.set(cid, arr); }
    arr.push(it);
  }
  return CATS
    .filter((c: Cat) => c.kind === kind && buckets.has(c.id))
    .map((c) => ({ catId: c.id, label: c.label, umbrella: c.umbrella, data: buckets.get(c.id)! }));
}
