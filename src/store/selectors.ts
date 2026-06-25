// ストア状態 → JLPTエンジンへの橋渡し(派生値)。UI はこれを useMemo で呼ぶ。
import { computeRing, computeReadiness, effectiveP, type Category, type SectionInput } from '../engine/engine';
import { examOf } from '../engine/examProfile';
import { ringItemIdsFor, allItemIdsFor, jftItemIdsFor, allJftItemIdsFor, META } from '../data';
import type { AppState, GrowthPoint } from './state';
import { lastNDays } from './state';

const RING_CATS: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];

// 試験プロファイルに応じた項目id集合。JLPT=選択級 / JFT=N5+N4(A1+A2)統合スコープ。
// full=true: 学習＋模試(到達度/合格分母) / false: 学習集合(小リング分母)。
function examItemIds(state: AppState, category: Category, full: boolean): string[] {
  if ((state.settings.targetExam ?? 'jlpt') === 'jft') return full ? allJftItemIdsFor(category) : jftItemIdsFor(category);
  return full ? allItemIdsFor(state.settings.level, category) : ringItemIdsFor(state.settings.level, category);
}

/** 4区分リング(0-100 / 未測定 null)を現在の級・習得状態から算出。 */
export function ringsFor(state: AppState, now: number): Record<Category, number | null> {
  const out = {} as Record<Category, number | null>;
  for (const c of RING_CATS) {
    const ids = examItemIds(state, c, false);
    const states = ids
      .map((id) => state.items[id])
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    out[c] = computeRing(ids.length, states, now);
  }
  return out;
}

// 公式の区分別基準点(passMarks)の各セクション → 本アプリの4区分カテゴリへの対応。
const SECTION_CATS: Record<string, Category[]> = {
  gengo_dokkai: ['moji_goi', 'bunpou', 'dokkai'], // N5/N4: 言語知識(文字語彙・文法)＋読解
  gengo: ['moji_goi', 'bunpou'],                  // N3: 言語知識
  dokkai: ['dokkai'],                             // N3: 読解
  choukai: ['choukai'],                           // 聴解
};
const SECTION_LABEL: Record<string, string> = {
  gengo_dokkai: '言語知識・読解',
  gengo: '言語知識',
  dokkai: '読解',
  choukai: '聴解',
};

/** 指定カテゴリ群の カバー率×習得度 の素(Σ習得度 と 項目数)。 */
// full=true(既定): 学習＋模試(allItemIds)=大リング/合格判定。 full=false: 学習のみ(ringItemIds)=ペース等。
function masteryParts(state: AppState, now: number, cats: Category[], full = true): { sum: number; n: number } {
  let sum = 0;
  let n = 0;
  for (const cat of cats) {
    const ids = examItemIds(state, cat, full);
    n += ids.length;
    for (const id of ids) {
      const st = state.items[id];
      if (st) sum += effectiveP(st, now);
    }
  }
  return { sum, n };
}

/** 総合準備度＋公式ゲート(総合点＋区分別基準点)による合格圏判定。試験プロファイルで切替。 */
export function readinessFor(state: AppState, now: number) {
  const prof = examOf(state.settings.targetExam);
  const evidenceTotal = Object.values(state.items).reduce((s, it) => s + it.evidence, 0);
  // JFT-Basic: 単一試験・各区分足切りなし・合格は総合80%(=200/250)のみ。知識ベース=examItemIdsでN5+N4(A1+A2)統合。
  if (prof.exam === 'jft') {
    const sections: SectionInput[] = RING_CATS.map((cat) => {
      const { sum, n } = masteryParts(state, now, [cat]);
      return { key: cat, label: cat, pct: n === 0 ? null : Math.round((100 * sum) / n), minPct: prof.jftPassPct };
    });
    const all = masteryParts(state, now, RING_CATS);
    const overallPct = all.n === 0 ? null : Math.round((100 * all.sum) / all.n);
    return computeReadiness(sections, overallPct, prof.jftPassPct, evidenceTotal, false);
  }
  const level = state.settings.level;
  const pm = META.passMarks[level];
  const sections: SectionInput[] = Object.entries(pm.sections).map(([key, sec]) => {
    const { sum, n } = masteryParts(state, now, SECTION_CATS[key] ?? []);
    return {
      key,
      label: SECTION_LABEL[key] ?? key,
      pct: n === 0 ? null : Math.round((100 * sum) / n),
      minPct: Math.round((100 * sec.min) / sec.max),
    };
  });
  const all = masteryParts(state, now, RING_CATS);
  const overallPct = all.n === 0 ? null : Math.round((100 * all.sum) / all.n);
  const overallMinPct = Math.round((100 * pm.overall) / pm.maxTotal);
  return computeReadiness(sections, overallPct, overallMinPct, evidenceTotal);
}

/** 「覚えた語」数 = 習得度 p>=0.6 の項目数(成長カーブ用)。 */
export function learnedCount(state: AppState): number {
  return Object.values(state.items).filter((it) => it.p >= 0.6).length;
}

/** 減衰を反映した「今」の覚えた語数(リング/成長カーブと整合)。 */
export function learnedNow(state: AppState, now: number): number {
  return Object.values(state.items).filter((it) => effectiveP(it, now) >= 0.6).length;
}

/** 区分ごとの「覚えた/全語」(リング項目ベース。覚えた=減衰後 p>=0.6・リング%と整合)。 */
export function ringLearnedRatio(state: AppState, now: number): Record<Category, { learned: number; total: number }> {
  const out = {} as Record<Category, { learned: number; total: number }>;
  for (const c of RING_CATS) {
    const ids = examItemIds(state, c, false);
    let learned = 0;
    for (const id of ids) {
      const st = state.items[id];
      if (st && effectiveP(st, now) >= 0.6) learned++;
    }
    out[c] = { learned, total: ids.length };
  }
  return out;
}

