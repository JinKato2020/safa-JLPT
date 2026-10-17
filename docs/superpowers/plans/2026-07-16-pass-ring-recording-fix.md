# 合格リング 記録・級解決の恒久修正 実装計画（Plan A・中核）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development（推奨）または superpowers:executing-plans でタスク単位に実装。手順は checkbox（`- [ ]`）で追跡。

**Goal:** 用法の `usg-` ID（および将来の模試 `mk-`）が、合格リングで**正しい級で重み付けされ・模試では初見のときだけ記録される**ようにし、`usg-` 化で red になった旧スナップショット系テストを**実態に更新**して全テストを緑にする。

**Architecture:** ランタイムの2箇所（`selectors.ts` の `skillWeight` 級解決、`store.tsx` の `MOCK_ANSWER` 記録分岐）を、ID接頭辞 `startsWith('kb-')` 依存から **データ由来判定（`bankLevelOf`）・初見判定（`!state.items[id]`）** に一般化。旧テスト（`bankId`/`kbIds`/`saveRef`）は用法厳選削減後の実態へ更新。習得度更新（`updateMastery`）・カバー率（`knowledgeDaimonPct`）・重み（practice=3/mock=5）は**現行のまま変更しない**（設計書A確定：割引なし・事前値なし）。

**Tech Stack:** TypeScript / React Native（Expo）/ `node --import tsx --test`。

## Global Constraints
- **反復割引なし・事前値なし**：`engine.ts updateMastery` は一切変更しない（設計書A・ユーザー確定2026-07-16）。
- **重みは現行**：`SIGNAL_WEIGHT.practice=3 / mock=5`（変更しない）。単語タブは QUIZ_ANSWER 経由で既に practice=3。
- **本計画の非目標（別計画・要設計判断）**：単語タブ→大問"面"の対応表（設計書A §3.5 未決）／`ladderPassPct` の evidence 加重（§3.2）／±への単語タブ寄与係数（§3.6）。**これらは本計画に含めない**。
- 既存の公開挙動（練習 QUIZ_ANSWER の記録、リング表示）は変えない。

---

### Task 1: skillWeight の級解決を bankLevelOf 優先に（usg-/mk- を正しい級へ）

**Files:**
- Modify: `src/store/selectors.ts:23-36`（`skillWeight`。テスト用に `export` を付与）
- Test: `src/store/skillWeight.test.ts`（新規）

**Interfaces:**
- Consumes: `bankLevelOf(id: string): string | undefined`（`../data/daimon` から既存 import 済み）
- Produces: `export function skillWeight(id: string): number`

- [ ] **Step 1: 失敗するテストを書く** — `src/store/skillWeight.test.ts`
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillWeight } from './selectors';
import { bankLevelOf } from '../data/daimon';

test('前提: 用法バンクidの級はデータから引ける', () => {
  assert.equal(bankLevelOf('usg3-001'), 'N3');
  assert.equal(bankLevelOf('usg4-001'), 'N4');
});

test('skillWeight: usg-(用法)は接頭辞でなくデータの級で重み付け(N3=1.7 / N4=1.3)', () => {
  // VOCAB_FREQ に usg- は無い→頻度補正mod=1。base だけが出る。
  assert.equal(skillWeight('usg3-001'), 1.7); // N3 base
  assert.equal(skillWeight('usg4-001'), 1.3); // N4 base
});

