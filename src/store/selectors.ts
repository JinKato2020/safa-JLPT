// ストア状態 → JLPTエンジンへの橋渡し(派生値)。UI はこれを useMemo で呼ぶ。
import { computeReadiness, effectiveP, type Category, type SectionInput } from '../engine/engine';
import { examOf } from '../engine/examProfile';
import { ringItemIdsFor, allItemIdsFor, jftItemIdsFor, allJftItemIdsFor, JFT_BANDS, META, KANJI, VOCAB, GRAMMAR, VOCAB_FREQ, readingIdsBySub, listeningIdsBySub } from '../data';
import { JLPT_BLUEPRINT, JFT_BLUEPRINT, DOKKAI_BLUEPRINT, CHOUKAI_BLUEPRINT, DAIMON_BLUEPRINT, type Daimon } from '../data/examBlueprint';
import { MOJI_DAIMON, BUNPOU_DAIMON, daimonUnitIds, daimonsWithUnits, bankLevelOf } from '../data/daimon';
import { hasKanji } from '../quiz/quiz';
import { passProbability as ladderPassProbability, itemP as ladderItemP, type DaimonExpectation } from '../ladder/passRate';
import { type Level as LadderLevel } from '../ladder/facets';
import type { AppState, GrowthPoint } from './state';
import { lastNDays } from './state';

const RING_CATS: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];

// 試験プロファイルに応じた項目id集合。JLPT=選択級 / JFT=N5+N4(A1+A2)統合スコープ。
// full=true: 学習＋模試(到達度/合格分母) / false: 学習集合(小リング分母)。
function examItemIds(state: AppState, category: Category, full: boolean): string[] {
  if ((state.settings.targetExam ?? 'jlpt') === 'jft') return full ? allJftItemIdsFor(category) : jftItemIdsFor(category);
  return full ? allItemIdsFor(state.settings.level, category) : ringItemIdsFor(state.settings.level, category);
}

// 難易度重み: 難問の習得/正解ほど能力を強く示す。(a)語彙は使用頻度で項目別に補正 (b)級は bankLevelOf(データ由来)優先、無ければ n3- 等のid接頭辞 (c)級はベース。
export function skillWeight(id: string): number {
  const b = JFT_BANDS[id];
  if (b) return b === 'A2.2' ? 1.6 : b === 'A2.1' ? 1.3 : 1;
  // 級(難易度の基軸)。バンクid(kb-/usg-/mk- いずれもデータから級を逆引き) と 語id(n3-v-123#…)の両対応。
  let level = 'N5';
  const bl = bankLevelOf(id);
  if (bl) level = bl;
  else { const p = id.slice(0, 2).toLowerCase(); if (p === 'n3' || p === 'n4' || p === 'n5') level = p.toUpperCase(); }
  const base = level === 'N3' ? 1.7 : level === 'N4' ? 1.3 : 1;
  // 語彙は使用頻度(VOCAB_FREQ: 1=高頻度/易 〜 50=稀/難)で項目別補正。同じ級でも稀語ほど重い。
  const vid = id.includes('#') ? id.slice(0, id.indexOf('#')) : id;
  const f = VOCAB_FREQ[vid];
  const mod = typeof f === 'number' ? 0.8 + 0.5 * Math.sqrt(Math.min(Math.max(f, 1), 50) / 50) : 1;
  return base * mod;
}

