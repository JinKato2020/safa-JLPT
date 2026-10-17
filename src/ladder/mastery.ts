// (アイテム×面) の習得状態。減衰付き。純TS。設計書 §1.4。
export const DAY = 86_400_000;

export type Facet =
  | 'on' | 'meaning'                                   // 語彙: 音 / 意
  | 'kanji_reading' | 'kanji_write' | 'kanji_meaning'  // 漢字: 聞き取り(音→字) / 書き取り / 意味
  | 'g_order' | 'g_meaning';                           // 文法: 並べ替え / 意味

export interface FacetState {
  m: number;          // 習得度 0..1 (受容確率)
  evidence: number;   // 累積エビデンス重み
  updatedAt: number;  // epoch ms (減衰起点)
  reps: number;       // SRS 連続正答
  intervalDays: number;
  ease: number;
  dueAt: number;
}

const EVIDENCE_CAP = 10;
const BASE_HALFLIFE = 14; // 日
const FLOOR = 0.1;
export const RECEIVED_INTERVAL_DAYS = 7;

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function newFacetState(now: number): FacetState {
  return { m: 0, evidence: 0, updatedAt: now, reps: 0, intervalDays: 0, ease: 2.5, dueAt: now };
}

// 減衰後の「今の実力」。強い記憶ほど半減期が長い。状態は変えない。
export function effectiveM(s: FacetState, now: number): number {
  const days = (now - s.updatedAt) / DAY;
  if (days <= 0) return s.m;
  const halfLife = BASE_HALFLIFE * (0.5 + s.m);
  const factor = Math.pow(0.5, days / halfLife);
  return FLOOR + (s.m - FLOOR) * factor;
}

export function updateMastery(s: FacetState, outcome: number, weight: number, now: number): FacetState {
  const decayed = effectiveM(s, now);
  const n = Math.min(s.evidence, EVIDENCE_CAP);
  const m = (decayed * n + outcome * weight) / (n + weight);
  return { ...s, m: clamp(m, 0, 1), evidence: s.evidence + weight, updatedAt: now };
}

export type Stage = 'new' | 'received' | 'produced';

// 受容済 = SRS間隔が一定以上(§1.4)。産出済 = 産出形式で安定(producedOk)。
export function stageOf(s: FacetState, now: number, producedOk: boolean): Stage {
  const received = s.intervalDays >= RECEIVED_INTERVAL_DAYS && effectiveM(s, now) >= 0.5;
  if (received && producedOk) return 'produced';
  if (received) return 'received';
  return 'new';
}