test('skillWeight: kb-(既存バンク)も従来どおりデータの級で重み付け', () => {
  const lv = bankLevelOf('kb-000421'); // N4（bankId.testで実在確認済）
  assert.equal(lv, 'N4');
  assert.equal(skillWeight('kb-000421'), 1.3);
});
```

- [ ] **Step 2: 失敗を確認** — Run: `node --import tsx --test src/store/skillWeight.test.ts`
  Expected: FAIL（`skillWeight` が未export → import エラー、または usg- が 1.0 を返す）

- [ ] **Step 3: 実装** — `selectors.ts` の `skillWeight` を `export` にし、級解決を差し替え：
```ts
export function skillWeight(id: string): number {
  const b = JFT_BANDS[id];
  if (b) return b === 'A2.2' ? 1.6 : b === 'A2.1' ? 1.3 : 1;
  // 級(難易度の基軸)。バンクid(kb-/usg-/mk- いずれもデータから級を逆引き) と 語id(n3-v-123#…)の両対応。
  let level = 'N5';
  const bl = bankLevelOf(id);
  if (bl) level = bl;
  else { const p = id.slice(0, 2).toLowerCase(); if (p === 'n3' || p === 'n4' || p === 'n5') level = p.toUpperCase(); }
  const base = level === 'N3' ? 1.7 : level === 'N4' ? 1.3 : 1;
  const vid = id.includes('#') ? id.slice(0, id.indexOf('#')) : id;
  const f = VOCAB_FREQ[vid];
  const mod = typeof f === 'number' ? 0.8 + 0.5 * Math.sqrt(Math.min(Math.max(f, 1), 50) / 50) : 1;
  return base * mod;
}
```

- [ ] **Step 4: テストが通ることを確認** — Run: `node --import tsx --test src/store/skillWeight.test.ts` → PASS

- [ ] **Step 5: 型チェック** — Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 6: commit**
```bash
git add src/store/selectors.ts src/store/skillWeight.test.ts
git commit -m "fix(ring): skillWeight は級を bankLevelOf で解決(usg-/mk-をN5誤読しない)"
```

---

### Task 2: MOCK_ANSWER を「初見のときだけ記録」に統一（usg-不整合の恒久修正）

**Files:**
- Modify: `src/store/store.tsx:55`（`reducer` に `export` 付与）, `:66-73`（`MOCK_ANSWER` 分岐）
- Test: `src/store/mockAnswer.test.ts`（新規）

**Interfaces:**
- Consumes: `newItemState`, `recordMock`, `effectiveP`（`../engine/engine`・既存 import）, `withStudyDay`（同ファイル内）
- Produces: `export function reducer(state: AppState, action: Action): AppState`

**背景**: 現行は `startsWith('kb-')` の台帳項目のみ模試evidenceから除外。用法(usg-)は接頭辞を外れ**兄弟(kb-)と不整合**。新方針（設計書A §3.4/§3.5）＝**模試は初見(state.itemsに無い)のときだけ w=5 で記録／既出は学習日のみ**。台帳/非台帳を問わず統一。

- [ ] **Step 1: 失敗するテストを書く** — `src/store/mockAnswer.test.ts`
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reducer } from './store';
import { effectiveP } from '../engine/engine';
import type { AppState } from './store';

const NOW = 1_700_000_000_000;
function base(): AppState { return reducer(undefined as never, { type: 'HYDRATE', state: { items: {} } as AppState } as never) ?? ({ items: {}, settings: {} } as AppState); }

test('模試: 初見の用法(usg-)は evidence 記録される(p>0)', () => {
  const s0 = { items: {}, settings: {}, } as AppState;
  const s1 = reducer(s0, { type: 'MOCK_ANSWER', itemId: 'usg3-001', correct: true, now: NOW } as never);
  assert.ok(s1.items['usg3-001'], '初見の用法が記録される');
  assert.ok(effectiveP(s1.items['usg3-001'], NOW) > 0.9, '正解で p が上がる');
});

test('模試: 初見の台帳問題(kb-=組み立て/文章)も記録される(旧仕様の除外を撤廃)', () => {
  const s0 = { items: {}, settings: {} } as AppState;
  const s1 = reducer(s0, { type: 'MOCK_ANSWER', itemId: 'kb-004260', correct: true, now: NOW } as never);
  assert.ok(s1.items['kb-004260'], '初見の台帳問題も記録される');
});

test('模試: 既出項目は再記録しない(学習日のみ・pは据え置き)', () => {
  const s0 = { items: { 'usg3-001': { p: 0.3, evidence: 3, updatedAt: NOW, reps: 1, intervalDays: 1, ease: 2.5, dueAt: NOW } }, settings: {} } as unknown as AppState;
  const s1 = reducer(s0, { type: 'MOCK_ANSWER', itemId: 'usg3-001', correct: true, now: NOW + 1000 } as never);
  assert.equal(s1.items['usg3-001'].p, 0.3, '既出はpを動かさない');
});
```
（注: `AppState`/`Action` の import 名は実ファイルに合わせる。`reducer`/`AppState` を `store.tsx` から export する。）

