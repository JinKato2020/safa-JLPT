# Ladder Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 面別マスタリー＋SRS＋モンテカルロ合格率の**純ロジック中核**を新設する（適応ラダーの心臓＝学習効率と合格率分析）。

**Architecture:** React非依存の純TSモジュール群を `app/src/ladder/` に新設。状態は (アイテム×面) の `FacetState`。SRSが忘却減衰とスケジュールを担い、`passRate` が「予測正答率→大問→公式得点区分→モンテカルロ合格率」を出す。既存 `engine.ts` は触らず並存（配線と撤去は後続プラン）。

**Tech Stack:** TypeScript (strict), Node 組込テストランナー (`node --import tsx --test`), tsx。乱数は**シード付きPRNG**でテスト決定論を担保。

## Global Constraints

- 純TS・**React/Expo importを一切しない**（単体テスト可能に保つ）。
- テストは `node --import tsx --test <file>`。**新規 `*.test.ts` は必ず `app/package.json` の `test` スクリプトの引数リストに追記**する（自動検出されない）。
- `npm run tsc`（= `tsc --noEmit`）が通ること。
- 面モデル・得点区分は設計書 `docs/superpowers/specs/2026-07-10-adaptive-ladder-design.md` §1/§6 準拠。
- 公式得点区分（verbatim）: **N1/N2/N3** = 言語知識(語彙漢字+文法) 0–60・基準19 / 読解 0–60・基準19 / 聴解 0–60・基準19、総合 N3≥95・N2≥90・N1≥100。 **N4/N5** = 言語知識+読解 0–120・基準38 / 聴解 0–60・基準19、総合 N4≥90・N5≥80。
- **文法の独立基準点は作らない**（言語知識に合算）。
- 推測下限 `GUESS_FLOOR = 0.25`（4択。大問ごとに選択肢数で上書き可）。
- モンテカルロ既定 `MC_DRAWS = 2000`。受容済しきい値 `RECEIVED_INTERVAL_DAYS = 7`。

---

## File Structure

- `app/src/ladder/facets.ts` — Level/大問/得点区分の型と定数、レベル別区分仕様、大問→区分マップ。
- `app/src/ladder/mastery.ts` — `FacetState`、減衰 `effectiveM`、`updateMastery`、段 `stageOf`。
- `app/src/ladder/srs.ts` — SM-2系スケジュール、`isReceived`、`selectByForgetting`。
- `app/src/ladder/coverage.ts` — 受容済カバー率。
- `app/src/ladder/rng.ts` — シード付きPRNG（mulberry32）。
- `app/src/ladder/passRate.ts` — 予測正答率→大問期待→モンテカルロ合格率。
- 各 `*.test.ts` を同ディレクトリに。

---

## Task 1: Facets & Level Specs

**Files:**
- Create: `app/src/ladder/facets.ts`
- Test: `app/src/ladder/facets.test.ts`

**Interfaces:**
- Produces:
  - `type Level = 'N5'|'N4'|'N3'|'N2'|'N1'`
  - `interface ScoringSection { key: string; max: number; minPoint: number }`
  - `interface LevelSpec { level: Level; sections: ScoringSection[]; passTotal: number }`
  - `const LEVEL_SPECS: Record<Level, LevelSpec>`
  - `function scoringSectionForDaimon(level: Level, daimon: string): string` — 大問キー→得点区分キー
  - 大問キー: `'kanji_reading'|'orthography'|'context'|'synonym'|'usage'|'word_formation'|'grammar_form'|'sentence_order'|'passage_grammar'|'reading'|'listening'`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/ladder/facets.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_SPECS, scoringSectionForDaimon } from './facets.ts';

test('N3 has 3 scoring sections with min 19 and pass total 95', () => {
  const s = LEVEL_SPECS.N3;
  assert.equal(s.sections.length, 3);
  assert.equal(s.passTotal, 95);
  for (const sec of s.sections) assert.equal(sec.minPoint, 19);
  assert.deepEqual(s.sections.map(x => x.key).sort(), ['choukai', 'dokkai', 'gengo']);
});

test('N5 merges reading into gengo: 2 sections, gengo max 120 min 38', () => {
  const s = LEVEL_SPECS.N5;
  assert.equal(s.sections.length, 2);
  assert.equal(s.passTotal, 80);
  const gengo = s.sections.find(x => x.key === 'gengo')!;
  assert.equal(gengo.max, 120);
  assert.equal(gengo.minPoint, 38);
});