// 区分の達成度%(0-100 / 未測定null)。妥当性のため評価モデルを区分で分ける:
//  ・語彙/漢字/文法(離散知識) = カバー率×習得: 全項目のΣ習得度 / 全項目数(未習得=0で薄まる=「全部覚える」が目標)。
//    ※4択のまぐれはSRSの復習ループ(できるまで間隔反復)で自浄されるため当て推量補正はしない。
//  ・読解/聴解(般化スキル)   = 難易度重み付き正答率 ＋ 当て推量補正: 受けた設問のみを母数に重み平均。
//    4択は偶然25%当たるので g=0.25 を差し引き「真の実力」に直す(当てずっぽうレベル→0%)。
//    少数回答の過大評価を防ぐため prior は偶然レベル(0.25)へ軽く収縮(K)。0回=未測定(null)。
export const GUESS_RATE = 0.25; // 4択の偶然正解率
const SKILL_CATS: Category[] = ['dokkai', 'choukai'];
/** 当て推量補正: 観測正答率(0-1) → 真の実力(0-1)。(obs-g)/(1-g)。 */
export const guessCorrect = (obs: number, g = GUESS_RATE): number => Math.max(0, Math.min(1, (obs - g) / (1 - g)));
// 【正答率】ベースの達成度(般化スキル=読解/聴解 用)。解いた項目だけ・難易度重み・偶然レベルへprior収縮(K)・
// 当て推量補正。母数(全項目)は無視＝カバー率とは別軸。※知識(語彙/漢字/文法)は knowledgeDaimonPct(カバー率×習得)を使う。
// id集合の達成度%(難易度重み・偶然レベルへprior収縮・当て推量補正)。0回=null。
function pctOfIds(state: AppState, now: number, ids: string[]): number | null {
  let wsum = 0, wp = 0, n = 0;
  for (const id of ids) {
    const st = state.items[id];
    if (!st) continue; // 未着手は正答率に入れない(「何問解いたか」を分母にしない)
    const w = skillWeight(id);
    wsum += w; wp += w * effectiveP(st, now); n++;
  }
  if (n === 0) return null;
  const K = 2;
  const raw = (wp + K * GUESS_RATE) / (wsum + K); // 少数回答は偶然レベルへ収縮
  return Math.round(100 * guessCorrect(raw));     // 当て推量補正(当てずっぽう=0%)
}
// 知識(文字語彙/文法)の大問達成度＝【カバー率×習得を統合】。全項目の難易度重み平均習得度(未着手=0)。
// 少数の高正答を過大評価しない＝「覚えた量(カバー率)」が伴って初めて上がる。他アプリのC(量×質併記)/D(較正)準拠。
// 例: 2,000項目中10項目だけ習得(p0.8) → 10×0.8/2000≈0.4%(≒未習得)。1,600項目習得(p0.85) → 68%。0回=未測定(null)。
function knowledgeDaimonPct(state: AppState, now: number, ids: string[]): number | null {
  let sw = 0, swp = 0, touched = 0;
  for (const id of ids) {
    const w = skillWeight(id);
    const st = state.items[id];
    sw += w;
    if (st) { swp += w * effectiveP(st, now); touched++; }
  }
  if (touched === 0 || sw === 0) return null; // 未測定(未着手)
  return Math.round(100 * (swp / sw));         // 全項目の平均習得度(カバー率×習得)
}
// 区分の達成度%。coverageFolded=false: リング表示用【正答率】 / true: 合格率用【カバー率×習得】。
// 読解/聴解(般化スキル)は常に正答率(カバー率の概念なし)。
function categoryPct(state: AppState, now: number, cat: Category, full: boolean, coverageFolded = false): number | null {
  const knowFn = coverageFolded ? knowledgeDaimonPct : pctOfIds;
  const jft = (state.settings.targetExam ?? 'jlpt') === 'jft';
  const lv = state.settings.level;
  if (!jft && cat === 'dokkai') {
    const bySub = readingIdsBySub(lv, full); const bp = DOKKAI_BLUEPRINT[lv] ?? {};
    return wAvgPct(Object.entries(bySub).map(([k, ids]) => [pctOfIds(state, now, ids ?? []), bp[k] ?? 0]));
  }
  if (!jft && cat === 'choukai') {
    const bySub = listeningIdsBySub(lv, full); const bp = CHOUKAI_BLUEPRINT[lv] ?? {};
    return wAvgPct(Object.entries(bySub).map(([k, ids]) => [pctOfIds(state, now, ids ?? []), bp[k] ?? 0]));
  }
  // 文字語彙/文法(JLPT)は大問別。リング=正答率 / 合格率=カバー率×習得。本番出題数で加重。
  if (!jft && (cat === 'moji_goi' || cat === 'bunpou')) {
    const daimons = cat === 'moji_goi' ? MOJI_DAIMON : BUNPOU_DAIMON;
    const bp = DAIMON_BLUEPRINT[lv] ?? {};
    return wAvgPct(daimons.map((d) => [knowFn(state, now, daimonUnitIds(lv, d)), bp[d] ?? 0]));
  }
  // JFT(文字語彙/会話表現=知識)も同様。合格率はカバー率×習得、リングは正答率。
  if (jft && (cat === 'moji_goi' || cat === 'bunpou')) {
    return knowFn(state, now, examItemIds(state, cat, full));
  }
  return pctOfIds(state, now, examItemIds(state, cat, full));
}

