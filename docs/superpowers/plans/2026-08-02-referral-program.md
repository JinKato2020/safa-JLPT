# 紹介制度（リファラル）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 友だち紹介で「紹介した人」と「続いた新規」の両方に Pro 1週間を配る仕組みを、**既存のPro実装に接続して**MVP（トリガー判定＋Supabase台帳＋導線UI＋同期）まで作る。

**Architecture:** クライアントは local-first のまま。**Proの反映（`proStatus`/`grantProDays`/お試し7日）・広告・RevenueCat課金・課金ゲートは実装済み**なので、残りの「継続トリガー判定・Supabaseの台帳と付与・導線UI・サーバーが延ばした `pro_until` の同期」を作る。継続トリガー（14日以内に別々の7日×各日1セット）はセット完了イベントで適格学習日を貯め、成立をサーバー（Supabase Edge Function）で確定して DB の `pro_until` を延長→同期。付与は自前フラグで、ストア課金は通さない。

**Tech Stack:** React Native / Expo（TS）、node 標準テストランナー（`node --import tsx --test`）、Supabase（Postgres + Edge Functions / Deno）。

> 本プランは 2026-07-25 版を置き換える正式版。設計書＝`docs/superpowers/specs/2026-08-02-referral-program-design.md`。

## Global Constraints

- 報酬＝拡散側＋7日Pro／新規側＋7日Pro。付与は `pro_until = max(now, pro_until) + 7日`（重ねがけ＝延長）。
- 継続トリガー＝`install_date ≤ d ≤ install_date+14日` の適格学習日 distinct ≥ 7。適格学習日＝その日に1セット（約60問）以上完了。
- 付与上限＝当面**無制限**（集計カラムだけ用意し、しきい値は環境変数で後付け）。
- 受取時のアカウント＝**必須にしない**（ソフト誘導）。切替はフラグ1つ。
- 付与は自前 `entitlements.pro_until`。**ストア課金（サブスク）を通さない**。
- 成立判定は**サーバー確定**。クライアント自己申告のみでは払わない。冪等（同じ `new_user_ref` の再報告は無視）。
- 新規UI文字列は `ja.json` のみ（他言語は `t()` 自動フォールバック）。

---

## File Structure

- `src/pro/entitlement.ts`（既存を拡張）— `pro_until` ベースの `isPro` / `grantProDays` / お試し初期化。純関数。
- `src/referral/trigger.ts`（新規）— 適格学習日の記録と7日成立判定。純関数（テスト対象の中核）。
- `src/referral/referralClient.ts`（新規）— Supabase 呼び出し（コード発行/取得・トリガー成立報告）。副作用境界。
- `src/store/state.ts`（修正）— `entitlements`（`proUntil`）と `referral`（`qualifyingDays`, `installDate`, `enteredCode`）の state 追加。
- `src/store/store.tsx`（修正）— セット完了で適格学習日を加算するアクション。
- `src/screens/ReferralScreen.tsx`（新規）— 自分のコード表示＋共有、コード手入力。
- 導線: `src/components/AfterStudyReward.tsx`（達成直後カード）、`src/screens/ProfileScreen.tsx`（常設）。
- Backend: `docs/supabase/schema.sql`（3テーブル＋entitlements 追記）、`docs/supabase/functions/referral-qualify/index.ts`（新規）、`docs/supabase/functions/referral-issue-code/index.ts`（新規）。

---

## フェーズ0（Pro土台）＝実装済み（新規作業なし）

`src/pro/entitlement.ts` に以下が既存。**紹介の受け皿は最初から用意されている**ので作り直さない：
- `proStatus(state, now)`（唯一の判定・優先度 dev→購入→**紹介 `proUntil`**→お試し7日→無料）／`grantProDays(state, days, now)`（お試し終了日から積んで二重取り防止）／お試し7日＝`installedAt + 7日`。
- `state.entitlements.{ proUntil, purchaseActive, purchaseCheckedAt }`、`state.installedAt` も既存。RevenueCat（`src/pro/purchases.ts`）・広告（`src/pro/ads.ts`）・課金ゲート（`dailyQuota.ts`/`useSessionGate.ts`/`LimitReachedSheet.tsx`）も実装済み。

### Task 1: referral の state フィールドを追加

**Files:**
- Modify: `src/store/state.ts`（`AppState` に `referral?: { qualifyingDays?: string[]; enteredCode?: string }`。継続の起点は既存の `installedAt` を流用）

