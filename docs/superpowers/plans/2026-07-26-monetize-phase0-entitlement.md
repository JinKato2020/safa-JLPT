# マネタイズ Phase 0（Pro権利の土台＋1日の回数制限）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「この人はProか」と「今日あと何回練習できるか」を純関数1つずつに閉じ込め、7日お試しを効かせ、回数制限の配線まで完成させる（ただし制限は **OFF のまま出荷**）。

**Architecture:** 判定ロジックは `src/pro/` の純関数（`proStatus` / `quotaFor`）に集約し、画面は結果だけを見る。状態は既存の Context+useReducer（`src/store/store.tsx`）に action を足して更新する。練習画面には共通フック `useSessionGate()` を1つ通し、消費の呼び出し箇所を1か所に保つ。制限の有効化は `src/pro/gating.ts` の定数1つで切り替える。

**Tech Stack:** TypeScript / React Native (Expo SDK 54) / React Context + useReducer / AsyncStorage / `node --import tsx --test`

**元になった設計書:** `docs/superpowers/specs/2026-07-26-monetization-design.md`

## Global Constraints

- Pro判定は `proStatus(state, now)` **ただ1つ**。画面や他モジュールに判定ロジックを書かない。
- 回数判定は `quotaFor(state, now)` **ただ1つ**。
- **`GATING_ENABLED = false` のまま出荷する。** true にするのは購入画面が入る Phase 1。制限だけ先に出さない（逃げ道が無くなるため）。
- お試し期間 `TRIAL_DAYS = 7`／無料の回数 `FREE_SESSIONS_PER_DAY = 3`／広告ボーナス上限 `AD_BONUS_PER_DAY_MAX = 2`。この3つは定数として1か所にだけ書く。
- `AppState` に足すフィールドは**すべて optional**。旧データ（undefined）で落ちてはいけない。
- 日付は既存の `dayStr(now)`（`src/store/state.ts`）を使う。日付処理を自作しない。
- 新しいテストファイルは **`package.json` の `test` スクリプト末尾に必ず追記する**（追記しないと一括テストで走らない）。
- `safa-assets/` は幽霊ディレクトリ。**絶対に触らない**。編集するのはルート直下の `src/` と `App.tsx` のみ。
- 各タスクの最後に必ずコミットする。

## このPhaseでやらないこと（YAGNI・Phase 1以降）

- RevenueCat SDK の導入・購入画面・商品登録（Phase 1）
- AdMob SDK・リワード広告の表示（Phase 2）
- 🔒Pro バッジ部品（`ProLock`）＝ 押した先の購入画面が無いうちは作らない（Phase 1）
- 消費の払い戻し（誤タップ救済）＝ 練習画面は明示タップでしか入らず、入口に「あと◯回」を出せば足りる。Phase 1 で入口表示を作る時に再検討する

---

### Task 1: Pro判定の純関数

**Files:**
- Modify: `src/store/state.ts:63-82`（`AppState` に2フィールド追加）
- Create: `src/pro/entitlement.ts`
- Test: `src/pro/entitlement.test.ts`
- Modify: `package.json`（`test` スクリプト）

**Interfaces:**
- Consumes: `AppState`, `INITIAL_STATE`（`src/store/state.ts`）
- Produces:
  - `DAY_MS: number` = 86400000
  - `TRIAL_DAYS: number` = 7
  - `type ProSource = 'dev' | 'purchase' | 'referral' | 'trial' | 'none'`
  - `interface ProStatus { isPro: boolean; source: ProSource; until?: number; trialDaysLeft: number }`
  - `trialEndsAt(state: AppState): number | undefined`
  - `proStatus(state: AppState, now: number): ProStatus`
  - `grantProDays(state: AppState, days: number, now: number): AppState`
  - `setPurchaseActive(state: AppState, active: boolean, now: number): AppState`
  - `AppState.entitlements?: { purchaseActive?: boolean; purchaseCheckedAt?: number; proUntil?: number }`
  - `AppState.dailyQuota?: { day: string; used: number; bonus: number }`

- [ ] **Step 1: `AppState` にフィールドを足す**

`src/store/state.ts` の `AppState` インターフェース内、`mockGrantsClaimed?: number;` の行の直後に以下を挿入する。

```ts
  entitlements?: {              // Pro(有料)の権利。未設定→無料
    purchaseActive?: boolean;   // RevenueCat同期結果のキャッシュ(正本はストアのレシート)
    purchaseCheckedAt?: number; // 最後に同期できた時刻 epoch ms
    proUntil?: number;          // 期限つきPro(紹介など)の終了時刻 epoch ms
  };
  dailyQuota?: { day: string; used: number; bonus: number }; // 1日の練習回数。day=YYYY-MM-DD / used=今日始めた回数 / bonus=広告で足した回数
```

- [ ] **Step 2: 失敗するテストを書く**