// 「項目#大問」状態から、基底項目(語/文法/設問id)ごとに集約した「習得済み(≥0.6)」集合。量・カバー率用。
function masteredBases(state: AppState, now: number): Set<string> {
  const s = new Set<string>();
  for (const key in state.items) {
    if (effectiveP(state.items[key], now) >= 0.6) s.add(key.includes('#') ? key.slice(0, key.indexOf('#')) : key);
  }
  return s;
}
// 基底項目ごとに「1回でも学習した(状態あり)」集合。
function touchedBases(state: AppState): Set<string> {
  const s = new Set<string>();
  for (const key in state.items) s.add(key.includes('#') ? key.slice(0, key.indexOf('#')) : key);
  return s;
}

// 平均(null除外)。全null→null。
function avgPct(vals: (number | null)[]): number | null {
  const m = vals.filter((v): v is number => v !== null);
  return m.length ? Math.round(m.reduce((a, b) => a + b, 0) / m.length) : null;
}
// 加重平均(null除外・残りの重みで正規化)。本番配点/出題数で重み付けする用。
function wAvgPct(pairs: [number | null, number][]): number | null {
  let sw = 0, s = 0;
  for (const [p, w] of pairs) if (p !== null && w > 0) { s += p * w; sw += w; }
  return sw > 0 ? Math.round(s / sw) : null;
}

// JFT模試の250点採点(掲示板§🧮): 区分能力aᵢ=当て推量補正した難易度重み正答率 → 区分点sᵢ=aᵢ×62.5 → 推定総合=Σsᵢ(0-250)。合格200(A2.2)。
export interface JftMockScore { total: number; bandKey: string; pass: boolean; sectionScore: Record<Category, number>; }
export function jftMockScore(answers: { id: string; section: Category; correct: boolean }[]): JftMockScore {
  const sectionScore = {} as Record<Category, number>;
  let total = 0;
  for (const cat of RING_CATS) {
    const as = answers.filter((a) => a.section === cat);
    let wsum = 0, wc = 0;
    for (const a of as) { const w = skillWeight(a.id); wsum += w; if (a.correct) wc += w; }
    const acc = wsum > 0 ? wc / wsum : 0;
    const s = guessCorrect(acc) * 62.5; // 当て推量補正→区分点(最大62.5)
    sectionScore[cat] = Math.round(s);
    total += s;
  }
  total = Math.round(total);
  const bandKey = total >= 200 ? 'exam.jft_band_a22' : total >= 175 ? 'exam.jft_band_a21' : total >= 145 ? 'exam.jft_band_a1' : 'exam.jft_band_below';
  return { total, bandKey, pass: total >= 200, sectionScore };
}

