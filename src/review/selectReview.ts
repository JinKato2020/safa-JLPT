// Phase4: 統合復習「試験問題の復習」の出題対象選抜(純ロジック)。
// 設計 §4.1/§4.2: 既に触れた(面state有)苦手のみ・新出は出さない・忘却曲線(dueAt<=now)を保持率低い順。
import { effectiveP } from '../engine/engine';
import type { MasterySlice } from './facetMastery';
import type { Facet } from './facetMap';
import type { Rng } from '../quiz/quiz';

export interface ReviewPick { itemId: string; facet: Facet }

interface Scored extends ReviewPick { p: number; due: boolean }

/** 同一面が3連続しないよう、優先順をできるだけ保って並べ替える(活動を交互に)。 */
function avoidTriples(items: ReviewPick[]): ReviewPick[] {
  const out: ReviewPick[] = [];
  const pool = items.slice();
  while (pool.length) {
    let idx = 0;
    const n = out.length;
    if (n >= 2 && out[n - 1].facet === out[n - 2].facet) {
      const j = pool.findIndex((p) => p.facet !== out[n - 1].facet);
      if (j >= 0) idx = j; // 別の面を先に差し込む。無ければ仕方なく先頭。
    }
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

/**
 * 復習の出題対象を size 件選ぶ。既習(面state有)のみ。
 * ① dueAt<=now を effectiveP 昇順(弱い順)で。② 足りなければ非dueの弱い順で補充。③ 同一面3連続回避。
 */
export function selectReview(mastery: MasterySlice, now: number, size = 10, _rng?: Rng): ReviewPick[] {
  const scored: Scored[] = [];
  for (const itemId in mastery) {
    const facets = mastery[itemId];
    for (const f in facets) {
      const st = facets[f as Facet]!;
      scored.push({ itemId, facet: f as Facet, p: effectiveP(st, now), due: st.dueAt <= now });
    }
  }
  // 弱い順(p昇順)。安定のため p 同点は due 優先。
  scored.sort((a, b) => a.p - b.p || Number(b.due) - Number(a.due));
  const due = scored.filter((s) => s.due);
  const rest = scored.filter((s) => !s.due);
  const picked = (due.length >= size ? due.slice(0, size) : [...due, ...rest].slice(0, size))
    .map(({ itemId, facet }) => ({ itemId, facet }));
  return avoidTriples(picked);
}