/** 成長カーブ(学習日ごとの習得数スナップショット)。 */
export function growthSeries(state: AppState): GrowthPoint[] {
  return state.growth ?? [];
}

/** 直近 n 日の密な成長カーブ。各日=その日時点の累積「覚えた語」(キャリーフォワード)。1日分でも線になる。 */
export function growthCurve(state: AppState, today: string, n = 14): GrowthPoint[] {
  const pts = state.growth ?? [];
  let i = 0;
  let cur = 0;
  return lastNDays(today, n).map((day) => {
    while (i < pts.length && pts[i].day <= day) {
      cur = pts[i].learned;
      i++;
    }
    return { day, learned: cur };
  });
}

export interface ProgressSnapshot {
  score: number;   // 準備度
  band: number;    // 信頼幅 ±
  learned: number; // 覚えた語(減衰後 p>=0.6)
  touched: number; // 採点した語(evidence>0)= 毎回必ず動く
}

/** セッション前後比較用の進捗スナップショット(序盤の伸び体感に使う)。 */
export function progressSnapshot(state: AppState, now: number): ProgressSnapshot {
  const r = readinessFor(state, now);
  const touched = Object.values(state.items).filter((it) => it.evidence > 0).length;
  return { score: r.score, band: r.band, learned: learnedNow(state, now), touched };
}

export interface PacePrediction {
  passing: boolean;
  perDay: number;      // 覚えた語/学習日(ペース・小数1桁)
  itemsNeeded: number; // 合格に必要な残り(目安・最長ゲート)
  daysToPass: number | null; // 学習履歴が無いとnull
}

/** 「このペースであと◯日で合格圏」の目安。最長ゲート(最も足りない区分/総合)の残り÷ペース。 */
export function pacePrediction(state: AppState, now: number): PacePrediction {
  const r = readinessFor(state, now);
  if (r.passing) return { passing: true, perDay: 0, itemsNeeded: 0, daysToPass: 0 };
  const pm = META.passMarks[state.settings.level];
  let needed = 0;
  for (const [key, sec] of Object.entries(pm.sections)) {
    const { sum, n } = masteryParts(state, now, SECTION_CATS[key] ?? [], false);
    if (n === 0) continue;
    const pct = (100 * sum) / n;
    const min = (100 * sec.min) / sec.max;
    if (pct < min) needed = Math.max(needed, Math.ceil(((min - pct) / 100) * n));
  }
  const all = masteryParts(state, now, RING_CATS, false);
  if (all.n > 0) {
    const oPct = (100 * all.sum) / all.n;
    const oMin = (100 * pm.overall) / pm.maxTotal;
    if (oPct < oMin) needed = Math.max(needed, Math.ceil(((oMin - oPct) / 100) * all.n));
  }
  const studyDays = state.streak.history.length;
  const perDay = studyDays > 0 ? learnedNow(state, now) / studyDays : 0;
  const daysToPass = perDay > 0 ? Math.ceil(needed / perDay) : null;
  return { passing: false, perDay: Math.round(perDay * 10) / 10, itemsNeeded: needed, daysToPass };
}

const NBA_MAP: Record<Category, { label: string; route: 'Flashcard' | 'Grammar' | 'Reading' | 'Listening' }> = {
  moji_goi: { label: '漢字・語彙', route: 'Flashcard' },
  bunpou: { label: '文法', route: 'Grammar' },
  dokkai: { label: '読解', route: 'Reading' },
  choukai: { label: '聴解', route: 'Listening' },
};

export interface NextAction {
  category: Category;
  label: string;
  route: 'Flashcard' | 'Grammar' | 'Reading' | 'Listening';
  reason: string;
}

/** Next Best Action = 最弱セクション内で最も低い区分の学習を勧める。 */
export function nextBestAction(state: AppState, now: number): NextAction | null {
  const r = readinessFor(state, now);
  if (r.passing || !r.weakest) return null;
  const cats = SECTION_CATS[r.weakest.key] ?? [];
  const rings = ringsFor(state, now);
  let target: Category = cats[0] ?? 'moji_goi';
  let lowest = Infinity;
  for (const cat of cats) {
    const v = rings[cat] ?? 0;
    if (v < lowest) { lowest = v; target = cat; }
  }
  const m = NBA_MAP[target];
  const ringPct = rings[target];
  const pctTxt = ringPct === null ? '未測定' : `${ringPct}%`;
  return { category: target, label: m.label, route: m.route, reason: `いちばん低い区分（到達度 ${pctTxt}）` };
}

// 達成ランク(C): 級内の習得率(覚えた/全)で上がる“帯”。コンテンツは固定しない(出題は易しい順=A)。合格判定とは別軸。
const RANKS = [
  { min: 0, name: '入門' }, { min: 15, name: '初級' }, { min: 35, name: '中級' },
  { min: 55, name: '上級' }, { min: 80, name: '仕上げ' },
];
/** 級の学習ランク(習得率ベース)。 */
export function levelRank(state: AppState, now: number) {
  let learned = 0;
  let total = 0;
  for (const c of RING_CATS) {
    const ids = examItemIds(state, c, false);
    total += ids.length;
    for (const id of ids) { const st = state.items[id]; if (st && effectiveP(st, now) >= 0.6) learned++; }
  }
  const pct = total ? Math.round((100 * learned) / total) : 0;
  let i = 0;
  for (let k = RANKS.length - 1; k >= 0; k--) if (pct >= RANKS[k].min) { i = k; break; }
  const next = RANKS[i + 1];
  return { pct, learned, total, rank: RANKS[i].name, rankIndex: i, rankCount: RANKS.length, nextName: next ? next.name : null, nextAt: next ? next.min : null };
}