**Interfaces:**
- Produces: `state.referral.qualifyingDays`（適格学習日 ISO 文字列配列）、`state.referral.enteredCode`（新規が入力した紹介コード）。

- [ ] **Step 1:** 型追加（`INITIAL_STATE` は未設定＝undefined のまま）。
- [ ] **Step 2:** `npx tsc --noEmit` → エラー0。
- [ ] **Step 3: Commit** — `git commit -am "feat(referral): referral state(qualifyingDays/enteredCode)を追加"`

---

## フェーズ1（MVP）: トリガー判定＋テーブル＋関数＋導線

> ※Task番号は 3 から続く（旧 Task 2＝お試しPro は実装済みのため欠番）。継続の起点は `state.installedAt`（既存）。

### Task 3: 継続トリガーの純関数（中核ロジック）

**Files:**
- Create: `src/referral/trigger.ts`
- Test: `src/referral/trigger.test.ts`

**Interfaces:**
- Produces:
  - `recordQualifyingDay(days: string[], today: string): string[]`（distinct 追加・ソート維持）
  - `isTriggerMet(installDate: number, qualifyingDays: string[], now: number): boolean`（install〜install+14日の窓内 distinct ≥ 7）

- [ ] **Step 1: Write failing tests**

```ts
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { recordQualifyingDay, isTriggerMet } from './trigger';
const DAY = 86400000; const inst = Date.UTC(2026, 7, 1);
const d = (n: number) => new Date(inst + n*DAY).toISOString().slice(0,10);
test('recordQualifyingDay: 同日は重複しない', () => {
  let a: string[] = []; a = recordQualifyingDay(a, '2026-08-01'); a = recordQualifyingDay(a, '2026-08-01');
  assert.deepEqual(a, ['2026-08-01']);
});
test('isTriggerMet: 窓内で7日(累計)成立', () => {
  const days = [d(0),d(2),d(4),d(6),d(8),d(10),d(13)]; // 別々7日・14日以内
  assert.equal(isTriggerMet(inst, days, inst + 13*DAY), true);
});
test('isTriggerMet: 6日は未成立', () => {
  const days = [d(0),d(2),d(4),d(6),d(8),d(10)];
  assert.equal(isTriggerMet(inst, days, inst + 13*DAY), false);
});
test('isTriggerMet: 15日目に達成しても窓外は数えない', () => {
  const days = [d(0),d(2),d(4),d(6),d(8),d(10),d(15)]; // 最後は窓外
  assert.equal(isTriggerMet(inst, days, inst + 15*DAY), false);
});
```

- [ ] **Step 2: Run to verify fail** — `node --import tsx --test src/referral/trigger.test.ts` → FAIL。
- [ ] **Step 3: Implement**

```ts
// src/referral/trigger.ts
const DAY = 86400000;
export function recordQualifyingDay(days: string[], today: string): string[] {
  if (days.includes(today)) return days;
  return [...days, today].sort();
}
export function isTriggerMet(installDate: number, qualifyingDays: string[], now: number): boolean {
  const start = new Date(installDate).toISOString().slice(0, 10);
  const end = new Date(installDate + 14 * DAY).toISOString().slice(0, 10);
  const inWindow = new Set(qualifyingDays.filter((d) => d >= start && d <= end));
  return inWindow.size >= 7;
}
```

- [ ] **Step 4: Run to verify pass** — PASS。
- [ ] **Step 5: Commit** — `git commit -am "feat(referral): 継続トリガーの判定純関数(14日内に別々7日)"`

### Task 4: セット完了で適格学習日を加算

**Files:**
- Modify: `src/store/store.tsx`（`AfterStudyReward` のマウント effect が既に1回発火する所＝セット完了。ここで `SET_COMPLETED` アクションを dispatch）
- Modify: `src/components/AfterStudyReward.tsx`（effect で `markStudyDay()` を呼ぶ・約60問以上のセット時のみ＝`scored >= 一定` で適格判定。`scored` は既に prop）

**Interfaces:**
- Consumes: `recordQualifyingDay`（Task 3）。
- Produces: `state.referral.qualifyingDays` が伸びる。

