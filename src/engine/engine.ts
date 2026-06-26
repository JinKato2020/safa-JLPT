// safa JLPT — JLPTエンジン (準備度の計算・純粋TS・React Native 非依存・単体テスト可)
// 掲示板§2: 準備度=1スコア(0-100)+信頼バンド。3信号融合・区分別 weakest-link・減衰・較正。
// 設計の肝: 項目別 習得度 p を信号で更新／使わないと減衰／区分リングへ集約／最弱区分へ引っ張る。

export type Level = 'N5' | 'N4' | 'N3';
export type Category = 'moji_goi' | 'bunpou' | 'dokkai' | 'choukai';
export type Grade = 'again' | 'hard' | 'good' | 'easy';

export const DAY = 86_400_000;

// 信号の重み(掲示板§2)。すべて客観。主観(自己採点)は合格ライン汚染防止のため評価系から排除。
export const SIGNAL_WEIGHT = {
  practice: 3, // 語彙/文法 練習(客観・自動採点)
  mini: 3,     // ミニ読解/聴解(客観)
  mock: 5,     // 本番形式テスト(客観・+信頼幅↓)
} as const;
export type SignalKind = keyof typeof SIGNAL_WEIGHT;

export interface ItemState {
  p: number;         // 習得度 0..1
  evidence: number;  // 累積エビデンス重み (信頼幅の収束に使用)
  updatedAt: number; // epoch ms (減衰の起点)
  reps: number;      // SRS 連続正答回数
  intervalDays: number;
  ease: number;      // SM-2 ease factor
  dueAt: number;     // 次回復習 epoch ms
}

const EVIDENCE_CAP = 10;  // 実効サンプル数の上限(直近の観測を効かせる=学習の現在地)
const BASE_HALFLIFE = 14; // 減衰の基準半減期(日)
const FLOOR = 0.1;        // 減衰が向かう床

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function newItemState(now: number): ItemState {
  return { p: 0, evidence: 0, updatedAt: now, reps: 0, intervalDays: 0, ease: 2.5, dueAt: now };
}

// 減衰を適用した「今の実力」p を返す純粋計算(状態は変えない=読み取り用)。"鉄は錆びる"。
export function effectiveP(state: ItemState, now: number): number {
  const days = (now - state.updatedAt) / DAY;
  if (days <= 0) return state.p;
  const halfLife = BASE_HALFLIFE * (0.5 + state.p); // 強い記憶ほど長持ち
  const factor = Math.pow(0.5, days / halfLife);
  return FLOOR + (state.p - FLOOR) * factor;
}

// 観測で p を更新(減衰込み)。outcome 0..1, weight=信号重み。
export function updateMastery(state: ItemState, outcome: number, weight: number, now: number): ItemState {
  const decayedP = effectiveP(state, now);
  const n = Math.min(state.evidence, EVIDENCE_CAP);
  const p = (decayedP * n + outcome * weight) / (n + weight);
  return { ...state, p: clamp(p, 0, 1), evidence: state.evidence + weight, updatedAt: now };
}

// SRS スケジューリング(客観採点の正誤を SM-2系の次回出題に反映)。
interface Schedule { reps: number; intervalDays: number; ease: number; dueAt: number; }

// スケジューリングのみ(習得度は触らない)。again=数分後に戻す=復習ループ(次バッチに再出題)。
function scheduleAfterGrade(state: ItemState, grade: Grade, now: number): Schedule {
  let { reps, intervalDays, ease } = state;
  if (grade === 'again') {
    reps = 0; intervalDays = 0; ease = clamp(ease - 0.2, 1.3, 2.8);
  } else {
    if (reps === 0) intervalDays = 1;
    else if (reps === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);
    if (grade === 'hard') intervalDays = Math.max(1, Math.round(intervalDays * 0.6));
    ease = clamp(ease + (grade === 'easy' ? 0.15 : grade === 'good' ? 0 : -0.15), 1.3, 2.8);
    reps += 1;
  }
  const dueAt = grade === 'again' ? now + 600_000 /*10分後=すぐ復習へ*/ : now + intervalDays * DAY;
  return { reps, intervalDays, ease, dueAt };
}

/** 診断クイズ(客観採点・重み3)。正解=間隔↑、不正解=習得度↓＋数分後に再出題(復習ループ)。 */
export function recordQuiz(state: ItemState, correct: boolean, now: number): ItemState {
  const grade: Grade = correct ? 'good' : 'again';
  const updated = updateMastery(state, correct ? 1 : 0, SIGNAL_WEIGHT.practice, now);
  return { ...updated, ...scheduleAfterGrade(state, grade, now) };
}

/** 本番形式テスト(客観採点・重み5=最も信頼度が高く±を狭める)。スケジュールも更新。 */
export function recordMock(state: ItemState, correct: boolean, now: number): ItemState {
  const grade: Grade = correct ? 'good' : 'again';
  const updated = updateMastery(state, correct ? 1 : 0, SIGNAL_WEIGHT.mock, now);
  return { ...updated, ...scheduleAfterGrade(state, grade, now) };
}