- [ ] **Step 2: 失敗を確認** — Run: `node --import tsx --test src/store/mockAnswer.test.ts`
  Expected: FAIL（`reducer`/`AppState` が未export、または kb- 初見が記録されない）

- [ ] **Step 3: 実装** — `store.tsx`
  1. `function reducer(` → `export function reducer(` に変更。`AppState` 型を export（未exportなら）。
  2. `MOCK_ANSWER` 分岐を差し替え：
```ts
    case 'MOCK_ANSWER': {
      // 模試は「その項目が初見(state.itemsに無い)のときだけ」evidenceに記録(初見保証で正当=模試は常に初見プール)。
      // 既出(万一の再出題)は学習日のみ→暗記/再出題の水増しを防ぐ。台帳/非台帳(kb-/usg-/moji)を問わず統一。
      if (state.items[action.itemId]) return withStudyDay(state, action.now);
      const next = recordMock(newItemState(action.now), action.correct, action.now);
      return withStudyDay({ ...state, items: { ...state.items, [action.itemId]: next } }, action.now);
    }
```

- [ ] **Step 4: テストが通ることを確認** — Run: `node --import tsx --test src/store/mockAnswer.test.ts` → PASS

- [ ] **Step 5: 型チェック** — Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 6: commit**
```bash
git add src/store/store.tsx src/store/mockAnswer.test.ts
git commit -m "fix(ring): 模試は初見の項目だけ記録(kb-/usg-統一・接頭辞依存を撤廃)"
```

---

### Task 3: 旧 bankId / kbIds テストを厳選削減後の実態へ更新

**Files:**
- Modify: `src/data/bankId.test.ts`（id 形式の正規表現）
- Modify: `src/data/exam/kbIds.test.ts`（5727件固定・kb-固定・全単射の廃止）
- Investigate: `src/data/exam/kbIdMigration.json` がランタイムで使われるか（テスト専用なら移行テストは実態化/削除可）

**背景**: 用法を厳選削減（N3 2031→150・N4 630→153）＋ID を `usg-` 化したため、旧スナップショット不変条件（全 `kb-NNNNNN`・総数5727・移行全単射）は**設計として陳腐化**。現在の意味ある不変条件（**IDは一意で妥当な形式**）へ更新する。

- [ ] **Step 1: kbIdMigration の使用箇所を確認**
  Run: `grep -rn "kbIdMigration" src --include=*.ts --include=*.tsx | grep -v ".test."`
  → 非テストでの参照が無ければ「移行マップは歴史的成果物・ランタイム不使用」と判断（移行テストは実態化/削除対象）。

- [ ] **Step 2: bankId.test.ts の id 形式を更新**
  `for (const b of BANK) assert.match(b.id, /^kb-\d{6}$/);`
  → `for (const b of BANK) assert.match(b.id, /^(kb-\d{6}|usg[34]-\d{3})$/); // 厳選用法は usg3-/usg4-`

- [ ] **Step 3: kbIds.test.ts を実態へ**（`assert.equal(B.length, 5727)` と全単射を撤廃し、現行の意味ある不変条件に）：
```ts
test('全 bank エントリは一意で妥当な id 形式(kb-NNNNNN / usg[34]-NNN)', () => {
  assert.ok(B.length > 0);
  for (const b of B) assert.match(b.id, /^(kb-\d{6}|usg[34]-\d{3})$/);
  const ids = new Set(B.map((b) => b.id));
  assert.equal(ids.size, B.length); // 一意
});

// 旧「移行マップは全件かつ全単射」は用法厳選削減で成立しない(歴史的成果物)。
// 現存する移行先だけが妥当か検証する（削除された旧用法kb-idはスキップ）。
test('移行マップの値のうち現存するものは全て妥当な bank id', () => {
  const idSet = new Set(B.map((b) => b.id));
  const present = Object.values(M).filter((v) => idSet.has(v));
  assert.ok(present.length > 0);
  assert.equal(new Set(present).size, present.length); // 現存分は一意
});
```
  ※Step1で `kbIdMigration` がランタイム不使用と確認できた場合、この移行テストは削除も可（判断は実装者）。