- [ ] **Step 1:** store に `SET_COMPLETED`（`{ day: string; qualifying: boolean }`）reducer を追加。`qualifying` の時だけ `referral.qualifyingDays = recordQualifyingDay(...)`。
- [ ] **Step 2:** `useAppActions` に `markStudyDay(qualifying: boolean)` を追加（`day = dayStr(Date.now())`）。
- [ ] **Step 3:** `AfterStudyReward` の既存 mount effect に `markStudyDay(scored >= 60)` を追加（約60問＝1セットの定義）。※水増し防止のため answered ではなく distinct `scored` を使う。
- [ ] **Step 4:** `npx tsc --noEmit` → 0。手動確認: 60問セット完了で `qualifyingDays` に当日が入る。
- [ ] **Step 5: Commit** — `git commit -am "feat(referral): セット完了(約60問)で適格学習日を記録"`

### Task 5: Supabase スキーマ（3テーブル＋entitlements）

**Files:**
- Modify: `docs/supabase/schema.sql`（追記）

- [ ] **Step 1:** 以下を追記（RLS: 本人 read のみ。書き込みは service_role）。

```sql
create table if not exists public.referral_codes (
  code text primary key,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index if not exists referral_codes_owner_uniq on public.referral_codes(owner_user_id);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  referrer_user_id uuid not null,
  new_user_ref text not null unique,          -- 1新規1報酬
  status text not null default 'pending',     -- pending|qualified|rewarded|rejected
  install_at timestamptz,
  qualified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id),
  pro_until timestamptz,
  reward_grant_count int not null default 0,  -- 付与上限は当面無制限・集計だけ持つ
  updated_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.entitlements enable row level security;
create policy rc_read on public.referral_codes for select using (owner_user_id = auth.uid());
create policy rf_read on public.referrals for select using (referrer_user_id = auth.uid());
create policy en_read on public.entitlements for select using (user_id = auth.uid());
```

- [ ] **Step 2:** grant を追記（[[supabase-raw-sql-tables-need-grant]]＝RLSだけでは42501）。`grant select on public.referral_codes, public.referrals, public.entitlements to anon, authenticated;`
- [ ] **Step 3: Commit** — `git commit -am "feat(referral): Supabaseスキーマ(referral_codes/referrals/entitlements)+RLS+grant"`

### Task 6: Edge Function `referral-issue-code`（コード発行）

**Files:**
- Create: `docs/supabase/functions/referral-issue-code/index.ts`

**Interfaces:**
- Produces: POST（認証必須）→ 呼び出しユーザーの `referral_codes` を無ければ採番して返す（`{ code }`）。1ユーザー1コード（`owner` unique）。

- [ ] **Step 1:** Deno/Supabase Function を作成。8文字コード（`crypto.getRandomValues` から `A-Z2-9` で混同文字除外）。`upsert on conflict(owner_user_id) do nothing` → 既存なら既存 code を select して返す。
- [ ] **Step 2:** ローカル検証: `supabase functions serve` → 認証トークンで2回叩き、同じ code が返る（冪等）。
- [ ] **Step 3: Commit** — `git commit -am "feat(referral): コード発行Edge Function(1ユーザー1コード)"`

### Task 7: Edge Function `referral-qualify`（成立→付与）

**Files:**
- Create: `docs/supabase/functions/referral-qualify/index.ts`

**Interfaces:**
- Consumes: リクエスト `{ code, new_user_ref, qualifying_days: string[], install_at }`。
- Produces: 検証成立で拡散側/新規側の `entitlements.pro_until += 7日`、`referrals.status='rewarded'`。冪等。

- [ ] **Step 1:** service_role で以下を実装:
  1. `referral_codes` から `code` の `owner_user_id` を取得（無ければ 400）。
  2. 自己紹介ブロック（`owner_user_id` と new_user の端末/課金/IP ヒューリスティックが一致→ reject）。
  3. `referrals.new_user_ref` が既に `rewarded` → 冪等 200（何もしない）。
  4. サーバー側の学習日記録（同期テーブル）と `qualifying_days` を突き合わせ、`isTriggerMet` 相当を **サーバーで再計算**（クライアント値を信用しない）。
  5. 成立: `referrals` を upsert（status=`rewarded`, qualified_at=now）→ 拡散側 `grant 7d`＋`reward_grant_count += 1`／新規側 `grant 7d`。付与上限は当面チェックしない（`reward_grant_count` は集計のみ）。
- [ ] **Step 2:** ローカル検証: 6日で未成立（reject）、7日で成立（両者 pro_until 延長）、同 new_user_ref 再送で二重付与なし。
- [ ] **Step 3: Commit** — `git commit -am "feat(referral): 成立判定と両者Pro付与のEdge Function(冪等・自己紹介ブロック)"`

### Task 8: `referralClient.ts`（クライアント側の呼び出し境界）

**Files:**
- Create: `src/referral/referralClient.ts`