`src/pro/entitlement.test.ts` を新規作成する。

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, type AppState } from '../store/state';
import { proStatus, grantProDays, setPurchaseActive, trialEndsAt, TRIAL_DAYS, DAY_MS } from './entitlement';

const T0 = 1_800_000_000_000; // 固定の基準時刻(テストを実時計に依存させない)
const base = (over: Partial<AppState> = {}): AppState => ({ ...INITIAL_STATE, installedAt: T0, ...over });

test('お試し: 初回起動から7日以内は Pro', () => {
  const r = proStatus(base(), T0 + 1 * DAY_MS);
  assert.equal(r.isPro, true);
  assert.equal(r.source, 'trial');
  assert.equal(r.trialDaysLeft, 6);
});

test('お試し: 7日を過ぎたら無料に戻る(データは消えない)', () => {
  const s = base();
  const r = proStatus(s, T0 + TRIAL_DAYS * DAY_MS + 1);
  assert.equal(r.isPro, false);
  assert.equal(r.source, 'none');
  assert.equal(r.trialDaysLeft, 0);
  assert.deepEqual(s.items, INITIAL_STATE.items); // 降格しても何も削らない
});

test('購入はお試し切れより優先される', () => {
  const s = setPurchaseActive(base(), true, T0);
  const r = proStatus(s, T0 + 365 * DAY_MS);
  assert.equal(r.isPro, true);
  assert.equal(r.source, 'purchase');
  assert.equal(s.entitlements?.purchaseCheckedAt, T0);
});

test('開発スイッチ devPro は最優先', () => {
  const s = base({ settings: { ...INITIAL_STATE.settings, devPro: true } });
  assert.equal(proStatus(s, T0 + 999 * DAY_MS).source, 'dev');
});

test('紹介+7日: お試し中に足すと お試し終了日から7日 伸びる(二重取りしない)', () => {
  const s = grantProDays(base(), 7, T0 + 2 * DAY_MS);
  assert.equal(s.entitlements?.proUntil, (trialEndsAt(base()) as number) + 7 * DAY_MS);
  const r = proStatus(s, T0 + 10 * DAY_MS);
  assert.equal(r.isPro, true);
  assert.equal(r.source, 'referral');
});

test('紹介+7日: お試しが切れた後に足すと 今から7日', () => {
  const now = T0 + 30 * DAY_MS;
  const s = grantProDays(base(), 7, now);
  assert.equal(s.entitlements?.proUntil, now + 7 * DAY_MS);
  assert.equal(proStatus(s, now + 6 * DAY_MS).isPro, true);
  assert.equal(proStatus(s, now + 8 * DAY_MS).isPro, false);
});

test('installedAt が無い旧データでも落ちない(=無料扱い)', () => {
  const s: AppState = { ...INITIAL_STATE };
  delete (s as { installedAt?: number }).installedAt;
  assert.equal(proStatus(s, T0).isPro, false);
  assert.equal(trialEndsAt(s), undefined);
});
```

- [ ] **Step 3: テストを走らせて落ちることを確認**

Run: `node --import tsx --test src/pro/entitlement.test.ts`
Expected: FAIL（`Cannot find module './entitlement'` で全件エラー）

- [ ] **Step 4: 実装を書く**

`src/pro/entitlement.ts` を新規作成する。

```ts
// Proかどうかの唯一の判定(純関数・副作用なし)。画面はこの結果だけを見る。
// 優先順位: 開発スイッチ → 購入(レシート同期のキャッシュ) → 期限つき(紹介) → お試し7日 → 無料。
// 通信断でもProが剥がれないよう、購入状態は端末に保存した値を信じる(正本はストアのレシート)。
import type { AppState } from '../store/state';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_DAYS = 7; // 初回起動からのお試し期間

export type ProSource = 'dev' | 'purchase' | 'referral' | 'trial' | 'none';

export interface ProStatus {
  isPro: boolean;
  source: ProSource;
  until?: number;        // 期限つきのときの終了時刻(ms)。dev/purchase では undefined
  trialDaysLeft: number; // お試しの残り日数(切り上げ)。終了後は0
}

/** お試しの終了時刻。installedAt 未確定(旧データ)なら undefined。 */
export function trialEndsAt(state: AppState): number | undefined {
  return state.installedAt ? state.installedAt + TRIAL_DAYS * DAY_MS : undefined;
}

export function proStatus(state: AppState, now: number): ProStatus {
  const trialEnd = trialEndsAt(state);
  const trialDaysLeft = trialEnd && trialEnd > now ? Math.ceil((trialEnd - now) / DAY_MS) : 0;
  if (state.settings.devPro) return { isPro: true, source: 'dev', trialDaysLeft };
  if (state.entitlements?.purchaseActive) return { isPro: true, source: 'purchase', trialDaysLeft };
  const until = state.entitlements?.proUntil ?? 0;
  if (until > now) return { isPro: true, source: 'referral', until, trialDaysLeft };
  if (trialEnd && trialEnd > now) return { isPro: true, source: 'trial', until: trialEnd, trialDaysLeft };
  return { isPro: false, source: 'none', trialDaysLeft: 0 };
}

