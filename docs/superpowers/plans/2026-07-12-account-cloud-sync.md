# アカウント作成＋クラウド同期（段階1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定タブからメール＋パスワードでアカウントを作成でき、学習データ全体（`AppState`）をSupabaseへ後勝ち(LWW)でバックアップ／別端末で復元できるようにする。

**Architecture:** 既存のローカル永続（AsyncStorage・単一 `AppState`）は即時真実として不変。その上に「クラウド・バックアップ層」を載せる。状態に単調増加の `updatedAt` を1つ持たせ、ログイン時にリモートとローカルを比較して新しい方を採用（`chooseNewer`）。以降はローカル変更をデバウンスしてクラウドへ push。認証・同期の副作用は `SyncProvider` が担い、純粋ロジック（`chooseNewer`／`mapAuthError`）は node でテストする。

**Tech Stack:** Expo/React Native + TypeScript / `@supabase/supabase-js`（Auth＋Postgres）/ `react-native-url-polyfill` / AsyncStorage（セッション永続・既存）/ React Context。テスト＝`node --import tsx --test`。

## Global Constraints

- gitルートは `app/`。Build番号 = `1000 + git rev-list --count HEAD`。「ビルドして」＝ iOS(TestFlight submit) ＋ Android(AAB) 両方。
- 新規テストファイルは必ず `app/package.json` の `"test"` スクリプト（`node --import tsx --test ...`）へ追記する。
- アプリに埋め込むキーは **anon/publishable のみ**（公開安全）。`service_role` は絶対にアプリへ入れない（Edge Function のサーバ環境変数のみ）。
- Supabase Project URL = `https://nxovouiqelynryumjvyq.supabase.co` / anon key = `sb_publishable_bfqPNA4Z83i87E99YLwUyQ_I5NFMC3v`。
- 認証＝メール＋パスワード。**確認メール ON**（サインアップ→確認メール→ログインの2段）。同期＝**後勝ち(LWW)ブロブ**。段階2(Google/Apple)・段階3(マージ)は対象外。
- i18n はフラットなドット記法キー。基準 `ja.json`、`ja→key` フォールバック。今回 ja/en/ne を用意。**文言に個人名を使わない（役割ベース）**。JSONは各行1スペースインデント。
- 純粋ロジック用モジュールは Supabase クライアント（`config/supabase.ts`＝AsyncStorage/ネイティブ依存）を **import しない**こと（node テストを壊さないため）。

---

### Task 1: Supabase クライアント基盤（依存追加＋config＋polyfill）

**Files:**
- Modify: `app/package.json`（dependencies）
- Modify: `app/index.ts`
- Create: `app/src/config/supabase.ts`

**Interfaces:**
- Produces: `supabase`（`@supabase/supabase-js` の `SupabaseClient`）を `app/src/config/supabase.ts` から named export。

- [ ] **Step 1: 依存を追加**

`app/` で実行:

```bash
cd app && npm install @supabase/supabase-js react-native-url-polyfill
```

Expected: `package.json` の dependencies に両パッケージが入る。

- [ ] **Step 2: URL polyfill を最初に読み込む**

`app/index.ts` を次に置き換える（先頭に polyfill を追加）:

```ts
import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

- [ ] **Step 3: Supabase クライアントを作る**

`app/src/config/supabase.ts` を新規作成:

```ts
// Supabaseクライアント(単一)。セッションは AsyncStorage に永続。
// 埋め込むのは公開安全な anon/publishable キーのみ(RLSでデータ保護)。service_roleは絶対に置かない。
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nxovouiqelynryumjvyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bfqPNA4Z83i87E99YLwUyQ_I5NFMC3v';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // RNではURLにセッションは載らない
  },
});
```

- [ ] **Step 4: 型チェック**

Run: `cd app && npm run tsc`
Expected: エラーなし（緑）。

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json app/index.ts app/src/config/supabase.ts
git commit -m "feat(account): Supabaseクライアント基盤(config+url-polyfill)"
```

---

### Task 2: `AppState.updatedAt` ＋ `withUpdatedAt`（保存時スタンプ）

**Files:**
- Modify: `app/src/store/state.ts:59-92`
- Modify: `app/src/store/store.tsx:98-100`
- Create: `app/src/store/updatedAt.test.ts`
- Modify: `app/package.json`（test スクリプト）

**Interfaces:**
- Produces: `AppState.updatedAt?: number`（epoch ms・LWW比較の基準。旧stateには無い→未定義=0扱い）。`withUpdatedAt(state: AppState, now: number): AppState`（純関数）。

- [ ] **Step 1: 失敗するテストを書く**

`app/src/store/updatedAt.test.ts` を新規作成:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withUpdatedAt, INITIAL_STATE, type AppState } from './state';

test('withUpdatedAt sets updatedAt and preserves other fields', () => {
  const s: AppState = { ...INITIAL_STATE, streak: { ...INITIAL_STATE.streak, current: 5 } };
  const out = withUpdatedAt(s, 1_700_000_000_000);
  assert.equal(out.updatedAt, 1_700_000_000_000);
  assert.equal(out.streak.current, 5); // 他は不変
  assert.equal(out.version, s.version);
});