test('grammar_form maps to gengo (not a separate section) at every level', () => {
  assert.equal(scoringSectionForDaimon('N3', 'grammar_form'), 'gengo');
  assert.equal(scoringSectionForDaimon('N5', 'grammar_form'), 'gengo');
});

test('reading maps to dokkai at N3 but to gengo at N5', () => {
  assert.equal(scoringSectionForDaimon('N3', 'reading'), 'dokkai');
  assert.equal(scoringSectionForDaimon('N5', 'reading'), 'gengo');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --import tsx --test src/ladder/facets.test.ts`
Expected: FAIL — cannot find module `./facets.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/ladder/facets.ts
// 面/大問/公式得点区分の定義。設計書 §1.2, §6.2 準拠。React非依存。
export type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface ScoringSection { key: string; max: number; minPoint: number }
export interface LevelSpec { level: Level; sections: ScoringSection[]; passTotal: number }

// N1/N2/N3: 3区分(言語知識/読解/聴解 各0-60・基準19)。N4/N5: 2区分(言語知識+読解 0-120・基準38 / 聴解 0-60・基準19)。
const THREE = (passTotal: number): ScoringSection[] => [
  { key: 'gengo', max: 60, minPoint: 19 },
  { key: 'dokkai', max: 60, minPoint: 19 },
  { key: 'choukai', max: 60, minPoint: 19 },
];
const TWO = (): ScoringSection[] => [
  { key: 'gengo', max: 120, minPoint: 38 }, // 言語知識+読解を合算
  { key: 'choukai', max: 60, minPoint: 19 },
];

export const LEVEL_SPECS: Record<Level, LevelSpec> = {
  N1: { level: 'N1', sections: THREE(100), passTotal: 100 },
  N2: { level: 'N2', sections: THREE(90), passTotal: 90 },
  N3: { level: 'N3', sections: THREE(95), passTotal: 95 },
  N4: { level: 'N4', sections: TWO(), passTotal: 90 },
  N5: { level: 'N5', sections: TWO(), passTotal: 80 },
};

// 大問キー(小リング) → 得点区分キー。読解は N4/N5 で gengo に合算される。
const GENGO_DAIMON = new Set([
  'kanji_reading', 'orthography', 'context', 'synonym', 'usage', 'word_formation',
  'grammar_form', 'sentence_order', 'passage_grammar',
]);

export function scoringSectionForDaimon(level: Level, daimon: string): string {
  if (daimon === 'listening') return 'choukai';
  if (daimon === 'reading') return level === 'N4' || level === 'N5' ? 'gengo' : 'dokkai';
  if (GENGO_DAIMON.has(daimon)) return 'gengo';
  throw new Error(`unknown daimon: ${daimon}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --import tsx --test src/ladder/facets.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/ladder/facets.ts app/src/ladder/facets.test.ts
git commit -m "feat(ladder): facet keys and official scoring-section specs"
```

---

## Task 2: Mastery State & Decay

**Files:**
- Create: `app/src/ladder/mastery.ts`
- Test: `app/src/ladder/mastery.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `const DAY = 86_400_000`
  - `type Facet = 'on'|'meaning'|'kanji_reading'|'kanji_write'|'kanji_meaning'|'g_order'|'g_meaning'` (単語タブの面キー)
  - `interface FacetState { m: number; evidence: number; updatedAt: number; reps: number; intervalDays: number; ease: number; dueAt: number }`
  - `function newFacetState(now: number): FacetState`
  - `function effectiveM(s: FacetState, now: number): number`
  - `function updateMastery(s: FacetState, outcome: number, weight: number, now: number): FacetState`
  - `type Stage = 'new'|'received'|'produced'`
  - `function stageOf(s: FacetState, now: number, producedOk: boolean): Stage`
  - `function clamp(x: number, lo: number, hi: number): number`

- [ ] **Step 1: Write the failing test**

```ts
// app/src/ladder/mastery.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFacetState, effectiveM, updateMastery, stageOf, DAY } from './mastery.ts';

test('fresh state has m=0 and stage new', () => {
  const s = newFacetState(0);
  assert.equal(s.m, 0);
  assert.equal(stageOf(s, 0, false), 'new');
});

test('correct observation raises m', () => {
  const s = updateMastery(newFacetState(0), 1, 3, 0);
  assert.ok(s.m > 0.5, `m=${s.m}`);
});

test('m decays toward floor over time', () => {
  const s = updateMastery(newFacetState(0), 1, 3, 0);
  const later = effectiveM(s, 60 * DAY);
  assert.ok(later < s.m, `later=${later} < ${s.m}`);
  assert.ok(later >= 0.1, 'never below floor');
});

test('received stage when interval >= 7 days', () => {
  const s = { ...newFacetState(0), m: 0.8, intervalDays: 7 };
  assert.equal(stageOf(s, 0, false), 'received');
  assert.equal(stageOf(s, 0, true), 'produced');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --import tsx --test src/ladder/mastery.test.ts`
Expected: FAIL — cannot find module `./mastery.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/ladder/mastery.ts
// (アイテム×面) の習得状態。減衰付き。純TS。設計書 §1.4。
export const DAY = 86_400_000;

export type Facet =
  | 'on' | 'meaning'                             // 語彙: 音 / 意
  | 'kanji_reading' | 'kanji_write' | 'kanji_meaning'  // 漢字: 聞き取り(音→字) / 書き取り / 意味
  | 'g_order' | 'g_meaning';                     // 文法: 並べ替え / 意味

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --import tsx --test src/ladder/mastery.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/ladder/mastery.ts app/src/ladder/mastery.test.ts
git commit -m "feat(ladder): facet mastery state with decay and 3-stage"
```

---

## Task 3: SRS Scheduler & Selection

**Files:**
- Create: `app/src/ladder/srs.ts`
- Test: `app/src/ladder/srs.test.ts`

**Interfaces:**
- Consumes: `FacetState`, `clamp`, `DAY`, `RECEIVED_INTERVAL_DAYS` from `./mastery.ts`.
- Produces:
  - `type Grade = 'again'|'good'|'easy'`
  - `function recordResult(s: FacetState, correct: boolean, weight: number, now: number): FacetState` — 習得度更新＋スケジュール更新の一体。
  - `function isReceived(s: FacetState): boolean`
  - `function selectByForgetting<T extends { state: FacetState }>(items: T[], now: number, limit: number): T[]` — 忘却順（due超過＋弱い順）に limit 件。

- [ ] **Step 1: Write the failing test**

```ts
// app/src/ladder/srs.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFacetState, DAY } from './mastery.ts';
import { recordResult, isReceived, selectByForgetting } from './srs.ts';

test('correct answers grow interval past received threshold', () => {
  let s = newFacetState(0);
  s = recordResult(s, true, 3, 0);            // reps1 -> 1日
  s = recordResult(s, true, 3, 1 * DAY);      // reps2 -> 6日
  s = recordResult(s, true, 3, 7 * DAY);      // reps3 -> 6*ease
  assert.ok(s.intervalDays >= 7, `interval=${s.intervalDays}`);
  assert.equal(isReceived(s), true);
});

test('wrong answer resets reps and schedules soon', () => {
  let s = recordResult(newFacetState(0), true, 3, 0);
  s = recordResult(s, false, 3, 1 * DAY);
  assert.equal(s.reps, 0);
  assert.ok(s.dueAt - 1 * DAY <= 3_600_000, 'due within an hour');
});

test('selectByForgetting returns most-overdue first, capped at limit', () => {
  const mk = (dueAt: number, m: number) => ({ state: { ...newFacetState(0), dueAt, m } });
  const items = [mk(100 * DAY, 0.9), mk(1 * DAY, 0.2), mk(5 * DAY, 0.5)];
  const out = selectByForgetting(items, 200 * DAY, 2);
  assert.equal(out.length, 2);
  assert.equal(out[0].state.dueAt, 1 * DAY); // 最も昔にdue=最優先
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --import tsx --test src/ladder/srs.test.ts`
Expected: FAIL — cannot find module `./srs.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/ladder/srs.ts
// SM-2系スケジュール＋忘却順の出題選択。設計書 §4。
import { FacetState, clamp, DAY, updateMastery, RECEIVED_INTERVAL_DAYS } from './mastery.ts';

export type Grade = 'again' | 'good' | 'easy';

function schedule(s: FacetState, correct: boolean, now: number): Pick<FacetState, 'reps'|'intervalDays'|'ease'|'dueAt'> {
  let { reps, intervalDays, ease } = s;
  if (!correct) {
    reps = 0; intervalDays = 0; ease = clamp(ease - 0.2, 1.3, 2.8);
    return { reps, intervalDays, ease, dueAt: now + 600_000 }; // 10分後=すぐ復習
  }
  if (reps === 0) intervalDays = 1;
  else if (reps === 1) intervalDays = 6;
  else intervalDays = Math.round(intervalDays * ease);
  reps += 1;
  return { reps, intervalDays, ease, dueAt: now + intervalDays * DAY };
}

// 習得度更新とスケジュール更新を一体で行う(状態は不変で新オブジェクトを返す)。
export function recordResult(s: FacetState, correct: boolean, weight: number, now: number): FacetState {
  const updated = updateMastery(s, correct ? 1 : 0, weight, now);
  return { ...updated, ...schedule(s, correct, now) };
}

export function isReceived(s: FacetState): boolean {
  return s.intervalDays >= RECEIVED_INTERVAL_DAYS;
}

// due超過が大きいほど優先。同点は弱い(m小)を優先。limit件返す。
export function selectByForgetting<T extends { state: FacetState }>(items: T[], now: number, limit: number): T[] {
  return [...items]
    .sort((a, b) => (a.state.dueAt - b.state.dueAt) || (a.state.m - b.state.m))
    .slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --import tsx --test src/ladder/srs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/ladder/srs.ts app/src/ladder/srs.test.ts
git commit -m "feat(ladder): SM-2 scheduling and forgetting-order selection"
```

---

## Task 4: Coverage (受容済カバー率)

**Files:**
- Create: `app/src/ladder/coverage.ts`
- Test: `app/src/ladder/coverage.test.ts`

**Interfaces:**
- Consumes: `FacetState`, `isReceived` (via srs). To avoid a cycle, coverage imports `isReceived` from `./srs.ts`.
- Produces:
  - `function coverageRate(inventoryCount: number, states: FacetState[]): number` — 0..1。受容済状態数 / 在庫総数（在庫0なら0）。

- [ ] **Step 1: Write the failing test**

```ts
// app/src/ladder/coverage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFacetState } from './mastery.ts';
import { coverageRate } from './coverage.ts';

test('coverage = received / inventory (A案・受容済で1台)', () => {
  const received = { ...newFacetState(0), intervalDays: 10 };
  const notYet = { ...newFacetState(0), intervalDays: 2 };
  // 在庫10・受容済2 -> 0.2
  assert.equal(coverageRate(10, [received, received, notYet]), 0.2);
});

test('empty inventory -> 0', () => {
  assert.equal(coverageRate(0, []), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --import tsx --test src/ladder/coverage.test.ts`
Expected: FAIL — cannot find module `./coverage.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/ladder/coverage.ts
// カバー率 = 受容済アイテム数 / 在庫総数(A案・設計書 §5)。両タブの正答が受容済へ到達させる。
import { FacetState } from './mastery.ts';
import { isReceived } from './srs.ts';

export function coverageRate(inventoryCount: number, states: FacetState[]): number {
  if (inventoryCount <= 0) return 0;
  let received = 0;
  for (const s of states) if (isReceived(s)) received += 1;
  return received / inventoryCount;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --import tsx --test src/ladder/coverage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/ladder/coverage.ts app/src/ladder/coverage.test.ts
git commit -m "feat(ladder): received-based coverage rate (A案)"
```

---

## Task 5: Seeded RNG

**Files:**
- Create: `app/src/ladder/rng.ts`
- Test: `app/src/ladder/rng.test.ts`

**Interfaces:**
- Produces:
  - `function mulberry32(seed: number): () => number` — 0..1 の決定論的乱数生成器。

- [ ] **Step 1: Write the failing test**

```ts
// app/src/ladder/rng.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from './rng.ts';

test('same seed -> same sequence (determinism)', () => {
  const a = mulberry32(42); const b = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test('outputs in [0,1)', () => {
  const r = mulberry32(1);
  for (let i = 0; i < 100; i++) { const x = r(); assert.ok(x >= 0 && x < 1); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --import tsx --test src/ladder/rng.test.ts`
Expected: FAIL — cannot find module `./rng.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/ladder/rng.ts
// シード付き決定論PRNG。モンテカルロのテスト再現性のため(Math.randomは使わない)。
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --import tsx --test src/ladder/rng.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/ladder/rng.ts app/src/ladder/rng.test.ts
git commit -m "feat(ladder): seeded PRNG for reproducible Monte Carlo"
```

---

## Task 6: Pass-Rate Monte Carlo

**Files:**
- Create: `app/src/ladder/passRate.ts`
- Test: `app/src/ladder/passRate.test.ts`

**Interfaces:**
- Consumes: `Level`, `LEVEL_SPECS`, `scoringSectionForDaimon` from `./facets.ts`; `mulberry32` from `./rng.ts`.
- Produces:
  - `const GUESS_FLOOR = 0.25`, `const MC_DRAWS = 2000`
  - `function itemP(m: number, floor?: number): number` — 予測正答率 = floor + (1-floor)*m。
  - `interface DaimonExpectation { daimon: string; n: number; mu: number }` — 大問キー・出題数・期待正答率(プール平均)。
  - `function passProbability(level: Level, daimons: DaimonExpectation[], draws?: number, seed?: number): number` — 0..1。全区分基準点＋総合クリアの割合。

- [ ] **Step 1: Write the failing test**

```ts
// app/src/ladder/passRate.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemP, passProbability, DaimonExpectation } from './passRate.ts';

test('itemP applies guess floor', () => {
  assert.equal(itemP(0), 0.25);
  assert.equal(itemP(1), 1);
  assert.ok(Math.abs(itemP(0.8) - 0.85) < 1e-9);
});

// N3: gengo(語彙漢字+文法)/dokkai/choukai。各大問 n=10。
function n3(muGengo: number, muDok: number, muCho: number): DaimonExpectation[] {
  return [
    { daimon: 'kanji_reading', n: 10, mu: muGengo },
    { daimon: 'grammar_form', n: 10, mu: muGengo },
    { daimon: 'reading', n: 10, mu: muDok },
    { daimon: 'listening', n: 10, mu: muCho },
  ];
}

test('deterministic with seed', () => {
  const p1 = passProbability('N3', n3(0.7, 0.6, 0.6), 2000, 123);
  const p2 = passProbability('N3', n3(0.7, 0.6, 0.6), 2000, 123);
  assert.equal(p1, p2);
});

test('higher mastery -> higher pass probability (monotonic)', () => {
  const low = passProbability('N3', n3(0.4, 0.4, 0.4), 2000, 7);
  const high = passProbability('N3', n3(0.9, 0.9, 0.9), 2000, 7);
  assert.ok(high > low, `high=${high} low=${low}`);
});

test('one section below its 基準点 crushes pass prob even if others are high', () => {
  // 聴解だけ推測下限級(0.25<19/60=0.317) -> 基準点割れでほぼ不合格
  const p = passProbability('N3', n3(0.95, 0.95, 0.25), 2000, 7);
  assert.ok(p < 0.1, `p=${p}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --import tsx --test src/ladder/passRate.test.ts`
Expected: FAIL — cannot find module `./passRate.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/ladder/passRate.ts
// 予測正答率→大問→公式得点区分→モンテカルロ合格率。設計書 §6。
import { Level, LEVEL_SPECS, scoringSectionForDaimon } from './facets.ts';
import { mulberry32 } from './rng.ts';

export const GUESS_FLOOR = 0.25;
export const MC_DRAWS = 2000;

export function itemP(m: number, floor: number = GUESS_FLOOR): number {
  return floor + (1 - floor) * m;
}

export interface DaimonExpectation { daimon: string; n: number; mu: number }

// n回のベルヌーイ(mu)の和 = その大問の正答数。
function drawCorrect(rng: () => number, n: number, mu: number): number {
  let c = 0;
  for (let i = 0; i < n; i++) if (rng() < mu) c += 1;
  return c;
}

// 全区分が基準点以上 かつ 総合が合格ライン以上 になる割合(=合格率)。
export function passProbability(level: Level, daimons: DaimonExpectation[], draws: number = MC_DRAWS, seed: number = 1): number {
  const spec = LEVEL_SPECS[level];
  const rng = mulberry32(seed);
  const secByKey = new Map(spec.sections.map(s => [s.key, s]));
  let passes = 0;

  for (let d = 0; d < draws; d++) {
    // 区分ごとに (正答数, 出題数) を集計
    const acc = new Map<string, { correct: number; n: number }>();
    for (const dm of daimons) {
      const key = scoringSectionForDaimon(level, dm.daimon);
      const c = drawCorrect(rng, dm.n, dm.mu);
      const a = acc.get(key) ?? { correct: 0, n: 0 };
      a.correct += c; a.n += dm.n; acc.set(key, a);
    }
    // 区分点(0..max)へ換算し、基準点ゲート＋総合を判定
    let total = 0; let allGates = true;
    for (const sec of spec.sections) {
      const a = acc.get(sec.key);
      const frac = a && a.n > 0 ? a.correct / a.n : 0;
      const score = frac * sec.max;
      if (score < sec.minPoint) { allGates = false; }
      total += score;
    }
    if (allGates && total >= spec.passTotal) passes += 1;
  }
  return passes / draws;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --import tsx --test src/ladder/passRate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/ladder/passRate.ts app/src/ladder/passRate.test.ts
git commit -m "feat(ladder): Monte Carlo pass probability over official sections"
```

---

## Task 7: Wire Test Script & Full Verify

**Files:**
- Modify: `app/package.json:12` (test スクリプトへ6ファイル追記)

- [ ] **Step 1: Add the new test files to the `test` script**

`app/package.json` の `"test"` の末尾（`src/words/sections.test.ts` の後）に、スペース区切りで追記:

```
src/ladder/facets.test.ts src/ladder/mastery.test.ts src/ladder/srs.test.ts src/ladder/coverage.test.ts src/ladder/rng.test.ts src/ladder/passRate.test.ts
```

- [ ] **Step 2: Run the full test suite**

Run: `cd app && npm test`
Expected: PASS（既存テスト＋ladderの新テストが全て緑）。

- [ ] **Step 3: Typecheck**

Run: `cd app && npm run tsc`
Expected: エラーなし（exit 0）。

- [ ] **Step 4: Commit**

```bash
git add app/package.json
git commit -m "test(ladder): register ladder engine tests in test script"
```

---

## Self-Review

**Spec coverage (この中核プランの範囲):**
- §1.4 面別マスタリー・減衰・3段 → Task 2 ✓
- §4 SRS忘却モデル・出題選択 → Task 3 ✓
- §5 カバー率(受容済/A案) → Task 4 ✓
- §6.1 予測正答率 p=floor+(1-floor)×m → Task 6 (itemP) ✓
- §6.1 モンテカルロ合格率 → Task 6 ✓
- §6.2 公式得点区分(レベル別・文法独立基準点なし) → Task 1 + Task 6 ✓
- **後続プランに委譲**（この中核の範囲外）: 実バンク/在庫からの μ・states 供給と大問プール構築（Plan②）、リング/称号表示（Plan③）、学習/単語タブUI（Plan④⑤）、`engine.ts` の撤去と配線。

**Placeholder scan:** なし（全ステップに実コード）。

**Type consistency:** `FacetState`/`effectiveM`/`updateMastery`（Task2）→ `recordResult`/`isReceived`（Task3）→ `coverageRate`（Task4）→ `DaimonExpectation`/`passProbability`（Task6）で名称・シグネチャ一致。`Level`/`LEVEL_SPECS`/`scoringSectionForDaimon`（Task1）を Task6 が使用。循環回避: coverage は srs から `isReceived` のみ import。

---

## 後続プラン（このリポジトリで順に作成予定）
- **Plan②** データ整備＆プロバイダ: 漢字スコープ/明快字/bound字リスト、文法タグ付け、一意並べ替え句抽出、distractor生成、LearnTab/WordTab問題供給、μ/states供給。
- **Plan③** リング/カバー率ViewModel＋ホーム配線＋称号、`computeReadiness` 利用箇所の置換。
- **Plan④** 学習タブUI（自動出題キュー・2モード・バランス学習ボタン削除）。
- **Plan⑤** 単語タブUI（カード別「学習→問題」・書き取り・かなタイル産出・完全並べ替え）。