/** 4区分リング(0-100 / 未測定 null)。知識=カバー率×習得 / 読解聴解=難易度重み正答率(categoryPct)。 */
export function ringsFor(state: AppState, now: number): Record<Category, number | null> {
  const out = {} as Record<Category, number | null>;
  for (const c of RING_CATS) out[c] = categoryPct(state, now, c, false);
  return out;
}
/** 小リング(大問): 正答率(解いた問題の当て推量補正済み正答率)。文字語彙/文法の各大問用。 */
export function daimonRingPct(state: AppState, now: number, daimon: Daimon): number | null {
  return pctOfIds(state, now, daimonUnitIds(state.settings.level, daimon));
}
/** 小リング(読解/聴解サブ種別): 正答率(般化スキル)。id集合を渡す。 */
export function idsRingPct(state: AppState, now: number, ids: string[]): number | null {
  return pctOfIds(state, now, ids);
}
// --- カバー率(量) = 別指標: 習得(p≥0.6)した項目 / 全項目。正答率(質)とは独立の学習量メーター。 ---
function coverPct(state: AppState, now: number, ids: string[]): number | null {
  if (!ids.length) return null;
  let m = 0;
  for (const id of ids) { const st = state.items[id]; if (st && effectiveP(st, now) >= 0.6) m++; }
  return Math.round((100 * m) / ids.length);
}
/** 大問のカバー率%(習得済み/全項目)。小リングの別指標。 */
export function daimonCoveragePct(state: AppState, now: number, daimon: Daimon): number | null {
  return coverPct(state, now, daimonUnitIds(state.settings.level, daimon));
}
/** 区分のカバー率%(習得済み/全項目)。中リングの別指標。 */
export function categoryCoveragePct(state: AppState, now: number, cat: Category): number | null {
  return coverPct(state, now, ringItemIdsFor(state.settings.level, cat));
}
/** id集合のカバー率%(読解/聴解サブ種別の別指標)。 */
export function idsCoveragePct(state: AppState, now: number, ids: string[]): number | null {
  return coverPct(state, now, ids);
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

/** 総合準備度＋公式ゲート(総合点＋区分別基準点)による合格圏判定。試験プロファイルで切替。
 *  区分別 達成度は categoryPct(知識=カバー率×習得 / 読解聴解=難易度重み正答率)で統一。
 *  セクション/総合は区分の平均(各区分等価)。 */
// 大リング【合格率】= 新モンテカルロ(面別マスタリー→大問→公式得点区分・設計書 §6)。
// 既存 state.items を大問プールで束ねて予測正答率μを作り、ladder passProbability に流す。
// 予測正答率 μ = mean( item ? itemP(effectiveP) : 0.25 )（未着手は推測下限0.25＝カバー率が自然に効く）。
// 各大問の重み n = 本番出題数(DAIMON/DOKKAI/CHOUKAI_BLUEPRINT)。1問=同じ点・大問の重み=出題数(本番準拠)。
//   ※旧実装は全大問 n=6/n=10 均等で、用法5問を文法形式13問と同格に扱う不正確があった(他計算=categoryPctは既に出題数で重み付け済)。
export function ladderPassEntries(state: AppState, now: number): DaimonExpectation[] {
  const lv = state.settings.level;
  const meanPredicted = (ids: string[]): number => {
    if (!ids.length) return 0.25;
    let s = 0;
    for (const id of ids) { const st = state.items[id]; s += st ? ladderItemP(effectiveP(st, now)) : 0.25; }
    return s / ids.length;
  };
  const skillMu = (cat: Category): number => {
    const p = categoryPct(state, now, cat, false); // 読解/聴解=観測正答率(true能力・当て推量補正済)
    return p === null ? 0.25 : ladderItemP(p / 100); // 観測正答確率へ戻す
  };
  const bp: Partial<Record<Daimon, number>> = DAIMON_BLUEPRINT[lv] ?? {};
  const sumCounts = (m: Record<string, number> | undefined): number => Object.values(m ?? {}).reduce((a, b) => a + b, 0);
  const entries: DaimonExpectation[] = [];
  // 語彙/文法の8大問=本番出題数、読解/聴解=区分合計の出題数。ラベルは得点区分ルーティング用(gengo/dokkai/choukai)。
  for (const d of MOJI_DAIMON) entries.push({ daimon: 'context', n: bp[d] ?? 0, mu: meanPredicted(daimonUnitIds(lv, d)) });
  for (const d of BUNPOU_DAIMON) entries.push({ daimon: 'grammar_form', n: bp[d] ?? 0, mu: meanPredicted(daimonUnitIds(lv, d)) });
  entries.push({ daimon: 'reading', n: sumCounts(DOKKAI_BLUEPRINT[lv]), mu: skillMu('dokkai') });
  entries.push({ daimon: 'listening', n: sumCounts(CHOUKAI_BLUEPRINT[lv]), mu: skillMu('choukai') });
  return entries;
}
function ladderPassPct(state: AppState, now: number): number {
  return Math.round(100 * ladderPassProbability(state.settings.level as LadderLevel, ladderPassEntries(state, now), 2000, 1));
}

export function readinessFor(state: AppState, now: number) {
  const prof = examOf(state.settings.targetExam);
  const evidenceTotal = Object.values(state.items).reduce((s, it) => s + it.evidence, 0);
  const catP = {} as Record<Category, number | null>;
  for (const c of RING_CATS) catP[c] = categoryPct(state, now, c, true, true); // 合格率=カバー率×習得
  // 未測定の区分数(漢字語彙/文法/読解/聴解のうち未着手)。合算セクションが測定済区分だけで高く出る問題の補正に使う。
  const unmeasuredCats = RING_CATS.filter((c) => catP[c] === null).length;
  // JFT-Basic: 単一試験・各区分足切りなし・合格は総合80%(=200/250)のみ。総合は区分の出題数で加重(各区分ほぼ均等)。
  if (prof.exam === 'jft') {
    const overallPct = wAvgPct(RING_CATS.map((c) => [catP[c], JFT_BLUEPRINT[c] ?? 1]));
    const sections: SectionInput[] = RING_CATS.map((cat) => ({ key: cat, label: cat, pct: catP[cat], minPct: prof.jftPassPct }));
    return computeReadiness(sections, overallPct, prof.jftPassPct, evidenceTotal, false, unmeasuredCats);
  }
  // JLPT: 区分→セクションは本番の出題数で加重、総合はセクション配点(sec.max=言語知識読解120/聴解60 等)で加重。
  //   ＝得意分野が実際の配点どおりに合格達成度へ反映される。
  const pm = META.passMarks[state.settings.level];
  const bp = JLPT_BLUEPRINT[state.settings.level] ?? JLPT_BLUEPRINT.N4;
  const secEntries = Object.entries(pm.sections).map(([key, sec]) => ({
    key,
    label: SECTION_LABEL[key] ?? key,
    pct: wAvgPct((SECTION_CATS[key] ?? []).map((c) => [catP[c], bp[c] ?? 1])),
    minPct: Math.round((100 * sec.min) / sec.max),
    max: sec.max,
  }));
  const overallPct = wAvgPct(secEntries.map((s) => [s.pct, s.max]));
  const sections: SectionInput[] = secEntries.map(({ max, ...s }) => s);
  const overallMinPct = Math.round((100 * pm.overall) / pm.maxTotal);
  const r = computeReadiness(sections, overallPct, overallMinPct, evidenceTotal, true, unmeasuredCats);
  // 大リング【合格率】を新モンテカルロに差し替え(設計方針=既存engineは残骸)。失敗時は既存値のまま。
  try { r.passProbability = ladderPassPct(state, now); } catch { /* fallback: computeReadiness の値 */ }
  return r;
}

/** 「覚えた語」数 = 習得度 p>=0.6 の基底項目数(語/文法は大問をまたいで1つに集約・成長カーブ用)。 */
export function learnedCount(state: AppState): number {
  const s = new Set<string>();
  for (const key in state.items) if (state.items[key].p >= 0.6) s.add(key.includes('#') ? key.slice(0, key.indexOf('#')) : key);
  return s.size;
}

/** 減衰を反映した「今」の覚えた数(基底項目で集約・リング/成長カーブと整合)。 */
export function learnedNow(state: AppState, now: number): number {
  return masteredBases(state, now).size;
}

/** 漢字/語彙/文法 のカバー率(覚えた数/全体)。レベル(JFT=N5+N4)スコープ。"量"の指標=3バー表示用。
 *  漢字は漢字1字で計測(79/166/367)。習得は語/文法がいずれかの大問で≥0.6(基底集約)。 */
export function coverageBars(state: AppState, now: number): { key: 'kanji' | 'vocab' | 'grammar'; learned: number; total: number }[] {
  const jft = (state.settings.targetExam ?? 'jlpt') === 'jft';
  const inScope = (lv: string) => (jft ? lv === 'N5' || lv === 'N4' : lv === state.settings.level);
  const mastered = masteredBases(state, now);
  const cov = (items: { id: string; level: string }[]) => {
    let learned = 0, total = 0;
    for (const it of items) {
      if (!inScope(it.level)) continue;
      total++;
      if (mastered.has(it.id)) learned++;
    }
    return { learned, total };
  };
  return [
    { key: 'kanji' as const, ...cov(KANJI.filter((k) => k.type === 'kanji').map((k) => ({ id: k.id, level: k.level }))) }, // 漢字1字(79/166/367)
    { key: 'vocab' as const, ...cov(VOCAB) },
    { key: 'grammar' as const, ...cov(GRAMMAR) },
  ];
}

/** 区分ごとのリング下サブ。知識=「覚えた/全語」(カバー率) / 読解聴解(skill)=「解答数」(般化スキルは数えない)。 */
export function ringLearnedRatio(state: AppState, now: number): Record<Category, { learned: number; total: number; attempted: number; skill: boolean }> {
  const out = {} as Record<Category, { learned: number; total: number; attempted: number; skill: boolean }>;
  const mastered = masteredBases(state, now); const touched = touchedBases(state); // 「項目#大問」を基底idで集約
  for (const c of RING_CATS) {
    const ids = examItemIds(state, c, false);
    let learned = 0, attempted = 0;
    for (const id of ids) {
      if (touched.has(id)) attempted++;
      if (mastered.has(id)) learned++;
    }
    out[c] = { learned, total: ids.length, attempted, skill: SKILL_CATS.includes(c) };
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

/** 「このペースであと◯日で合格圏」の目安。perDay=語/日 と整合するよう、知識(語彙/文法)の
 *  カバー率不足を「あと何語」で見積もる(読解/聴解は練習で別途上がる般化スキル=語数換算しない)。
 *  目標カバー率=合格に要する総合%(JLPT=META由来 / JFT=80)。JLPT/JFT両対応。 */
export function pacePrediction(state: AppState, now: number): PacePrediction {
  const r = readinessFor(state, now);
  if (r.passing) return { passing: true, perDay: 0, itemsNeeded: 0, daysToPass: 0 };
  const target = r.overallMinPct; // 合格に要する総合% を 知識カバー率の当面目標に
  let needed = 0;
  for (const cat of ['moji_goi', 'bunpou'] as Category[]) {
    const ids = examItemIds(state, cat, false);
    if (!ids.length) continue;
    let sum = 0;
    for (const id of ids) { const st = state.items[id]; if (st) sum += effectiveP(st, now); }
    const pct = (100 * sum) / ids.length;
    if (pct < target) needed += Math.ceil(((target - pct) / 100) * ids.length);
  }
  const studyDays = state.streak.history.length;
  const perDay = studyDays > 0 ? learnedNow(state, now) / studyDays : 0;
  const daysToPass = needed > 0 && perDay > 0 ? Math.ceil(needed / perDay) : perDay > 0 ? 0 : null;
  return { passing: false, perDay: Math.round(perDay * 10) / 10, itemsNeeded: needed, daysToPass };
}

const NBA_MAP: Record<Category, { label: string; route: 'Flashcard' | 'Quiz' | 'Reading' | 'Listening' }> = {
  moji_goi: { label: '漢字・語彙', route: 'Flashcard' },
  bunpou: { label: '文法', route: 'Quiz' }, // 文法は大問フロー(学習→四択)へ。旧Grammar画面は廃止。
  dokkai: { label: '読解', route: 'Reading' },
  choukai: { label: '聴解', route: 'Listening' },
};

export interface NextAction {
  category: Category;
  route: 'Flashcard' | 'Quiz' | 'Reading' | 'Listening';
  daimon?: Daimon;                        // route==='Quiz'(文法)のとき、勧める大問
  reasonKey: string;                      // i18nキー(画面側でt()翻訳)。日本語固定をやめる。
  reasonParams?: { pct: number };
}

/** Next Best Action = いちばん弱い区分の学習を勧める。
 *  未測定の区分があれば最優先(まず触って測る)。なければ【正解率が最も低い区分】を弱点として勧める。
 *  合格圏でも弱点は勧める(=合格済でも穴を埋める)。全区分とも高(>=85)なら特になし(一般復習へ)。 */
export function nextBestAction(state: AppState, now: number): NextAction | null {
  const rings = ringsFor(state, now);
  const unmeasured = RING_CATS.find((c) => rings[c] === null);
  let target: Category;
  if (unmeasured) {
    target = unmeasured;
  } else {
    let lowest = Infinity; let t: Category = 'moji_goi';
    for (const c of RING_CATS) { const v = rings[c] ?? 0; if (v < lowest) { lowest = v; t = c; } }
    if (lowest >= 85) return null; // 全区分とも高い=特に弱点なし
    target = t;
  }
  const m = NBA_MAP[target];
  const ringPct = rings[target];
  // 文法は「弱い大問」を名指しで勧める(なければ先頭の大問)。
  const daimon = target === 'bunpou' ? daimonsWithUnits(state.settings.level, 'bunpou')[0]?.daimon : undefined;
  return ringPct === null
    ? { category: target, route: m.route, daimon, reasonKey: 'home.nba_reason_unmeasured' }
    : { category: target, route: m.route, daimon, reasonKey: 'home.nba_reason_lowest', reasonParams: { pct: ringPct } };
}

// 達成ランク(C): 級内の習得率(覚えた/全)で上がる“帯”。10段階(習得率10%刻み)。合格判定とは別軸。
const RANKS = [
  { min: 0, name: '入門' }, { min: 10, name: '初級' }, { min: 20, name: '中級' },
  { min: 30, name: '上級' }, { min: 40, name: '特級' }, { min: 50, name: '達人' },
  { min: 60, name: '師範' }, { min: 70, name: '名人' }, { min: 80, name: '王者' },
  { min: 90, name: '極み' },
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