test('withUpdatedAt does not mutate input', () => {
  const s: AppState = { ...INITIAL_STATE };
  const out = withUpdatedAt(s, 123);
  assert.notEqual(out, s);
  assert.equal(s.updatedAt, undefined);
});
```

- [ ] **Step 2: テストを test スクリプトに追加して失敗を確認**

`app/package.json` の `"test"` 末尾（`src/data/cardFaceReadings.test.ts` の直後）に ` src/store/updatedAt.test.ts` を追記。

Run: `cd app && node --import tsx --test src/store/updatedAt.test.ts`
Expected: FAIL（`withUpdatedAt` が未export）。

- [ ] **Step 3: 型とヘルパーを実装**

`app/src/store/state.ts` の `AppState` インターフェイスに `updatedAt` を追加（`myList?` の下）:

```ts
  myList?: SaveRef[]; // my単語帳(保存した語/文法)。旧stateには無い→省略可(実質[])。
  updatedAt?: number; // 最終更新(epoch ms)。クラウド同期のLWW比較基準。旧stateには無い→0扱い。
}
```

同ファイルの `toggleMyList` の直前（または `isInMyList` の後）に純関数を追加:

```ts
/** 保存/同期用に updatedAt を刻んだ複製を返す(純関数・入力は不変)。 */
export function withUpdatedAt(state: AppState, now: number): AppState {
  return { ...state, updatedAt: now };
}
```

- [ ] **Step 4: ローカル保存時に updatedAt を刻む**

`app/src/store/store.tsx` の import に `withUpdatedAt` を追加:

```ts
import { type AppState, type Settings, type MockResult, type SaveRef, INITIAL_STATE, dayStr, toggleMyList, withUpdatedAt } from './state';
```

保存 effect（現 98-100 行）を次に変更:

```ts
  // 変更を永続化(復元前は保存しない=初期値で上書きしない)。保存の都度 updatedAt を刻む(同期のLWW基準)。
  useEffect(() => {
    if (hydrated) saveState(withUpdatedAt(state, Date.now()));
  }, [state, hydrated]);
```

- [ ] **Step 5: テストが通ることを確認**

Run: `cd app && node --import tsx --test src/store/updatedAt.test.ts`
Expected: PASS（2件）。

- [ ] **Step 6: 型チェック**

Run: `cd app && npm run tsc`
Expected: 緑。

- [ ] **Step 7: Commit**

```bash
git add app/src/store/state.ts app/src/store/store.tsx app/src/store/updatedAt.test.ts app/package.json
git commit -m "feat(account): AppState.updatedAt と保存時スタンプ(LWW基準)"
```

---

### Task 3: 同期の純粋ロジック `chooseNewer`

**Files:**
- Create: `app/src/auth/sync.ts`
- Create: `app/src/auth/sync.test.ts`
- Modify: `app/package.json`（test スクリプト）

**Interfaces:**
- Consumes: `AppState`（`../store/state` から type import のみ）。
- Produces: `chooseNewer(local: AppState, remote: AppState | null): 'local' | 'remote'`。`SYNC_TABLE = 'user_state'`（const）。

- [ ] **Step 1: 失敗するテストを書く**

`app/src/auth/sync.test.ts` を新規作成:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseNewer } from './sync';
import { INITIAL_STATE, type AppState } from '../store/state';

const at = (ts?: number): AppState => ({ ...INITIAL_STATE, updatedAt: ts });

test('remote が無ければ local', () => {
  assert.equal(chooseNewer(at(100), null), 'local');
});
test('remote が新しければ remote', () => {
  assert.equal(chooseNewer(at(100), at(200)), 'remote');
});
test('local が新しければ local', () => {
  assert.equal(chooseNewer(at(300), at(200)), 'local');
});
test('同値は local(既存を優先)', () => {
  assert.equal(chooseNewer(at(200), at(200)), 'local');
});
test('updatedAt 未定義は 0 扱い', () => {
  assert.equal(chooseNewer(at(undefined), at(1)), 'remote');
  assert.equal(chooseNewer(at(undefined), at(undefined)), 'local');
});
```

- [ ] **Step 2: test スクリプトへ追加して失敗を確認**

`app/package.json` の `"test"` 末尾に ` src/auth/sync.test.ts` を追記。

Run: `cd app && node --import tsx --test src/auth/sync.test.ts`
Expected: FAIL（`sync.ts` が無い）。

- [ ] **Step 3: 実装**

`app/src/auth/sync.ts` を新規作成:

```ts
// 同期の純粋ロジック(Supabaseクライアントを import しない=node テスト可)。
import type { AppState } from '../store/state';

export const SYNC_TABLE = 'user_state';

/** LWW: リモートが厳密に新しい時だけ remote。無い/同値/古い時は local。 */
export function chooseNewer(local: AppState, remote: AppState | null): 'local' | 'remote' {
  if (!remote) return 'local';
  const l = local.updatedAt ?? 0;
  const r = remote.updatedAt ?? 0;
  return r > l ? 'remote' : 'local';
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd app && node --import tsx --test src/auth/sync.test.ts`
Expected: PASS（5件）。

- [ ] **Step 5: Commit**

```bash
git add app/src/auth/sync.ts app/src/auth/sync.test.ts app/package.json
git commit -m "feat(account): 同期LWWの純関数 chooseNewer(+テスト)"
```

---

### Task 4: 認証エラー→i18nキー写像 `mapAuthError`

**Files:**
- Create: `app/src/auth/authErrors.ts`
- Create: `app/src/auth/authErrors.test.ts`
- Modify: `app/package.json`（test スクリプト）

**Interfaces:**
- Produces: `mapAuthError(message: string | undefined): string`（返り値は i18n キー文字列）。

- [ ] **Step 1: 失敗するテストを書く**

`app/src/auth/authErrors.test.ts` を新規作成:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapAuthError } from './authErrors';

