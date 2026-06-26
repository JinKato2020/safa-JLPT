// ストア状態 → JLPTエンジンへの橋渡し(派生値)。UI はこれを useMemo で呼ぶ。
import { computeReadiness, effectiveP, type Category, type SectionInput } from '../engine/engine';
import { examOf } from '../engine/examProfile';
import { ringItemIdsFor, allItemIdsFor, jftItemIdsFor, allJftItemIdsFor, JFT_BANDS, META } from '../data';
import { JLPT_BLUEPRINT, JFT_BLUEPRINT } from '../data/examBlueprint';
import type { AppState, GrowthPoint } from './state';
import { lastNDays } from './state';

const RING_CATS: Category[] = ['moji_goi', 'bunpou', 'dokkai', 'choukai'];

// 試験プロファイルに応じた項目id集合。JLPT=選択級 / JFT=N5+N4(A1+A2)統合スコープ。
// full=true: 学習＋模試(到達度/合格分母) / false: 学習集合(小リング分母)。
function examItemIds(state: AppState, category: Category, full: boolean): string[] {
  if ((state.settings.targetExam ?? 'jlpt') === 'jft') return full ? allJftItemIdsFor(category) : jftItemIdsFor(category);
  return full ? allItemIdsFor(state.settings.level, category) : ringItemIdsFor(state.settings.level, category);
}

// スキル(読解/聴解)の難易度重み: 難問の正解ほど能力を強く示す。帯(A1/A2.1/A2.2)優先、無ければ級から。
function skillWeight(id: string): number {
  const b = JFT_BANDS[id];
  if (b) return b === 'A2.2' ? 1.6 : b === 'A2.1' ? 1.3 : 1;
  return id.startsWith('n3') ? 1.7 : id.startsWith('n4') ? 1.3 : 1;
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
// 区分の達成度＝【純粋な正解率】(全区分で統一: 漢字語彙/文法/読解/聴解)。
// 解いた項目だけ・難易度重み・偶然レベルへprior収縮・当て推量補正。母数(全項目)は無視＝カバー率(覚えた量)とは別軸。
function categoryPct(state: AppState, now: number, cat: Category, full: boolean): number | null {
  const ids = examItemIds(state, cat, full);
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
export function readinessFor(state: AppState, now: number) {
  const prof = examOf(state.settings.targetExam);
  const evidenceTotal = Object.values(state.items).reduce((s, it) => s + it.evidence, 0);
  const catP = {} as Record<Category, number | null>;
  for (const c of RING_CATS) catP[c] = categoryPct(state, now, c, true);
  // JFT-Basic: 単一試験・各区分足切りなし・合格は総合80%(=200/250)のみ。総合は区分の出題数で加重(各区分ほぼ均等)。
  if (prof.exam === 'jft') {
    const overallPct = wAvgPct(RING_CATS.map((c) => [catP[c], JFT_BLUEPRINT[c] ?? 1]));
    const sections: SectionInput[] = RING_CATS.map((cat) => ({ key: cat, label: cat, pct: catP[cat], minPct: prof.jftPassPct }));
    return computeReadiness(sections, overallPct, prof.jftPassPct, evidenceTotal, false);
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

/** 区分ごとのリング下サブ。知識=「覚えた/全語」(カバー率) / 読解聴解(skill)=「解答数」(般化スキルは数えない)。 */
export function ringLearnedRatio(state: AppState, now: number): Record<Category, { learned: number; total: number; attempted: number; skill: boolean }> {
  const out = {} as Record<Category, { learned: number; total: number; attempted: number; skill: boolean }>;
  for (const c of RING_CATS) {
    const ids = examItemIds(state, c, false);
    let learned = 0, attempted = 0;
    for (const id of ids) {
      const st = state.items[id];
      if (!st) continue;
      attempted++;
      if (effectiveP(st, now) >= 0.6) learned++;
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
  const reason = ringPct === null ? 'まだ未測定の区分' : `いちばん低い区分（正解率 ${ringPct}%）`;
  return { category: target, label: m.label, route: m.route, reason };
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