**Interfaces:**
- Produces: `getMyCode(): Promise<string>`（issue-code を叩く）、`reportQualified(code, newUserRef, qualifyingDays, installAt): Promise<'rewarded'|'pending'|'rejected'>`（qualify を叩く）。既存 `src/auth` の Supabase クライアントを流用。

- [ ] **Step 1:** 既存 auth の supabase client を import し、2つの `functions.invoke` ラッパを実装。ネットワーク失敗は握って `'pending'` を返す（次回同期で再試行）。
- [ ] **Step 2:** `npx tsc --noEmit` → 0。
- [ ] **Step 3: Commit** — `git commit -am "feat(referral): クライアントのコード取得/成立報告ラッパ"`

### Task 9: 導線UI（達成直後カード＋コード入力/共有画面）

**Files:**
- Create: `src/screens/ReferralScreen.tsx`（自分のコード表示＋共有シート＋コード手入力）
- Modify: `src/components/AfterStudyReward.tsx`（達成直後に「友だちを誘って一緒に合格。2人とも1週間Pro」カード＋共有ボタン）
- Modify: `src/screens/ProfileScreen.tsx`（常設の「友だち紹介」導線）
- Modify: `src/i18n/ja.json`（`referral.*` を ja のみ）
- Modify: `App.tsx`（`Referral` ルート登録・`presentation:'modal'`）／`src/navigation/types.ts`

**Interfaces:**
- Consumes: `getMyCode`, `reportQualified`（Task 8）、`isTriggerMet`（Task 3）。

- [ ] **Step 1:** `ReferralScreen`＝自分のコード（`getMyCode`）＋ `Share.share` で文面＋リンク／新規は初回コード手入力（`enteredCode` を state 保存）。
- [ ] **Step 2:** `AfterStudyReward` に紹介カード（Pro 実装フラグ or 常時。文言は ja.json `referral.invite_*`）。
- [ ] **Step 3:** `ProfileScreen` に「友だち紹介」行→ `Referral` へ。
- [ ] **Step 4:** アプリ側でトリガー成立を検知したら（`isTriggerMet(state.installedAt ?? now, state.referral?.qualifyingDays ?? [], now)`）`reportQualified` を1回呼ぶ（同期のタイミング。冪等なので多重でも安全）。サーバーが延ばした `pro_until` は次回同期で `state.entitlements.proUntil` に載り、既存 `proStatus` が `source:'referral'` として Pro 扱いする（クライアント新規実装は不要）。
- [ ] **Step 5:** `npx tsc --noEmit` → 0。手動確認: コード発行・共有・手入力・成立報告の一連。
- [ ] **Step 6: Commit** — `git commit -am "feat(referral): 導線UI(達成直後カード/コード共有/手入力)と成立報告"`

---

## フェーズ2（本番・別途）: ディープリンク・ペイウォール・運用

- iOS Universal Links / Android App Links ＋ 遅延ディープリンクで**インストール後に自動でコード付与**。
- Pro 実装後、ペイウォールに「友だちを誘えば1週間無料Pro」導線。
- 通知（拡散側への成立通知）、付与上限（`reward_grant_count` にしきい値）、受取時アカウント必須化（フラグ切替）。
- ※フェーズ2は Pro 本実装とディープリンク基盤が前提。別プランに分割する。

---

## Self-Review

- **Spec coverage:** §2 の決定（無制限=Task5/7 の集計のみ／ソフト誘導=Task9 の手入力・非必須）✓、§4 トリガー=Task3 ✓、§5 データ=Task5 ✓、§6 付与=Task7 ✓、§7 不正=Task7 の自己紹介/冪等 ✓、§10 フェーズ=0/1 網羅・2は将来。Gap: サーバー側の学習日記録テーブルは Task7 で「同期テーブルと突き合わせ」と前提化（既存 `user_state` 同期に qualifying_days を載せる詳細はフェーズ1実装時に確定）。
- **Placeholder scan:** TBD/TODO なし。Task7 のヒューリスティックは「端末/課金/IP」を明示。
- **Type consistency:** `proUntil`（client state）/ `pro_until`（DB列）は境界で変換、命名は各層で一貫。`isTriggerMet(installDate, qualifyingDays, now)` はクライアント検知とサーバー再計算で同一シグネチャ。

## Execution Handoff

Pro 本実装はマネタイズ方針（アプリ完成が先）待ちのため、**着手はユーザーの合図後**。実行時は Subagent-Driven（推奨）または Inline（executing-plans）で Task 単位に進める。
