// SNS用モック画像のためのダミー AppState 生成（実データ・実エンジンの型で作る＝実画面がそのまま believable に描画される）。
// 実行: node --import tsx tools/sns/gen_state.ts
// 出力: tools/sns/passing.json（合格圏内N4） / tools/sns/beginner.json（始めたてN5）
//   → Webデモ(?snsdemo=…)が localStorage に読み込んで AICoach を描く。数字は全言語共通（言語だけ差し替え）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_STATE, STATE_VERSION, dayStr, type AppState, type MockResult, type GrowthPoint } from '../../src/store/state';
import { KANJI, VOCAB, GRAMMAR, allItemIdsFor } from '../../src/data';
import { MOJI_DAIMON, BUNPOU_DAIMON, daimonUnitIds } from '../../src/data/daimon';
import { newItemState, recordQuiz, type ItemState } from '../../src/engine/engine';
import type { Facet } from '../../src/review/facetMap';
import { expectedScoreFor, coverageBars } from '../../src/store/selectors';
import { homeStatus } from '../../src/home/homeStatus';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOW = Date.now();
const DAY = 86_400_000;
const strong = (): ItemState => recordQuiz(newItemState(NOW), true, NOW); // p≈1（facetEffectiveP≥0.6=覚えた）
const wrong = (): ItemState => { let s = newItemState(NOW); for (let i = 0; i < 3; i++) s = recordQuiz(s, false, NOW); return s; }; // p低（当て推量補正で≈0%）

/** 決定的に「先頭 frac 割」を採用（乱数を使わず再現可能）。 */
const take = <T>(arr: T[], frac: number): T[] => arr.slice(0, Math.floor(arr.length * frac));
/** 決定的に ratio 割を正答・残りを誤答（index基準で再現可能）。ratio=1で全問正解、0で全問誤答。 */
const mixItems = (ids: string[], frac: number, ratio: number, items: Record<string, ItemState>) => {
  const sel = take(ids, frac);
  sel.forEach((id, i) => { items[id] = (i % 100) < Math.round(ratio * 100) ? strong() : wrong(); });
};

type Slice = Record<string, Partial<Record<Facet, ItemState>>>;

// covFrac=カバー率（覚えた割合＝mastery強）／skillFrac=読解聴解で解いた割合／ratio=解いた問題の正答率。
// 予想得点＝知識(gengo)はcovFrac、読解聴解はratioで効く。値をいじって予想得点を狙い撃ちする。
function buildState(level: 'N5' | 'N4', covFrac: number, skillFrac: number, ratio: number): AppState {
  const mastery: Slice = {};
  for (const k of take(KANJI.filter((k) => k.type === 'kanji' && k.level === level), covFrac)) {
    mastery[k.char] = { read: strong(), mean: strong(), listen: strong(), form: strong() };
  }
  for (const v of take(VOCAB.filter((v) => v.level === level), covFrac)) {
    mastery[v.id] = { mean: strong(), read: strong(), write: strong(), listen: strong() };
  }
  for (const g of take(GRAMMAR.filter((g) => g.level === level), covFrac)) {
    mastery[g.id] = { grammar: strong() };
  }
  // items（解いた設問）＝「分野別の正解率」レーダー(pctOfIds)＋読解聴解の予想得点の源。ratio で正答率を作る。
  const items: Record<string, ItemState> = {};
  for (const d of [...MOJI_DAIMON, ...BUNPOU_DAIMON]) mixItems(daimonUnitIds(level, d), covFrac, ratio, items);
  for (const cat of ['dokkai', 'choukai'] as const) mixItems(allItemIdsFor(level, cat), skillFrac, ratio, items);

  const state: AppState = {
    ...INITIAL_STATE,
    version: STATE_VERSION,
    settings: { ...INITIAL_STATE.settings, level, targetExam: 'jlpt', onboarded: true, uiLang: 'ja', theme: 'light', font: 'maru' },
    items,
    mastery,
    masteryMigrated: true,
    studySeconds: Math.round(covFrac * 120 * 3600), // 学習時間（それらしく）
  };

  // カバー率（覚えた語数）を確定 → 成長カーブ（直近14日・累計が右肩上がり）
  const cov = coverageBars(state, NOW);
  const cw = cov.reduce((o, b) => ({ ...o, [b.key]: b.learned }), {} as Record<string, number>);
  const totalLearned = (cw.kanji ?? 0) + (cw.vocab ?? 0) + (cw.grammar ?? 0);
  const growth: GrowthPoint[] = [];
  for (let i = 0; i < 14; i++) {
    const r = 0.45 + 0.55 * (i / 13); // 45%→100%
    growth.push({
      day: dayStr(NOW - (13 - i) * DAY),
      learned: Math.round(totalLearned * r),
      cov: { kanji: Math.round((cw.kanji ?? 0) * r), vocab: Math.round((cw.vocab ?? 0) * r), grammar: Math.round((cw.grammar ?? 0) * r) },
    });
  }
  state.growth = growth;

  // 予想得点（客観）
  const est = expectedScoreFor(state, NOW);
  // 模試の記録（est.score へ右肩上がり・最新=est.score）。区分別は est.sections を流用。
  const seq = [0.78, 0.86, 0.93, 1.0];
  const mockHistory: MockResult[] = seq.map((r, i) => {
    const ts = NOW - (seq.length - 1 - i) * 6 * DAY;
    const ps = Math.round(est.score * r);
    return {
      ts, day: dayStr(ts), pct: Math.round((ps / est.max) * 100), correct: Math.round((ps / est.max) * 60), total: 60, full: true,
      level, predScore: ps, predMax: est.max, passTotal: est.passTotal,
      sections: est.sections.map((s) => ({ key: s.key, score: s.score, max: s.max, min: s.minPoint, below: s.score < s.minPoint })),
    };
  });
  state.mockHistory = mockHistory;

  // 連続記録（学習日）
  const history: string[] = [];
  for (let i = 0; i < 14; i++) history.push(dayStr(NOW - i * DAY));
  state.streak = { current: 14, longest: 21, lastStudyDay: dayStr(NOW), freezes: 2, history };

  return state;
}

function report(tag: string, s: AppState) {
  const est = expectedScoreFor(s, NOW);
  const cov = coverageBars(s, NOW);
  const st = homeStatus(s, NOW);
  const covStr = cov.map((b) => `${b.key} ${b.learned}/${b.total}`).join(' / ');
  console.log(`[${tag}] level=${s.settings.level} 予想得点=${est.score}/${est.max}（合格ライン${est.passTotal}） homeStatus.predScore=${st.predScore} カバー率: ${covStr}`);
  console.log(`  区分別: ${est.sections.map((x) => `${x.key} ${x.score}/${x.max}(基準${x.minPoint})`).join(' / ')}`);
}

const passing = buildState('N4', 0.50, 0.60, 0.70);
const beginner = buildState('N5', 0.14, 0.30, 0.10);
report('passing', passing);
report('beginner', beginner);

fs.writeFileSync(path.join(__dirname, 'passing.json'), JSON.stringify(passing));
fs.writeFileSync(path.join(__dirname, 'beginner.json'), JSON.stringify(beginner));
console.log('\n書き出し: tools/sns/passing.json, tools/sns/beginner.json');