- [ ] **Step 4: 実行して緑を確認** — Run: `node --import tsx --test src/data/bankId.test.ts src/data/exam/kbIds.test.ts` → PASS

- [ ] **Step 5: commit**
```bash
git add src/data/bankId.test.ts src/data/exam/kbIds.test.ts
git commit -m "test(ring): bank id 不変条件を厳選用法(usg-)後の実態へ更新"
```

---

### Task 4: saveRef 用法解決率テストを実態へ

**Files:**
- Modify: `src/data/exam/saveRef.test.ts:77-86`（閾値 `rate > 0.9`）

**背景**: 用法は stem を語彙へ逆引きして saveRef を付けるが、**厳選用法には副詞等の非語彙 stem が含まれ**、解決率は 245/303≈80%。0.9 は厳選前の値で非現実的。

- [ ] **Step 1: 現状率を確認** — Run: `node --import tsx --test src/data/exam/saveRef.test.ts` で failing メッセージの `resolved/total` を読む（例 245/303）。

- [ ] **Step 2: 閾値を実態へ**（副詞等の非語彙 stem を織り込み `0.75` に）：
```ts
  const rate = resolved / usageBank.length;
  // 厳選用法には副詞・擬態語など vocab.json に無い stem が一定数含まれる(単語帳保存不可でも問題として成立)。
  assert.ok(rate > 0.75, `usage解決率が低すぎる: ${resolved}/${usageBank.length}`);
```

- [ ] **Step 3: 緑を確認** — Run: `node --import tsx --test src/data/exam/saveRef.test.ts` → PASS

- [ ] **Step 4: 全テスト緑を確認** — Run: `npm test 2>&1 | grep -E "not ok|# fail"` → 出力なし（全緑）

- [ ] **Step 5: commit**
```bash
git add src/data/exam/saveRef.test.ts
git commit -m "test(ring): 用法saveRef解決率の閾値を厳選後の実態(>0.75)へ"
```

---

## 後続（本計画外・要設計判断＝Plan A-2）
以下は設計書A に含むが**未決の設計判断**が要るため本計画に入れない：
1. **単語タブ→大問"面"の対応表**（§3.1/§3.5）：語 v の #produce/#gbuild/#gmeaning 習得が、どの試験大問（`<v>#context` 等）の到達度を底上げするか。「意味を覚えた＝漢字も読める」ではないため写像は自明でない→ユーザー判断が要る。
2. **`ladderPassPct` の evidence 加重**（§3.2）：単純平均→evidence重み平均。練習多数の項目が支配しないよう設計要。
3. **±への単語タブ寄与係数**（§3.6）。
→ 1 の対応表を決めてから A-2 の計画を書く。

## Self-Review
- **スペック網羅**：本計画は設計書A のうち「§3.5 記録/級解決の恒久修正」「§4 テスト実態化」を実装。§3.1(面写像)/§3.2(加重)/§3.6(±)は「後続」に明記＝取りこぼしを申告済み。
- **プレースホルダ**：Task2テストの `AppState`/`Action` import 名は「実ファイルに合わせる」注記あり（実装時に確定）。それ以外は具体コード。
- **型整合**：`skillWeight` の戻り値 number、`reducer` の (AppState, Action)→AppState、`recordMock`/`newItemState`/`effectiveP` の既存シグネチャに一致。
- **現行維持の確認**：`updateMastery`・`SIGNAL_WEIGHT`・`knowledgeDaimonPct` は不変更（割引/事前値なしの確定を厳守）。