// 区分リング(0-100) = カバー率×習得度。対象項目0なら null("–"で未測定を正直に)。
export function computeRing(totalItems: number, states: ItemState[], now: number): number | null {
  if (totalItems === 0) return null; // 未作成区分(MVPの読解/聴解)
  let sum = 0;
  for (const st of states) sum += effectiveP(st, now);
  return Math.round((100 * sum) / totalItems);
}

// 公式JLPTセクション(=区分別基準点の単位)の入力/結果。
export interface SectionInput {
  key: string;
  label: string;
  pct: number | null; // そのセクションの習得率(カバー率×習得度・0-100) / 未測定null
  minPct: number;     // 公式の区分別基準点(% 例 19/60≒32)
}
export interface SectionResult extends SectionInput {
  pass: boolean;  // pct >= minPct
  ratio: number;  // pct / minPct (達成率・未測定は0)
}

export interface Readiness {
  score: number;            // 0-100 準備度(weakest-link合成)
  passProbability: number;  // 0-100 合格率(全ゲートを同時にクリアする推定確率・信頼幅を反映)=大リング表示用
  band: number;             // ± 信頼幅
  passing: boolean;         // 公式ゲート全達成(=合格圏): 全セクション基準点クリア かつ 総合クリア
  gateRatio: number;        // 最弱ゲートの達成率(>=1 で合格圏)
  overallPct: number | null;
  overallMinPct: number;
  sections: SectionResult[];
  weakest: SectionResult | null; // 達成率が最も低い=次に強化すべき
}

const LAMBDA = 0.4; // weakest-link の引っ張り強さ(0=平均, 1=最弱)

// 総合準備度 = 公式の「総合点＋区分別基準点」の両ゲートで合否判定。
// score は最弱セクションへ引っ張った合成(ゲージ)。合格圏(passing)は公式ゲートで厳密判定。
export function computeReadiness(
  sections: SectionInput[],
  overallPct: number | null,
  overallMinPct: number,
  evidenceTotal: number,
  sectionGates = true, // JLPT=true(各区分足切り) / JFT=false(総合200のみ・区分は診断)
  unmeasuredCats = 0,  // 未測定の【区分】数(漢字語彙/文法/読解/聴解のうち未着手)。合算セクションが測定済区分だけで高く出る問題への補正用。
): Readiness {
  const results: SectionResult[] = sections.map((s) => ({
    ...s,
    pass: s.pct !== null && s.pct >= s.minPct,
    ratio: s.pct === null ? 0 : s.minPct > 0 ? s.pct / s.minPct : 1,
  }));

  const measured = results.filter((r) => r.pct !== null).map((r) => r.pct as number);
  let score = 0;
  if (measured.length > 0) {
    const mean = measured.reduce((a, b) => a + b, 0) / measured.length;
    const min = Math.min(...measured);
    score = Math.round(mean - LAMBDA * (mean - min)); // 最弱セクションが総合を押し下げる
  }

  const overallRatio = overallPct === null ? 0 : overallMinPct > 0 ? overallPct / overallMinPct : 1;
  const gateRatio = Math.min(overallRatio, ...results.map((r) => r.ratio));
  // 全区分(カテゴリ)が測定済み＝unmeasuredCats===0 を合格圏の必須条件に(文法/読解未測定で"合格圏"にしない)。
  const allMeasured = overallPct !== null && results.every((r) => r.pct !== null) && unmeasuredCats === 0;
  const passing = allMeasured && overallPct >= overallMinPct && (!sectionGates || results.every((r) => r.pass));

  let weakest: SectionResult | null = null;
  for (const r of results) if (!weakest || r.ratio < weakest.ratio) weakest = r;

  // 信頼幅: 客観エビデンスで収束 / 未測定セクション・未測定区分で拡大。
  const unmeasured = results.filter((r) => r.pct === null).length;
  const fromEvidence = 11 * Math.exp(-evidenceTotal / 80);
  const band = Math.round(clamp(fromEvidence + unmeasured * 2 + unmeasuredCats * 2, 3, 18));

  // 合格率 = 全ゲート(各セクション足切り＋総合)を同時にクリアする推定確率。各ゲートの「現在値−基準点」を
  // 信頼幅σで正規化しロジスティックCDFで確率化→積。未測定セクションは不確実(低め)。σは信頼幅(最低6)。
  const sigma = Math.max(band, 6);
  const phi = (x: number) => 1 / (1 + Math.exp(-1.6 * x));
  let pp = 1;
  for (const r of results) {
    if (r.pct === null) { pp *= 0.3; continue; } // 未測定=不確実
    if (sectionGates) pp *= phi((r.pct - r.minPct) / sigma); // JLPT=各区分足切り
  }
  if (overallPct !== null) pp *= phi((overallPct - overallMinPct) / sigma); else pp *= 0.3;
  // 未測定の区分があるほど合格率を下げる(合算セクションが測定済区分だけで高く出ても、未着手の区分は合否リスク)。
  pp *= Math.pow(0.45, unmeasuredCats);
  const passProbability = Math.round(clamp(pp * 100, 0, 99));

  return {
    score,
    passProbability,
    band,
    passing,
    gateRatio: Math.round(gateRatio * 100) / 100,
    overallPct,
    overallMinPct,
    sections: results,
    weakest,
  };
}
