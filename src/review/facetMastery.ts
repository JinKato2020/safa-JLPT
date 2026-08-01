// 面別マスタリーの読み書き。既存 engine の ItemState/SRS をそのまま面単位で再利用する(新SRS数学は作らない)。
// 設計: docs/superpowers/specs/2026-08-01-unified-facet-review-design.md §3.2/§3.3。
import { type ItemState, newItemState, effectiveP, updateMastery, recordQuiz, recordMock, SIGNAL_WEIGHT } from '../engine/engine';
import type { Facet, FacetTarget } from './facetMap';

/** itemId → 面 → ItemState。適用可能な面だけ持つ(省メモリ・未習は無し)。 */
export type MasterySlice = Record<string, Partial<Record<Facet, ItemState>>>;

export function getFacet(m: MasterySlice, itemId: string, facet: Facet): ItemState | undefined {
  return m[itemId]?.[facet];
}

/** 減衰込みの「今の面の実力」。未習は null。 */
export function facetEffectiveP(m: MasterySlice, itemId: string, facet: Facet, now: number): number | null {
  const s = m[itemId]?.[facet];
  return s ? effectiveP(s, now) : null;
}

// 1つの面ターゲットを更新して次の ItemState を返す(不変)。補強(weight<1)は成功時のみ控えめに、失敗では下げない。
function applyTarget(prev: ItemState | undefined, t: FacetTarget, correct: boolean, signal: 'practice' | 'mock', now: number): ItemState | null {
  const cur = prev ?? newItemState(now);
  if (t.weight >= 1) {
    // 認識面: 大問由来。失敗で減点＋SRSリセット(engineの標準挙動)。
    return signal === 'mock' ? recordMock(cur, correct, now) : recordQuiz(cur, correct, now);
  }
  // 補強面(産出/書き取り): 成功のみ底上げ。失敗は認識面を下げない=無変更(nullで据え置き)。
  if (!correct) return null;
  const sched = recordQuiz(cur, true, now); // 'good' のスケジュール(reps++/dueAt)を借りる
  const light = updateMastery(cur, 1, SIGNAL_WEIGHT[signal] * t.weight, now); // p は重みを weight 倍に薄めて合成
  return { ...sched, p: light.p, evidence: light.evidence };
}

/**
 * 複数の面ターゲットへ正誤を反映した新しい MasterySlice を返す(不変)。
 * signal: 'practice'(重み3) / 'mock'(重み5)。補強ターゲット(weight<1)は成功時のみ効く。
 */
export function recordFacet(m: MasterySlice, targets: FacetTarget[], correct: boolean, signal: 'practice' | 'mock', now: number): MasterySlice {
  if (!targets.length) return m;
  let next = m;
  for (const t of targets) {
    const updated = applyTarget(next[t.itemId]?.[t.facet], t, correct, signal, now);
    if (!updated) continue; // 補強の失敗=据え置き
    next = { ...next, [t.itemId]: { ...next[t.itemId], [t.facet]: updated } };
  }
  return next;
}