/** 紹介などで days 日ぶん延長。お試し中なら「お試し終了日」から積む(期間を二重取りさせない)。 */
export function grantProDays(state: AppState, days: number, now: number): AppState {
  const from = Math.max(state.entitlements?.proUntil ?? 0, trialEndsAt(state) ?? 0, now);
  return { ...state, entitlements: { ...state.entitlements, proUntil: from + days * DAY_MS } };
}

/** RevenueCat の同期結果を反映(Phase 1 で呼ぶ)。通信できない時はこの値が残る。 */
export function setPurchaseActive(state: AppState, active: boolean, now: number): AppState {
  return { ...state, entitlements: { ...state.entitlements, purchaseActive: active, purchaseCheckedAt: now } };
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `node --import tsx --test src/pro/entitlement.test.ts`
Expected: PASS（7 tests）

- [ ] **Step 6: 一括テストに登録**

`package.json` の `"test"` スクリプトは長い1行のファイル列挙になっている。末尾の `src/data/content/otaDiff.test.ts` の直後に半角スペース区切りで追記する。

```
 src/pro/entitlement.test.ts
```

Run: `npm test`
Expected: PASS（既存テストも全部通る）

- [ ] **Step 7: コミット**

```bash
git add src/store/state.ts src/pro/entitlement.ts src/pro/entitlement.test.ts package.json
git commit -m "feat(pro): Pro判定の純関数と7日お試しを追加"
```

---

### Task 2: 1日の回数制限の純関数

**Files:**
- Create: `src/pro/gating.ts`
- Create: `src/pro/dailyQuota.ts`
- Test: `src/pro/dailyQuota.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `proStatus`, `DAY_MS`, `TRIAL_DAYS`（Task 1）／`dayStr`, `AppState`（`src/store/state.ts`）
- Produces:
  - `GATING_ENABLED: boolean`（`src/pro/gating.ts`）
  - `FREE_SESSIONS_PER_DAY: number` = 3
  - `AD_BONUS_PER_DAY_MAX: number` = 2
  - `interface Quota { unlimited: boolean; limit: number; used: number; left: number; bonus: number; canPractice: boolean; canWatchAd: boolean }`
  - `quotaFor(state: AppState, now: number): Quota`
  - `consumeSession(state: AppState, now: number): AppState`
  - `grantAdBonus(state: AppState, now: number): AppState`

**設計上の注意:** `quotaFor()` は `GATING_ENABLED` を**見ない**。純粋な計算は常に本当の値を返し、「実際に止めるかどうか」は UI 側（Task 3 のフック）が決める。こうしないと OFF の間テストが書けなくなる。

- [ ] **Step 1: 有効化スイッチのファイルを作る**

`src/pro/gating.ts` を新規作成する。

```ts
// 1日の回数制限を実際にかけるかどうかの、たった1つのスイッチ。
// Phase 0(この計画)では false = 誰も制限されない。仕組みだけ先に完成させる。
// Phase 1 で購入画面が入ったら true にする。制限だけ先に出さない(逃げ道が無くなるため)。
export const GATING_ENABLED = false;
```

- [ ] **Step 2: 失敗するテストを書く**

`src/pro/dailyQuota.test.ts` を新規作成する。

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE, dayStr, type AppState } from '../store/state';
import { quotaFor, consumeSession, grantAdBonus, FREE_SESSIONS_PER_DAY, AD_BONUS_PER_DAY_MAX } from './dailyQuota';
import { DAY_MS, TRIAL_DAYS } from './entitlement';

const T0 = 1_800_000_000_000;
const FREE_NOW = T0 + (TRIAL_DAYS + 1) * DAY_MS; // お試しが切れた後 = 無料ユーザー
const st = (over: Partial<AppState> = {}): AppState => ({ ...INITIAL_STATE, installedAt: T0, ...over });

test('無料は1日3回で止まる', () => {
  let s = st();
  for (let i = 0; i < FREE_SESSIONS_PER_DAY; i++) {
    assert.equal(quotaFor(s, FREE_NOW).canPractice, true);
    s = consumeSession(s, FREE_NOW);
  }
  const q = quotaFor(s, FREE_NOW);
  assert.equal(q.used, 3);
  assert.equal(q.left, 0);
  assert.equal(q.canPractice, false);
  assert.equal(q.canWatchAd, true); // ここで初めて広告を勧める
});

test('日付が変わると3回に戻る', () => {
  let s = st();
  for (let i = 0; i < 3; i++) s = consumeSession(s, FREE_NOW);
  const q = quotaFor(s, FREE_NOW + DAY_MS);
  assert.equal(q.used, 0);
  assert.equal(q.left, FREE_SESSIONS_PER_DAY);
  assert.equal(q.canPractice, true);
});

test('広告は1日2本まで・1本で+1回(合計5回)', () => {
  let s = st();
  for (let i = 0; i < 3; i++) s = consumeSession(s, FREE_NOW);
  s = grantAdBonus(s, FREE_NOW);
  assert.equal(quotaFor(s, FREE_NOW).left, 1);
  s = consumeSession(s, FREE_NOW);
  s = grantAdBonus(s, FREE_NOW);
  assert.equal(quotaFor(s, FREE_NOW).left, 1);
  s = consumeSession(s, FREE_NOW);
  const q = quotaFor(s, FREE_NOW);
  assert.equal(q.used, 5);
  assert.equal(q.limit, FREE_SESSIONS_PER_DAY + AD_BONUS_PER_DAY_MAX);
  assert.equal(q.canPractice, false);
  assert.equal(q.canWatchAd, false);                              // 3本目は見られない
  assert.deepEqual(grantAdBonus(s, FREE_NOW).dailyQuota, s.dailyQuota); // 3本目を叩いても不変
});

test('残りがあるうちは広告を勧めない', () => {
  const s = consumeSession(st(), FREE_NOW);
  assert.equal(quotaFor(s, FREE_NOW).canWatchAd, false);
});

test('Proは無制限・消費も記録しない', () => {
  const pro = st({ settings: { ...INITIAL_STATE.settings, devPro: true } });
  const q = quotaFor(pro, FREE_NOW);
  assert.equal(q.unlimited, true);
  assert.equal(q.canPractice, true);
  assert.equal(q.canWatchAd, false);
  assert.equal(consumeSession(pro, FREE_NOW).dailyQuota, undefined);
});

test('お試し中(初回7日)は無制限', () => {
  assert.equal(quotaFor(st(), T0 + DAY_MS).unlimited, true);
});

test('保存される day は端末のローカル日付', () => {
  const s = consumeSession(st(), FREE_NOW);
  assert.equal(s.dailyQuota?.day, dayStr(FREE_NOW));
});

test('壊れた保存値(マイナス)でも落ちない', () => {
  const s = st({ dailyQuota: { day: dayStr(FREE_NOW), used: -5, bonus: -1 } });
  const q = quotaFor(s, FREE_NOW);
  assert.equal(q.used, 0);
  assert.equal(q.left, FREE_SESSIONS_PER_DAY);
});
```

- [ ] **Step 3: テストを走らせて落ちることを確認**

Run: `node --import tsx --test src/pro/dailyQuota.test.ts`
Expected: FAIL（`Cannot find module './dailyQuota'`）

- [ ] **Step 4: 実装を書く**

`src/pro/dailyQuota.ts` を新規作成する。

```ts
// 「今日あと何回練習できるか」の唯一の判定(純関数・副作用なし)。
// 数え方: 練習画面に入った時に1消費する。
// 対象外(いつでも無制限): 辞書・単語カード閲覧・成績表示・模試(チケット制で独立)。
import type { AppState } from '../store/state';
import { dayStr } from '../store/state';
import { proStatus } from './entitlement';

export const FREE_SESSIONS_PER_DAY = 3; // 無料の1日あたり回数
export const AD_BONUS_PER_DAY_MAX = 2;  // 広告で足せる回数の上限(=1日に見られる本数)

export interface Quota {
  unlimited: boolean;  // Pro
  limit: number;       // 今日の上限(Proは Infinity)
  used: number;        // 今日すでに始めた回数
  left: number;        // 残り(Proは Infinity)
  bonus: number;       // 今日 広告で足した回数
  canPractice: boolean;
  canWatchAd: boolean; // 残り0 かつ 広告枠が残っている(無料のみ true)
}

/** 当日ぶんに正規化。日付が変わっていれば0とみなす(保存は次の書き込み時)。 */
function todayCounts(state: AppState, now: number): { used: number; bonus: number } {
  const q = state.dailyQuota;
  if (!q || q.day !== dayStr(now)) return { used: 0, bonus: 0 };
  return { used: Math.max(0, q.used ?? 0), bonus: Math.max(0, q.bonus ?? 0) };
}

export function quotaFor(state: AppState, now: number): Quota {
  const { used, bonus } = todayCounts(state, now);
  if (proStatus(state, now).isPro) {
    return { unlimited: true, limit: Infinity, used, left: Infinity, bonus, canPractice: true, canWatchAd: false };
  }
  const limit = FREE_SESSIONS_PER_DAY + Math.min(bonus, AD_BONUS_PER_DAY_MAX);
  const left = Math.max(0, limit - used);
  return {
    unlimited: false, limit, used, left, bonus,
    canPractice: left > 0,
    canWatchAd: left === 0 && bonus < AD_BONUS_PER_DAY_MAX,
  };
}

/** 練習を1回始めた。Proなら記録しない(不変)。 */
export function consumeSession(state: AppState, now: number): AppState {
  if (proStatus(state, now).isPro) return state;
  const { used, bonus } = todayCounts(state, now);
  return { ...state, dailyQuota: { day: dayStr(now), used: used + 1, bonus } };
}

/** 広告を最後まで見た報酬: 今日の回数を+1。上限に達していれば不変。 */
export function grantAdBonus(state: AppState, now: number): AppState {
  const { used, bonus } = todayCounts(state, now);
  if (bonus >= AD_BONUS_PER_DAY_MAX) return state;
  return { ...state, dailyQuota: { day: dayStr(now), used, bonus: bonus + 1 } };
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `node --import tsx --test src/pro/dailyQuota.test.ts`
Expected: PASS（8 tests）

- [ ] **Step 6: 一括テストに登録してコミット**

`package.json` の `"test"` スクリプト末尾に ` src/pro/dailyQuota.test.ts` を追記する。

```bash
npm test
git add src/pro/gating.ts src/pro/dailyQuota.ts src/pro/dailyQuota.test.ts package.json
git commit -m "feat(pro): 1日の練習回数の判定(無料3回+広告2本)を追加・既定はOFF"
```

Expected: `npm test` が PASS

---

### Task 3: ストアへの配線と共通フック

**Files:**
- Modify: `src/store/store.tsx:19-35`（Action union）, `:57-105`（reducer）, `:148-180`（useAppActions）
- Create: `src/pro/useSessionGate.ts`

**Interfaces:**
- Consumes: `consumeSession`, `grantAdBonus`, `quotaFor`, `Quota`（Task 2）／`setPurchaseActive`, `grantProDays`（Task 1）／`GATING_ENABLED`（Task 2）
- Produces:
  - `useAppActions()` に `consumeSession()`, `grantAdBonus()`, `setPurchaseActive(active: boolean)`, `grantProDays(days: number)` が生える
  - `interface SessionGate { quota: Quota; limited: boolean; begin: () => boolean }`
  - `useSessionGate(): SessionGate`

**テストについて:** `store.tsx` は React と AsyncStorage を読み込むため `node --test` では動かせない。ここは新規テストを書かず、**中身の計算は Task 1/2 のテストで担保済み**。検証は型チェック（`npx tsc --noEmit`）と既存テストの通過で行う。

- [ ] **Step 1: import を足す**

`src/store/store.tsx` の import 群の末尾（`import { syncMockTickets, ... } from './tickets';` の直後）に追記する。

```ts
import { consumeSession as quotaConsume, grantAdBonus as quotaAdBonus } from '../pro/dailyQuota';
import { setPurchaseActive as proSetPurchase, grantProDays as proGrantDays } from '../pro/entitlement';
```

- [ ] **Step 2: Action を足す**

`type Action =` の union、`| { type: 'SPEND_TICKET'; now: number }` の直後に4行挿入する。

```ts
  | { type: 'CONSUME_SESSION'; now: number }
  | { type: 'GRANT_AD_BONUS'; now: number }
  | { type: 'SET_PURCHASE_ACTIVE'; active: boolean; now: number }
  | { type: 'GRANT_PRO_DAYS'; days: number; now: number }
```

- [ ] **Step 3: reducer に case を足す**

`reducer` 内、`case 'SPEND_TICKET':` の `return spendMockTicket(state, action.now);` の直後に挿入する。

```ts
    case 'CONSUME_SESSION':
      return quotaConsume(state, action.now);
    case 'GRANT_AD_BONUS':
      return quotaAdBonus(state, action.now);
    case 'SET_PURCHASE_ACTIVE':
      return proSetPurchase(state, action.active, action.now);
    case 'GRANT_PRO_DAYS':
      return proGrantDays(state, action.days, action.now);
```

- [ ] **Step 4: useAppActions に足す**

`useAppActions()` が返すオブジェクト内、`spendMockTicket: () => dispatch({ type: 'SPEND_TICKET', now: Date.now() }),` の直後に挿入する。

```ts
    consumeSession: () => dispatch({ type: 'CONSUME_SESSION', now: Date.now() }),
    grantAdBonus: () => dispatch({ type: 'GRANT_AD_BONUS', now: Date.now() }),
    setPurchaseActive: (active: boolean) => dispatch({ type: 'SET_PURCHASE_ACTIVE', active, now: Date.now() }),
    grantProDays: (days: number) => dispatch({ type: 'GRANT_PRO_DAYS', days, now: Date.now() }),
```

- [ ] **Step 5: 共通フックを作る**

`src/pro/useSessionGate.ts` を新規作成する。

```ts
// 練習を始める前の共通ゲート。回数の消費をここ1か所に集約する(画面ごとに書かない)。
// 使い方は各練習画面の冒頭で begin() を1回だけ呼ぶ(Task 4 の定型ブロック)。
import { useState } from 'react';
import { useAppState, useAppActions } from '../store/store';
import { quotaFor, type Quota } from './dailyQuota';
import { GATING_ENABLED } from './gating';

export interface SessionGate {
  quota: Quota;         // 表示用(あと◯回)
  limited: boolean;     // 上限に当たって開始できなかった
  begin: () => boolean; // true=練習を始めてよい / false=上限
}

export function useSessionGate(): SessionGate {
  const state = useAppState();
  const { consumeSession } = useAppActions();
  const [limited, setLimited] = useState(false);
  const quota = quotaFor(state, Date.now());

  function begin(): boolean {
    if (GATING_ENABLED && !quotaFor(state, Date.now()).canPractice) {
      setLimited(true);
      return false;
    }
    consumeSession(); // OFFの間も回数だけは数えておく(Phase 1 でONにした時に挙動が変わらない)
    return true;
  }

  return { quota, limited, begin };
}
```

- [ ] **Step 6: 型チェックとテスト**

Run: `npx tsc --noEmit && npm test`
Expected: エラー0件・全テスト PASS

- [ ] **Step 7: コミット**

```bash
git add src/store/store.tsx src/pro/useSessionGate.ts
git commit -m "feat(pro): 回数消費と権利更新のactionを追加・共通フックuseSessionGateを新設"
```

---

### Task 4: 上限に当たった時の画面

**Files:**
- Create: `src/pro/LimitReachedSheet.tsx`
- Modify: `src/i18n/ja.json`, `src/i18n/en.json`, `src/i18n/ne.json`

**Interfaces:**
- Consumes: `FREE_SESSIONS_PER_DAY`（Task 2）／`useColors`, `spacing`, `radius`, `type as ty`, `ThemeColors`（`src/theme`）／`useT`（`src/i18n`）
- Produces: `default export LimitReachedSheet({ onClose }: { onClose: () => void })`

**方針:** 「使えません」ではなく「今日はここまで＋続きの選び方＋いま使えるもの」を見せる。Phase 0 では購入導線も広告導線もまだ無いので、閉じるボタン1つだけにする（存在しないボタンを描かない）。

- [ ] **Step 1: 日本語の文言を足す**

`src/i18n/ja.json` の末尾（最後のキーの後）に5キー追加する。JSONの直前行にカンマを足すのを忘れないこと。

```json
  "limit.title": "今日の練習はおしまい",
  "limit.body": "無料では1日{n}回まで練習できます。日付が変わると、またできるようになります。",
  "limit.note": "辞書・単語カード・成績の確認は、いつでも使えます。",
  "limit.close": "とじる",
  "limit.left": "あと{n}回"
```

- [ ] **Step 2: 英語とネパール語を足す**

`src/i18n/en.json` に追加する。

```json
  "limit.title": "That's all for today",
  "limit.body": "The free plan includes {n} practice sessions per day. You can practice again tomorrow.",
  "limit.note": "The dictionary, word cards and your results are always available.",
  "limit.close": "Close",
  "limit.left": "{n} left"
```

`src/i18n/ne.json` に追加する。

```json
  "limit.title": "आजको अभ्यास सकियो",
  "limit.body": "निःशुल्क योजनामा दिनको {n} पटक अभ्यास गर्न सकिन्छ। भोलि फेरि गर्न सकिन्छ।",
  "limit.note": "शब्दकोश, शब्द कार्ड र नतिजा जहिले पनि हेर्न सकिन्छ।",
  "limit.close": "बन्द गर्ने",
  "limit.left": "{n} बाँकी"
```

- [ ] **Step 3: 画面部品を作る**

`src/pro/LimitReachedSheet.tsx` を新規作成する。

```tsx
// 1日の上限に当たった時に出す画面。「使えない」ではなく「今日はここまで＋いま使えるもの」を見せる。
// Phase 0 では購入導線も広告導線もまだ無いので、閉じるボタンのみ。
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { FREE_SESSIONS_PER_DAY } from './dailyQuota';

export default function LimitReachedSheet({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const t = useT();
  const s = styles(c);
  return (
    <SafeAreaView style={s.c}>
      <View style={s.card}>
        <Text style={s.title}>{t('limit.title')}</Text>
        <Text style={s.body}>{t('limit.body', { n: FREE_SESSIONS_PER_DAY })}</Text>
        <Text style={s.note}>{t('limit.note')}</Text>
        <Pressable style={s.btn} onPress={onClose} hitSlop={8}>
          <Text style={s.btnTxt}>{t('limit.close')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line,
    padding: spacing.lg, gap: spacing.md,
  },
  title: { fontSize: ty.h1, fontWeight: '700', color: c.ink, textAlign: 'center' },
  body: { fontSize: ty.body, color: c.ink2, textAlign: 'center', lineHeight: 22 },
  note: { fontSize: ty.small, color: c.mute, textAlign: 'center' },
  btn: { backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  btnTxt: { fontSize: ty.body, fontWeight: '700', color: '#fff' },
});
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラー0件

- [ ] **Step 5: コミット**

```bash
git add src/pro/LimitReachedSheet.tsx src/i18n/ja.json src/i18n/en.json src/i18n/ne.json
git commit -m "feat(pro): 1日の上限に当たった時の画面と文言(ja/en/ne)を追加"
```

---

### Task 5: 練習7画面にゲートを通す

**Files:**
- Modify: `src/screens/QuizScreen.tsx`
- Modify: `src/screens/ListeningQuizScreen.tsx`
- Modify: `src/screens/KakitoriScreen.tsx`
- Modify: `src/screens/WordDrillScreen.tsx`
- Modify: `src/screens/FlashcardScreen.tsx`
- Modify: `src/screens/PassageGrammarScreen.tsx`
- Modify: `src/screens/ReadingScreen.tsx`

**Interfaces:**
- Consumes: `useSessionGate`（Task 3）, `LimitReachedSheet`（Task 4）
- Produces: なし（配線のみ）

**なぜ今やるのか:** `GATING_ENABLED = false` なので Phase 0 では見た目が一切変わらない。だが7画面への配線こそが手間とバグの源なので、**制限が効いていない安全なうちに入れて動作確認まで済ませる**。Phase 1 では定数1行を true にするだけで済む。

**触らない画面（数えない）:** `MockScreen` / `MockIntroScreen`（チケット制で独立）、`BrowseScreen` / `CardsScreen` / `KanjiDetailScreen` / `MyWordsScreen` / `DictHomeScreen`（閲覧のみ）、`ListeningScreen`（一覧。実際に解くのは `ListeningQuiz`）。

- [ ] **Step 1: `QuizScreen.tsx` に入れる**

import 群の末尾に追加する。

```tsx
import { useSessionGate } from '../pro/useSessionGate';
import LimitReachedSheet from '../pro/LimitReachedSheet';
```

コンポーネント関数の冒頭、既存の `const nav = useNavigation...` の直後に3行入れる（**他のフックより前・条件分岐より前**に置くこと。React のフックは毎回同じ順で呼ぶ必要がある）。

```tsx
  // 1日の回数ゲート(共通)。GATING_ENABLED=false の間は素通りする。
  const gate = useSessionGate();
  const [gateAllowed, setGateAllowed] = useState<boolean | null>(null);
  useEffect(() => { setGateAllowed(gate.begin()); }, []); // 画面に入った時に1回だけ
```

画面の主 `return (` の直前に2行入れる。

```tsx
  if (gateAllowed === null) return null;
  if (!gateAllowed) return <LimitReachedSheet onClose={() => nav.goBack()} />;
```

`useState` / `useEffect` が未 import ならファイル先頭の React import に足す。

- [ ] **Step 2: 残り6画面に同じ3ブロックを入れる**

`ListeningQuizScreen.tsx` / `KakitoriScreen.tsx` / `WordDrillScreen.tsx` / `FlashcardScreen.tsx` / `PassageGrammarScreen.tsx` / `ReadingScreen.tsx` に、Step 1 とまったく同じ import・フック3行・ガード2行を入れる（コピーでよい）。

画面ごとの注意:
- 変数名が `nav` でない画面（例 `navigation`）は、ガード行の `nav.goBack()` をその画面の変数名に合わせる。
- 早期 return が複数ある画面では、**いちばん最初の return より前**にガード2行を置く。
- モーダル表示の画面（`ListeningQuizScreen`）でも同じでよい。`goBack()` で閉じる。

- [ ] **Step 3: 型チェックとテスト**

Run: `npx tsc --noEmit && npm test`
Expected: エラー0件・全テスト PASS

- [ ] **Step 4: 実機/シミュレータで素通りを確認**

Run: `npx expo start`
確認すること（`GATING_ENABLED = false` なので**全部これまで通り動くのが正解**）:
1. 試験タブ → 大問を1つ開いて10問解ける
2. 単語タブ → 聞き取り・書き取り・単語ドリルがそれぞれ開ける
3. ホームの「今日のおすすめ」から練習が始まる
4. 読解・文章の文法が開ける
5. 何回開いても止められない

- [ ] **Step 5: コミット**

```bash
git add src/screens/QuizScreen.tsx src/screens/ListeningQuizScreen.tsx src/screens/KakitoriScreen.tsx src/screens/WordDrillScreen.tsx src/screens/FlashcardScreen.tsx src/screens/PassageGrammarScreen.tsx src/screens/ReadingScreen.tsx
git commit -m "feat(pro): 練習7画面に1日の回数ゲートを配線(制限はOFFのまま)"
```

---

### Task 6: 設定画面にProの状態を出す＋仕上げ

**Files:**
- Modify: `src/screens/ProfileScreen.tsx:353-365`（開発用「Pro課金」スイッチの直下）
- Modify: `src/i18n/ja.json`, `src/i18n/en.json`, `src/i18n/ne.json`
- Modify: `docs/superpowers/specs/2026-07-26-monetization-design.md`（実装後の実態に合わせる）

**Interfaces:**
- Consumes: `proStatus`（Task 1）, `quotaFor`（Task 2）
- Produces: なし

**目的:** お試しが本当に効いているかを、開発者もユーザーも目で確認できるようにする。ここが無いと「7日お試し」が動いているか誰も分からない。

- [ ] **Step 1: 文言を足す**

`src/i18n/ja.json` に追加する。

```json
  "pro.row_label": "今の状態",
  "pro.state_pro": "Pro（無制限）",
  "pro.state_trial": "お試し中（あと{n}日）",
  "pro.state_free": "無料（1日{n}回）"
```

`src/i18n/en.json` に追加する。

```json
  "pro.row_label": "Your plan",
  "pro.state_pro": "Pro (unlimited)",
  "pro.state_trial": "Free trial ({n} days left)",
  "pro.state_free": "Free ({n} sessions/day)"
```

`src/i18n/ne.json` に追加する。

```json
  "pro.row_label": "हालको अवस्था",
  "pro.state_pro": "Pro (असीमित)",
  "pro.state_trial": "नि:शुल्क परीक्षण ({n} दिन बाँकी)",
  "pro.state_free": "नि:शुल्क (दिनको {n} पटक)"
```

- [ ] **Step 2: 状態行を足す**

`src/screens/ProfileScreen.tsx` の import 群に追加する。

```tsx
import { proStatus } from '../pro/entitlement';
import { FREE_SESSIONS_PER_DAY } from '../pro/dailyQuota';
```

コンポーネント内、`const c = useColors();` の近く（他のフックの後）に追加する。

```tsx
  const pro = proStatus(state, Date.now());
  const proText = pro.source === 'trial'
    ? t('pro.state_trial', { n: pro.trialDaysLeft })
    : pro.isPro
      ? t('pro.state_pro')
      : t('pro.state_free', { n: FREE_SESSIONS_PER_DAY });
```

開発用「Pro課金」スイッチの `</View>` の直後（`src/screens/ProfileScreen.tsx:365` の次の行）に状態行を挿入する。

```tsx
          <View style={s.telemRow}>
            <View style={s.telemTxt}>
              <Text style={s.telemLbl}>{t('pro.row_label')}</Text>
              <Text style={s.subtle}>{proText}</Text>
            </View>
          </View>
```

- [ ] **Step 3: 実機で3状態を確認**

Run: `npx expo start`
確認すること:
1. 開発用「Pro課金」スイッチ **ON** → 「Pro（無制限）」と出る
2. **OFF** に戻す → インストールから7日以内なら「お試し中（あとN日）」と出る
3. 端末の日付を8日先に進める → 「無料（1日3回）」に変わる（**確認後、日付は必ず戻す**）

- [ ] **Step 4: 設計書を実態に合わせる**

`docs/superpowers/specs/2026-07-26-monetization-design.md` の §5.4 を実装に合わせて直す。

1. 関数名 `dailyQuota(state, now)` → `quotaFor(state, now)` に置換（保存フィールド名 `dailyQuota` と衝突するため改名した）
2. 「1問も答えずに戻った場合だけ返す（誤タップ救済）」の行を削除し、代わりに「入口に『あと◯回』を表示して誤タップを防ぐ（Phase 1）」と書く
3. §5.1 の表の対象画面を実装どおり**7画面**（Quiz / ListeningQuiz / Kakitori / WordDrill / Flashcard / PassageGrammar / Reading）に直す

- [ ] **Step 5: 最終確認**

Run: `npx tsc --noEmit && npm test`
Expected: エラー0件・全テスト PASS

Run: `git status --short`
Expected: 意図した変更ファイルだけが並ぶ（テスト用の残骸ファイルが無いこと）

- [ ] **Step 6: コミット**

```bash
git add src/screens/ProfileScreen.tsx src/i18n/ja.json src/i18n/en.json src/i18n/ne.json docs/superpowers/specs/2026-07-26-monetization-design.md
git commit -m "feat(pro): 設定画面にPro/お試し/無料の状態表示を追加・設計書を実装に同期"
```

---

## 完了の定義（Phase 0）

- [ ] `proStatus()` と `quotaFor()` が純関数として存在し、テストが通る（15件）
- [ ] 初回起動から7日間は Pro として扱われ、8日目に無料へ戻る（データは消えない）
- [ ] 練習7画面すべてが共通ゲートを通っている
- [ ] `GATING_ENABLED = false` なので**誰も制限されていない**（既存の使い勝手が1つも変わらない）
- [ ] 設定画面で今の状態（Pro / お試し中あとN日 / 無料）が見える
- [ ] `npx tsc --noEmit` と `npm test` が通る

## 次のPhase（この計画の範囲外）

| Phase | 中身 | 着手の前提 |
|---|---|---|
| 1 | RevenueCat導入・購入画面・商品登録・`GATING_ENABLED = true` | **RevenueCatアカウント作成／App Store Connect と Play で課金商品を作成**（人の手の作業。これが無いと商品IDが決まらず計画が書けない） |
| 2 | AdMob導入・リワード広告・`grantAdBonus()` を配線 | **AdMobアカウント作成／広告ユニット作成／`app-ads.txt` 設置** |