test('登録済み', () => {
  assert.equal(mapAuthError('User already registered'), 'account.err_taken');
});
test('資格情報不正', () => {
  assert.equal(mapAuthError('Invalid login credentials'), 'account.err_invalid');
});
test('メール未確認', () => {
  assert.equal(mapAuthError('Email not confirmed'), 'account.err_unconfirmed');
});
test('弱いパスワード', () => {
  assert.equal(mapAuthError('Password should be at least 8 characters'), 'account.err_weak_pw');
});
test('ネットワーク', () => {
  assert.equal(mapAuthError('Network request failed'), 'account.err_network');
});
test('未知/未定義は汎用', () => {
  assert.equal(mapAuthError(undefined), 'account.err_invalid');
  assert.equal(mapAuthError('something weird'), 'account.err_invalid');
});
```

- [ ] **Step 2: test スクリプトへ追加して失敗を確認**

`app/package.json` の `"test"` 末尾に ` src/auth/authErrors.test.ts` を追記。

Run: `cd app && node --import tsx --test src/auth/authErrors.test.ts`
Expected: FAIL（`authErrors.ts` が無い）。

- [ ] **Step 3: 実装**

`app/src/auth/authErrors.ts` を新規作成:

```ts
// Supabase認証エラーの message を i18n キーへ写像(純関数・依存なし)。
export function mapAuthError(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already')) {
    return 'account.err_taken';
  }
  if (m.includes('email not confirmed') || m.includes('not confirmed')) return 'account.err_unconfirmed';
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'account.err_invalid';
  if (m.includes('password') && (m.includes('at least') || m.includes('should be') || m.includes('weak') || m.includes('6 characters') || m.includes('8 characters'))) {
    return 'account.err_weak_pw';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('timeout') || m.includes('failed to')) return 'account.err_network';
  return 'account.err_invalid';
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `cd app && node --import tsx --test src/auth/authErrors.test.ts`
Expected: PASS（6件）。

- [ ] **Step 5: Commit**

```bash
git add app/src/auth/authErrors.ts app/src/auth/authErrors.test.ts app/package.json
git commit -m "feat(account): 認証エラーのi18n写像 mapAuthError(+テスト)"
```

---

### Task 5: 認証・同期の Supabase ラッパ（`authClient` / `syncClient`）

**Files:**
- Create: `app/src/auth/authClient.ts`
- Create: `app/src/auth/syncClient.ts`

**Interfaces:**
- Consumes: `supabase`（Task 1）、`SYNC_TABLE`（Task 3）、`AppState`/`STATE_VERSION`（`../store/state`）。
- Produces:
  - `authClient`: `signUp(email,password): Promise<{ error?: string; needsConfirm: boolean }>` / `signIn(email,password): Promise<{ error?: string }>` / `signOut(): Promise<void>` / `getSession(): Promise<Session | null>` / `onAuthStateChange(cb:(s:Session|null)=>void): () => void` / `deleteAccount(userId: string): Promise<void>`。
  - `syncClient`: `pullState(userId: string): Promise<AppState | null>` / `pushState(userId: string, state: AppState): Promise<void>`。
- 注: これらは Supabase を直接叩く副作用モジュールのためユニットテスト対象外（`tsc` と手動/実機で検証）。純ロジックは Task 3/4 で分離済み。

- [ ] **Step 1: authClient を実装**

`app/src/auth/authClient.ts` を新規作成:

```ts
// Supabase Auth の薄いラッパ。UIから supabase を直接触らせない。
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { SYNC_TABLE } from './sync';

export async function signUp(email: string, password: string): Promise<{ error?: string; needsConfirm: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message, needsConfirm: false };
  // 確認メールON: session は null(=確認待ち)。
  return { needsConfirm: !data.session };
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(cb: (s: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/** 認証ユーザー削除。Edge Function を試み、失敗時は自分のデータ行削除にフォールバック。最後に必ずサインアウト。 */
export async function deleteAccount(userId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) throw error;
  } catch {
    await supabase.from(SYNC_TABLE).delete().eq('user_id', userId);
  }
  await supabase.auth.signOut();
}
```

- [ ] **Step 2: syncClient を実装**

`app/src/auth/syncClient.ts` を新規作成:

```ts
// クラウド状態の pull/push(Supabase Postgres)。1ユーザー=1行(upsert)。
import { supabase } from '../config/supabase';
import { SYNC_TABLE } from './sync';
import { type AppState, STATE_VERSION } from '../store/state';

export async function pullState(userId: string): Promise<AppState | null> {
  const { data, error } = await supabase
    .from(SYNC_TABLE)
    .select('state, client_updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const st = data.state as AppState;
  return { ...st, updatedAt: (data.client_updated_at as number) ?? st.updatedAt ?? 0 };
}

export async function pushState(userId: string, state: AppState): Promise<void> {
  await supabase.from(SYNC_TABLE).upsert({
    user_id: userId,
    state,
    client_updated_at: state.updatedAt ?? 0,
    version: STATE_VERSION,
    updated_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 3: 型チェック**

Run: `cd app && npm run tsc`
Expected: 緑。

- [ ] **Step 4: Commit**

```bash
git add app/src/auth/authClient.ts app/src/auth/syncClient.ts
git commit -m "feat(account): 認証/同期のSupabaseラッパ(authClient/syncClient)"
```

---

### Task 6: `hydrate` アクション ＋ `SyncProvider`（アプリ結線）

**Files:**
- Modify: `app/src/store/store.tsx:119-140`
- Create: `app/src/auth/SyncProvider.tsx`
- Modify: `app/App.tsx:202-208`

**Interfaces:**
- Consumes: `useAppState`/`useHydrated`/`useAppActions`（store）、`getSession`/`onAuthStateChange`（authClient）、`pullState`/`pushState`（syncClient）、`chooseNewer`（sync）、`supabase`（config）。
- Produces:
  - `useAppActions().hydrate(state: AppState): void`（`HYDRATE` を dispatch）。
  - `SyncProvider`（React コンポーネント）＋ `useSync(): { session: Session | null; email: string | null; lastSyncedAt: number | null }`。

- [ ] **Step 1: store に hydrate アクションを公開**

`app/src/store/store.tsx` の `useAppActions` 内（`reset:` の前）に追加:

```ts
    hydrate: (s: AppState) => dispatch({ type: 'HYDRATE', state: s }),
