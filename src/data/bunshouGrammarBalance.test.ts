// 文章の文法(passage_grammar) 文法ID紐づけの番人。N4/N3「その級点カバー率≥60%」設計を機械で守る。
// 設計正本＝md/08_文章の文法.md「★N4/N3 文法ID紐づけ・カバー率リビルド(60%)」。
// 供給(生成)側の必須条件は生成プロンプトへ。ここは採用後の最終安全網＝分布(需要側の広さ)を守る。
//
// 【段階運用】現行データ(N4カバー38%/N3カバー4%・skeleton.scene未付与)は本ゲートを満たさない。
//   リビルド(pointId級ミックス是正＋各セットへ skeleton.scene 付与)が済むまで RUN_BALANCE=false で skip。
//   構造・pointId解決・4択・空所対応・N5=2文は既存 src/data/exam/passageGrammar.test.ts が常時ガード。
//   ここは「文法IDの紐づけを広く・偏りなく」を足すだけ。骨組みの思想は joho*/skeletonBalance と同じ。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import grammar from './shared/grammar.json';
import metricExcluded from './exam/metricExcludedPoints.json';

// ---- パラメータ(md/08_文章の文法.md と一致させること) --------------------------
const LEVELS = ['N4', 'N3'] as const; // 60%カバー対象。N5は現状維持で非対象(公式もんだい3=2文章・別設計)。
const COVERAGE_MIN = 0.6;             // その級点の ユニーク当該級点 ÷ 総点 ≥60%
const MIX_MIN_OWN = 3;               // 各セット、その級点(n4-g/n3-g)の空所 ≥3/5(残り2は接続語・下位級可)
const CONC_MAX = 3;                  // 同一pointId の出題上限(厚みより広さ・重複集中を止める)
const SCENE_MONO_MAX = 0.2;         // 最頻話題 ≤20%(情報検索と同強度)
const SCENE_MIN_KINDS = 8;          // 話題は最低8系統(生活/学校/仕事/地域/手紙/案内/意見…)
const BAND: Record<string, [number, number]> = { N4: [340, 460], N3: [380, 500] }; // 実質字数(ルビ・【n】・空白除く)

// リビルド(pointId級ミックス是正＋skeleton.scene付与)が済んだら true にして恒久ガードを起こす。
const RUN_BALANCE = false; // 2026-08-21: リビルド前。現行N4/N3は未達ゆえ skip(build緑維持)。

// ---- 参照データ -------------------------------------------------------------
const DIR = fileURLToPath(new URL('../../content/problems/bunpou/', import.meta.url));
const levelOf = new Map((grammar as { id: string; level: string }[]).map((g) => [g.id, g.level]));
const EXCL = new Set(metricExcluded as string[]);
// 級総点(指標対象外点は母数から除外＝coverageBars/metricExclude と整合)
const totalPoints: Record<string, number> = {};
for (const g of grammar as { id: string; level: string }[]) {
  if (EXCL.has(g.id)) continue;
  totalPoints[g.level] = (totalPoints[g.level] ?? 0) + 1;
}

type Q = { id: string; blankNo: number; choices: string[]; answerIndex: number; pointId: string };
type Set_ = { id: string; level: string; passages: { body: string }[]; questions: Q[]; skeleton?: { scene?: string } };
function load(level: string): Set_[] {
  return JSON.parse(readFileSync(DIR + `passage_grammar_${level}.json`, 'utf8')).items as Set_[];
}
function effChars(s: Set_): number {
  const body = s.passages.map((p) => p.body).join('');
  return body.replace(/（[^）]*）/g, '').replace(/【[^】]*】/g, '').replace(/\s/g, '').length;
}
function ownLevelPoints(s: Set_, level: string): string[] {
  // その級点(=pointId の級 === level)かつ指標対象外でない pointId
  return s.questions.map((q) => q.pointId).filter((p) => levelOf.get(p) === level && !EXCL.has(p));
}

const opt = { skip: RUN_BALANCE ? false : 'リビルド後に有効化(md/08_文章の文法.md)' } as const;

test('カバー率: その級点のユニーク数 ÷ 級総点 ≥60%', opt, () => {
  for (const level of LEVELS) {
    const covered = new Set<string>();
    for (const s of load(level)) for (const p of ownLevelPoints(s, level)) covered.add(p);
    const rate = covered.size / totalPoints[level];
    assert.ok(rate >= COVERAGE_MIN, `${level} カバー ${covered.size}/${totalPoints[level]}=${Math.round(rate * 100)}% < ${COVERAGE_MIN * 100}%`);
  }
});

test('級ミックス: 各セット その級点の空所 ≥3/5', opt, () => {
  for (const level of LEVELS) {
    const bad = load(level).filter((s) => ownLevelPoints(s, level).length < MIX_MIN_OWN).map((s) => s.id);
    assert.equal(bad.length, 0, `${level} 級点<${MIX_MIN_OWN}のセット: ${bad.slice(0, 5).join(',')}`);
  }
});

test('集中上限: 同一の当該級点 ≤3回(広くカバー・下位級/接続語の穴埋めは対象外)', opt, () => {
  for (const level of LEVELS) {
    const c = new Map<string, number>();
    // capは「その級の指標点」だけに掛ける。接続語や下位級の穴埋め(つなぎ)は自然に何度も出るので数えない。
    for (const s of load(level)) for (const p of ownLevelPoints(s, level)) c.set(p, (c.get(p) ?? 0) + 1);
    const over = [...c.entries()].filter(([, n]) => n > CONC_MAX);
    assert.equal(over.length, 0, `${level} 集中>${CONC_MAX}: ${over.slice(0, 5).map(([p, n]) => `${p}=${n}`).join(', ')}`);
  }
});

test('字数が級別帯内(ルビ・【n】・空白除く)', opt, () => {
  for (const level of LEVELS) {
    const [lo, hi] = BAND[level];
    const bad = load(level).map((s) => [s.id, effChars(s)] as const).filter(([, n]) => n < lo || n > hi);
    assert.equal(bad.length, 0, `${level} 字数帯外[${lo}-${hi}]: ${bad.slice(0, 5).map(([i, n]) => `${i}=${n}`).join(', ')}`);
  }
});

test('場面多様性: 全セットに skeleton.scene・最頻≤20%・≥8系統', opt, () => {
  for (const level of LEVELS) {
    const items = load(level);
    const miss = items.filter((s) => !s.skeleton?.scene).map((s) => s.id);
    assert.equal(miss.length, 0, `${level} skeleton.scene 未付与: ${miss.slice(0, 5).join(',')}`);
    const c = new Map<string, number>();
    for (const s of items) { const v = s.skeleton!.scene!; c.set(v, (c.get(v) ?? 0) + 1); }
    const [top, cnt] = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
    assert.ok(cnt / items.length <= SCENE_MONO_MAX, `${level} 場面偏り『${top}』${Math.round((cnt / items.length) * 100)}%>${SCENE_MONO_MAX * 100}%`);
    assert.ok(c.size >= SCENE_MIN_KINDS, `${level} 場面 ${c.size}系統<${SCENE_MIN_KINDS}`);
  }
});