```

（`HYDRATE` は既存の reducer branch を再利用。新規 Action 型は不要。）

- [ ] **Step 2: SyncProvider を実装**

`app/src/auth/SyncProvider.tsx` を新規作成:

```tsx
// 認証セッションを購読し、ログイン中は AppState をクラウドへ pull/push(デバウンス)する副作用層。
// ローカル永続(store)は不変。ここは「その上のバックアップ層」。
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { getSession, onAuthStateChange } from './authClient';
import { pullState, pushState } from './syncClient';
import { chooseNewer } from './sync';
import { useAppState, useAppActions, useHydrated } from '../store/store';

type SyncCtx = { session: Session | null; email: string | null; lastSyncedAt: number | null };
const Ctx = createContext<SyncCtx>({ session: null, email: null, lastSyncedAt: null });
export function useSync(): SyncCtx {
  return useContext(Ctx);
}

const PUSH_DEBOUNCE_MS = 3000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const state = useAppState();
  const hydrated = useHydrated();
  const { hydrate } = useAppActions();
  const [session, setSession] = useState<Session | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const localTsRef = useRef<number>(state.updatedAt ?? 0);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ローカル変更時刻を追跡(LWW比較のローカル側)。
  useEffect(() => {
    localTsRef.current = Date.now();
  }, [state]);

  // セッション取得＋購読＋RN前後でトークン自動更新を制御。
  useEffect(() => {
    void getSession().then(setSession);
    const unsub = onAuthStateChange((s) => setSession(s));
    supabase.auth.startAutoRefresh();
    const rn = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      unsub();
      rn.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  // ログイン確立時: リモートを引いて新しい方を採用(remote採用→hydrate、そうでなければ push)。
  useEffect(() => {
    if (!session || !hydrated) return;
    let cancelled = false;
    (async () => {
      const remote = await pullState(session.user.id);
      if (cancelled) return;
      const local = { ...stateRef.current, updatedAt: Math.max(stateRef.current.updatedAt ?? 0, localTsRef.current) };
      if (chooseNewer(local, remote) === 'remote' && remote) {
        hydrate(remote);
      } else {
        await pushState(session.user.id, local);
      }
      if (!cancelled) setLastSyncedAt(Date.now());
    })();
    return () => {
      cancelled = true;
    };
  }, [session, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ログイン中のローカル変更: デバウンスして push。
  useEffect(() => {
    if (!session || !hydrated) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      const local = { ...stateRef.current, updatedAt: Date.now() };
      void pushState(session.user.id, local).then(() => setLastSyncedAt(Date.now()));
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state, session, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={{ session, email: session?.user?.email ?? null, lastSyncedAt }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 3: App.tsx で SyncProvider を結線**

`app/App.tsx` の import に追加（`AppProvider` import 行の下）:

```ts
import { SyncProvider } from './src/auth/SyncProvider';
```

`App` 関数の provider ネストを次に変更（`AppProvider` 直下に `SyncProvider`）:

```tsx
  return (
    <AppProvider>
      <SyncProvider>
        <SafeAreaProvider>
          <Root />
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </SyncProvider>
    </AppProvider>
  );
```

- [ ] **Step 4: 型チェック**

Run: `cd app && npm run tsc`
Expected: 緑。

- [ ] **Step 5: 既存テスト全体が壊れていないか確認**

Run: `cd app && npm test`
Expected: 全 PASS（既存＋Task2-4 の新規テスト）。

- [ ] **Step 6: Commit**

```bash
git add app/src/store/store.tsx app/src/auth/SyncProvider.tsx app/App.tsx
git commit -m "feat(account): SyncProvider(pull/push)とhydrateアクションを結線"
```

---

### Task 7: i18n キー（ja / en / ne ＋ プライバシー追記キー）

**Files:**
- Modify: `app/src/i18n/ja.json`
- Modify: `app/src/i18n/en.json`
- Modify: `app/src/i18n/ne.json`

**Interfaces:**
- Produces: `account.*` と `profile.account_section` / `profile.privacyAccount` の各キー（Task 8/9 が消費）。

- [ ] **Step 1: ja.json にキーを追加**

`app/src/i18n/ja.json` の先頭 `{` の直後（`"badges.collection_title"` 行の前）に、各行1スペースインデントで追加:

```json
 "account.title": "アカウント",
 "account.section": "アカウント",
 "account.tab_signup": "新規作成",
 "account.tab_login": "ログイン",
 "account.email": "メールアドレス",
 "account.password": "パスワード",
 "account.pw_hint": "8文字以上",
 "account.cta_create": "アカウントを作成",
 "account.cta_login": "ログイン",
 "account.logout": "ログアウト",
 "account.delete": "アカウントを削除",
 "account.delete_confirm": "本当に削除しますか？（元に戻せません）",
 "account.benefit_title": "アカウントを作成してデータを守る",
 "account.benefit_sub": "機種変更しても学習の記録を引き継げます",
 "account.hero_hello": "ようこそ！学習の記録を大切にお預かりします。",
 "account.synced_at": "最終同期: {t}",
 "account.not_synced": "まだ同期していません",
 "account.confirm_sent": "確認メールを送りました",
 "account.confirm_hint": "メール内のリンクを開いて確認してから、ログインしてください。",
 "account.err_invalid": "メールアドレスまたはパスワードが正しくありません。",
 "account.err_taken": "このメールアドレスは既に登録されています。",
 "account.err_network": "通信に失敗しました。接続を確認してください。",
 "account.err_weak_pw": "パスワードは8文字以上にしてください。",
 "account.err_unconfirmed": "メールの確認が済んでいません。届いたリンクを開いてください。",
 "profile.account_section": "アカウント",
 "profile.privacyAccount": "アカウントを作成した場合、メールアドレスと学習データは日本国内（東京リージョン）のSupabaseサーバーに保存され、バックアップと機種変更時の復元に使われます。アプリ内の「アカウントを削除」からいつでも削除できます。",
```

- [ ] **Step 2: en.json に同キーを追加**

`app/src/i18n/en.json` の先頭 `{` の直後に、各行1スペースインデントで追加:

```json
 "account.title": "Account",
 "account.section": "Account",
 "account.tab_signup": "Sign up",
 "account.tab_login": "Log in",
 "account.email": "Email",
 "account.password": "Password",
 "account.pw_hint": "At least 8 characters",
 "account.cta_create": "Create account",
 "account.cta_login": "Log in",
 "account.logout": "Log out",
 "account.delete": "Delete account",
 "account.delete_confirm": "Delete for good? This cannot be undone.",
 "account.benefit_title": "Create an account to protect your data",
 "account.benefit_sub": "Keep your progress even when you change devices",
 "account.hero_hello": "Welcome! Your progress will be kept safe.",
 "account.synced_at": "Last synced: {t}",
 "account.not_synced": "Not synced yet",
 "account.confirm_sent": "Confirmation email sent",
 "account.confirm_hint": "Open the link in the email to confirm, then log in.",
 "account.err_invalid": "Email or password is incorrect.",
 "account.err_taken": "This email is already registered.",
 "account.err_network": "Connection failed. Please check your network.",
 "account.err_weak_pw": "Password must be at least 8 characters.",
 "account.err_unconfirmed": "Email not confirmed yet. Please open the link we sent.",
 "profile.account_section": "Account",
 "profile.privacyAccount": "If you create an account, your email and learning data are stored on Supabase servers (Tokyo region) and used for backup and restoring on a new device. You can delete them anytime from \"Delete account\" in the app.",
```

- [ ] **Step 3: ne.json に同キーを追加**

`app/src/i18n/ne.json` の先頭 `{` の直後に、各行1スペースインデントで追加:

```json
 "account.title": "खाता",
 "account.section": "खाता",
 "account.tab_signup": "दर्ता",
 "account.tab_login": "लगइन",
 "account.email": "इमेल",
 "account.password": "पासवर्ड",
 "account.pw_hint": "कम्तिमा ८ अक्षर",
 "account.cta_create": "खाता बनाउनुहोस्",
 "account.cta_login": "लगइन",
 "account.logout": "लगआउट",
 "account.delete": "खाता मेट्नुहोस्",
 "account.delete_confirm": "साँच्चै मेट्ने? यो फिर्ता गर्न सकिँदैन।",
 "account.benefit_title": "डेटा सुरक्षित गर्न खाता बनाउनुहोस्",
 "account.benefit_sub": "फोन बदल्दा पनि प्रगति जोगिन्छ",
 "account.hero_hello": "स्वागत छ! तपाईंको प्रगति सुरक्षित राखिनेछ।",
 "account.synced_at": "अन्तिम सिंक: {t}",
 "account.not_synced": "अझै सिंक भएको छैन",
 "account.confirm_sent": "पुष्टि इमेल पठाइयो",
 "account.confirm_hint": "इमेलको लिंक खोलेर पुष्टि गरेपछि लगइन गर्नुहोस्।",
 "account.err_invalid": "इमेल वा पासवर्ड मिलेन।",
 "account.err_taken": "यो इमेल पहिले नै दर्ता भइसकेको छ।",
 "account.err_network": "जडान असफल भयो। नेटवर्क जाँच्नुहोस्।",
 "account.err_weak_pw": "पासवर्ड कम्तिमा ८ अक्षरको हुनुपर्छ।",
 "account.err_unconfirmed": "इमेल अझै पुष्टि भएको छैन। पठाइएको लिंक खोल्नुहोस्।",
 "profile.account_section": "खाता",
 "profile.privacyAccount": "खाता बनाउनुभयो भने तपाईंको इमेल र सिकाइ डेटा Supabase सर्भर (टोकियो) मा राखिन्छ, ब्याकअप र नयाँ फोनमा पुनःस्थापनाका लागि प्रयोग हुन्छ। एपको \"खाता मेट्नुहोस्\" बाट जुनसुकै बेला मेट्न सकिन्छ।",
```

- [ ] **Step 4: JSON が壊れていないか型/読込確認**

Run: `cd app && npm run tsc`
Expected: 緑（各 JSON は import 済み。パース不正なら失敗する）。

- [ ] **Step 5: Commit**

```bash
git add app/src/i18n/ja.json app/src/i18n/en.json app/src/i18n/ne.json
git commit -m "feat(account): アカウント関連 i18n(ja/en/ne)＋プライバシー追記"
```

---

### Task 8: `AccountScreen`（メール認証・確認メールON・桜巫女）＋ ルート追加

**Files:**
- Create: `app/src/screens/AccountScreen.tsx`
- Modify: `app/src/navigation/types.ts:4-19`
- Modify: `app/App.tsx`（import＋RootStack.Screen）

**Interfaces:**
- Consumes: `signUp`/`signIn`（authClient）、`mapAuthError`（authErrors）、`useSync`（SyncProvider）、`useT`（i18n）、`useColors`/`spacing`/`radius`/`type`（theme）、`GUIDE`（`../data/mywordsArt`）。
- Produces: RootStack ルート `Account`（`undefined` パラメータ）。

- [ ] **Step 1: ナビ型に Account を追加**

`app/src/navigation/types.ts` の `RootStackParamList` に1行追加（`Onboarding: undefined;` の下あたり）:

```ts
  Account: undefined; // アカウント作成/ログイン(段階1: メール+パスワード)
```

- [ ] **Step 2: AccountScreen を実装**

`app/src/screens/AccountScreen.tsx` を新規作成:

```tsx
// アカウント作成/ログイン(段階1)。メール+パスワード。確認メールON=新規作成後は確認案内→ログイン。
// 案内=桜の巫女(既存アセット GUIDE.open)。文言は i18n(個人名を使わない)。
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';
import { signUp, signIn } from '../auth/authClient';
import { mapAuthError } from '../auth/authErrors';
import { GUIDE } from '../data/mywordsArt';

type Tab = 'signup' | 'login';

export default function AccountScreen() {
  const t = useT();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation();
  const [tab, setTab] = useState<Tab>('signup');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [errKey, setErrKey] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const submit = async () => {
    setErrKey(null);
    setConfirmSent(false);
    setBusy(true);
    try {
      if (tab === 'signup') {
        const r = await signUp(email.trim(), pw);
        if (r.error) { setErrKey(mapAuthError(r.error)); return; }
        if (r.needsConfirm) { setConfirmSent(true); setTab('login'); return; }
        nav.goBack(); // 確認不要設定なら即ログイン→戻る
      } else {
        const r = await signIn(email.trim(), pw);
        if (r.error) { setErrKey(mapAuthError(r.error)); return; }
        nav.goBack(); // ログイン成功→設定へ戻る(SyncProviderがpull/push)
      }
    } catch {
      setErrKey('account.err_network');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = email.trim().length > 3 && pw.length >= 8 && !busy;

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Pressable style={s.close} onPress={() => nav.goBack()} hitSlop={12}>
            <Text style={s.closeTxt}>✕</Text>
          </Pressable>

          <View style={s.hero}>
            <Image source={GUIDE.open} style={s.guide} resizeMode="contain" />
            <Text style={s.benefitTitle}>{t('account.benefit_title')}</Text>
            <Text style={s.benefitSub}>{t('account.benefit_sub')}</Text>
          </View>

          <View style={s.tabs}>
            {(['signup', 'login'] as const).map((tb) => (
              <Pressable key={tb} onPress={() => { setTab(tb); setErrKey(null); }} style={[s.tab, tab === tb && s.tabOn]}>
                <Text style={[s.tabTxt, tab === tb && s.tabTxtOn]}>{t(tb === 'signup' ? 'account.tab_signup' : 'account.tab_login')}</Text>
              </Pressable>
            ))}
          </View>

          {confirmSent ? (
            <View style={s.notice}>
              <Text style={s.noticeTitle}>{t('account.confirm_sent')}</Text>
              <Text style={s.noticeBody}>{t('account.confirm_hint')}</Text>
            </View>
          ) : null}

          <Text style={s.label}>{t('account.email')}</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            placeholder="you@example.com"
            placeholderTextColor={c.faint}
          />

          <Text style={s.label}>{t('account.password')}</Text>
          <TextInput
            style={s.input}
            value={pw}
            onChangeText={setPw}
            secureTextEntry
            autoCapitalize="none"
            placeholder={t('account.pw_hint')}
            placeholderTextColor={c.faint}
          />

          {errKey ? <Text style={s.err}>{t(errKey)}</Text> : null}

          <Pressable style={[s.cta, !canSubmit && s.ctaOff]} onPress={submit} disabled={!canSubmit}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <Text style={s.ctaTxt}>{t(tab === 'signup' ? 'account.cta_create' : 'account.cta_login')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    body: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
    close: { alignSelf: 'flex-end', padding: spacing.xs },
    closeTxt: { fontSize: ty.h2, color: c.mute, fontWeight: '700' },
    hero: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
    guide: { width: 120, height: 134 },
    benefitTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
    benefitSub: { fontSize: ty.small, color: c.mute, textAlign: 'center' },
    tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    tabOn: { borderColor: c.blue, backgroundColor: c.blueLight },
    tabTxt: { fontSize: ty.body, color: c.ink2, fontWeight: '700' },
    tabTxtOn: { color: c.blueDark, fontWeight: '800' },
    notice: { backgroundColor: c.blueLight, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
    noticeTitle: { fontSize: ty.body, fontWeight: '800', color: c.blueDark },
    noticeBody: { fontSize: ty.small, color: c.ink2, lineHeight: 18 },
    label: { fontSize: ty.small, fontWeight: '700', color: c.ink2, marginTop: spacing.sm },
    input: { borderWidth: 1, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, fontSize: ty.body, color: c.ink },
    err: { fontSize: ty.small, color: c.red, marginTop: spacing.xs },
    cta: { marginTop: spacing.md, backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
    ctaOff: { opacity: 0.5 },
    ctaTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
  });
```

- [ ] **Step 3: App.tsx にルート登録**

`app/App.tsx` の import群に追加:

```ts
import AccountScreen from './src/screens/AccountScreen';
```

`RootStack.Navigator` の modal 群（`MyWords` の下）に追加:

```tsx
            <RootStack.Screen name="Account" component={AccountScreen} options={{ presentation: 'modal' }} />
```

- [ ] **Step 4: 型チェック**

Run: `cd app && npm run tsc`
Expected: 緑。（`spacing` は `xs/sm/md/lg/xl/xxl`、`radius` は `sm/md/lg/xl/pill` が既存＝本コードのキーは全て有効。）

- [ ] **Step 5: Commit**

```bash
git add app/src/screens/AccountScreen.tsx app/src/navigation/types.ts app/App.tsx
git commit -m "feat(account): AccountScreen(メール認証・確認メール案内・桜巫女)＋ルート"
```

---

### Task 9: `ProfileScreen` アカウントカード（未ログイン誘導／ログイン中）

**Files:**
- Modify: `app/src/screens/ProfileScreen.tsx`

**Interfaces:**
- Consumes: `useSync`（SyncProvider）、`signOut`/`deleteAccount`（authClient）、`useNavigation`、`GUIDE`（mywordsArt）、`useT`、theme。

- [ ] **Step 1: import を追加**

`app/src/screens/ProfileScreen.tsx` の import群に追加:

```ts
import { Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSync } from '../auth/SyncProvider';
import { signOut, deleteAccount } from '../auth/authClient';
import { GUIDE } from '../data/mywordsArt';
```

（`react-native` から `Image` が既存 import に無ければ既存の分割 import に `Image` を足す。）

- [ ] **Step 2: フックと削除ハンドラを追加**

`ProfileScreen` 関数内、`const [showDl, setShowDl] = useState(false);` の下に追加:

```ts
  const nav = useNavigation();
  const { session, email, lastSyncedAt } = useSync();
  const [confirmDel, setConfirmDel] = useState(false);
  const syncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString()
    : t('account.not_synced');
  const onDelete = async () => {
    if (!session) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    await deleteAccount(session.user.id);
    setConfirmDel(false);
  };
```

- [ ] **Step 3: アカウントカードを描画**

`ProfileScreen` の `<Text style={s.title}>{t('profile.title')}</Text>` の直後に挿入:

```tsx
        {/* アカウント: 未ログイン=作成誘導(桜巫女) / ログイン中=メール・最終同期・ログアウト・削除 */}
        <View style={s.card}>
          {session ? (
            <>
              <Text style={s.setLbl}>{t('profile.account_section')}</Text>
              <Text style={s.acctEmail}>{email}</Text>
              <Text style={s.subtle}>{t('account.synced_at', { t: syncedLabel })}</Text>
              <Pressable style={s.linkRow} onPress={() => { void signOut(); }}>
                <Text style={s.linkTxt}>{t('account.logout')}</Text>
                <Text style={s.chev}>›</Text>
              </Pressable>
              <View style={s.linkDiv} />
              <Pressable style={s.linkRow} onPress={onDelete}>
                <Text style={[s.linkTxt, confirmDel && { color: c.red, fontWeight: '800' }]}>
                  {confirmDel ? t('account.delete_confirm') : t('account.delete')}
                </Text>
                <Text style={s.chev}>›</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={s.acctCta} onPress={() => nav.navigate('Account' as never)}>
              <Image source={GUIDE.open} style={s.acctGuide} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={s.acctTitle}>{t('account.benefit_title')}</Text>
                <Text style={s.subtle}>{t('account.benefit_sub')}</Text>
              </View>
              <Text style={s.chev}>›</Text>
            </Pressable>
          )}
        </View>
```

- [ ] **Step 4: プライバシー本文にアカウント条項を追記**

`ProfileScreen` のプライバシー展開部（`{legal === 'privacy' ? <Text style={s.legal}>{t('profile.privacyBody')}</Text> : null}`）を次に変更:

```tsx
          {legal === 'privacy' ? (
            <Text style={s.legal}>{t('profile.privacyBody')}{'\n\n'}{t('profile.privacyAccount')}</Text>
          ) : null}
```

- [ ] **Step 5: スタイルを追加**

`makeStyles` の `StyleSheet.create({ ... })` 内（`version` の前あたり）に追加:

```ts
    acctCta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    acctGuide: { width: 48, height: 54 },
    acctTitle: { fontSize: ty.body, fontWeight: '800', color: c.ink },
    acctEmail: { fontSize: ty.body, fontWeight: '700', color: c.ink, marginTop: spacing.xs },
```

- [ ] **Step 6: 型チェック**

Run: `cd app && npm run tsc`
Expected: 緑。

- [ ] **Step 7: 既存テスト全体を確認**

Run: `cd app && npm test`
Expected: 全 PASS。

- [ ] **Step 8: Commit**

```bash
git add app/src/screens/ProfileScreen.tsx
git commit -m "feat(account): 設定タブにアカウントカード(誘導/ログイン中・削除・同期表示)"
```

---

### Task 10: Supabase バックエンド定義（schema.sql ＋ RLS ＋ delete-account ＋ README）

**Files:**
- Create: `docs/supabase/schema.sql`
- Create: `docs/supabase/functions/delete-account/index.ts`
- Create: `docs/supabase/README.md`

**Interfaces:**
- Consumes: なし（アプリのビルドには影響しない・ユーザーが Supabase に適用する定義）。
- Produces: `public.user_state` テーブル＋RLS、Edge Function `delete-account`、適用手順。

- [ ] **Step 1: schema.sql を作成**

`docs/supabase/schema.sql` を新規作成:

```sql
-- public.user_state: 1ユーザー=1行。AppState全体をjsonbで保持(段階1・LWWバックアップ)。
-- Supabase の SQL Editor に貼り付けて実行する(CLI不要)。
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  client_updated_at int8 not null default 0,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- 自分の行のみ read/write。他人の行は一切見えない・触れない。
create policy "user_state own select" on public.user_state
  for select using (auth.uid() = user_id);
create policy "user_state own insert" on public.user_state
  for insert with check (auth.uid() = user_id);
create policy "user_state own update" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_state own delete" on public.user_state
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Edge Function を作成**

`docs/supabase/functions/delete-account/index.ts` を新規作成:

```ts
// アカウント完全削除(認証ユーザー削除)。認証済みJWTを受け、service_roleで auth.admin.deleteUser。
// user_state 行は auth.users への FK cascade で自動削除される(明示 delete も行い二重に担保)。
// service_role はこの関数のサーバ環境変数からのみ参照(アプリには絶対に置かない)。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  const admin = createClient(url, serviceRole);
  await admin.from('user_state').delete().eq('user_id', user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

- [ ] **Step 3: README（適用手順）を作成**

`docs/supabase/README.md` を新規作成:

```markdown
# Supabase 設定手順（まいにちJLPT・段階1）

## 1. テーブル＋RLS（必須・CLI不要）
Supabase ダッシュボード → SQL Editor → New query に `schema.sql` の中身を貼って **Run**。
`public.user_state` テーブルと4つのRLSポリシーが作成される。

## 2. 認証設定（必須）
Authentication → Providers → **Email = 有効**。
Authentication → **Confirm email = ON**（本人確認）。
Authentication → Policies → パスワード最小長 = 8。

## 3. Edge Function `delete-account`（アカウント完全削除・任意/後追い可）
Supabase CLI が必要:
```
supabase login
supabase link --project-ref nxovouiqelynryumjvyq
supabase functions deploy delete-account
```
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` は Supabase が自動注入する。
未デプロイでも、アプリは「自分のデータ行削除＋サインアウト」にフォールバックして動作する
（認証ユーザーの完全削除だけが後追いになる）。

## 4. 注意
- アプリに埋め込むのは anon/publishable キーのみ。**service_role は絶対にアプリへ入れない**。
- データ境界は RLS が唯一。全操作で `auth.uid() = user_id` を必須にしている。
```

- [ ] **Step 4: Commit**

```bash
git add docs/supabase/schema.sql docs/supabase/functions/delete-account/index.ts docs/supabase/README.md
git commit -m "docs(account): Supabaseスキーマ+RLS+delete-account Edge Function+手順"
```

> 注: `docs/` は git ルート(`app/`)の外。コミット対象にならない場合はリポジトリ運用に合わせ、`app/docs/supabase/` に置くか、リポジトリ管理外の定義として保持する（適用はダッシュボード/CLIで行うためアプリ動作には影響しない）。

---

## 検証（全タスク後）

- [ ] `cd app && npm test` — 既存＋新規（updatedAt/sync/authErrors）全 PASS。
- [ ] `cd app && npm run tsc` — 緑。
- [ ] Supabase に `schema.sql` を適用し Email/Confirm-email を設定（README手順）。
- [ ] 手動（実機/ブラウザ）: 設定タブ最上部にアカウントカード → 新規作成 → 「確認メールを送りました」表示 → 受信メールのリンクで確認 → ログイン → カードがメール表示＋「最終同期」に変わる。学習して別端末（or 再インストール）でログイン → 進捗が復元される。ログアウト・アカウント削除（確認2度押し）動作。
- [ ] ビルド: Build番号（`1000 + git rev-list --count HEAD`）を起動時に併記し、iOS(`ios-build-jlpt.yml` submit=true)＋Android(`android-build-jlpt.yml` aab=true) を起動。

---

## Self-Review

**1. Spec coverage（spec §1-11 と対応）**
- §1 段階1スコープ（メール認証＋LWWバックアップ/復元）→ Task 3/5/6。
- §2 アーキテクチャ（ローカル不変＋バックアップ層）→ Task 6（SyncProvider）。
- §3 Supabase構成（テーブル/RLS/Auth/Edge Function）→ Task 10。
- §3.3 確認メールON（サインアップ→確認→ログイン）→ Task 8（confirm_sent 表示）＋ Task 10 README。
- §4 `updatedAt`＋保存時スタンプ → Task 2。
- §5 クライアント構成（依存/polyfill/config/authClient/sync/SyncProvider）→ Task 1/3/4/5/6。
- §6 UI（アカウントカード／AccountScreen／ルート）→ Task 8/9。
- §7 アカウント削除（Edge Function＋行削除フォールバック）→ Task 5（deleteAccount）＋ Task 10。
- §8 i18n → Task 7。
- §9 テスト（chooseNewer/withUpdatedAt/mapAuthError＋package.json追記） → Task 2/3/4。
- §10 セキュリティ（anonのみ・RLS） → Task 1/10（constraints）。
- §11 成果物一覧 → 全タスクで網羅。

**2. Placeholder scan:** TBD/TODO/曖昧指示なし。各コード手順に実コードを記載。theme のキー（`spacing.xs/sm/md/lg/xl/xxl`・`radius.sm/md/lg/xl/pill`）は実測済みで全て有効。

**3. Type consistency:** `chooseNewer(local, remote): 'local'|'remote'` は Task 3 定義＝Task 6 消費で一致。`withUpdatedAt(state, now)` は Task 2 定義＝Task 5/6 消費で一致。`signUp` の戻り `{ error?, needsConfirm }` は Task 5 定義＝Task 8 消費で一致。`useSync()` の `{ session, email, lastSyncedAt }` は Task 6 定義＝Task 9 消費で一致。`SYNC_TABLE` は Task 3 定義＝Task 5 消費で一致。
</content>
