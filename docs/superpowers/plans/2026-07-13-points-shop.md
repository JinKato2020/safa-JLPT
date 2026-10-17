# ポイント（桜貝）＆ショップ 段階1 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 学習で貯まる内部通貨「桜貝」と、着せ替え専用ショップ（段階1＝ステータス枠スキン）を導入する。

**Architecture:** AppState に wallet/owned/equipped/claimedMilestones/dailyEarn を追加。付与・購入・装備は `src/store/wallet.ts` の純関数（テスト可能）に集約し、reducer から呼ぶ。既存の学習フロー（quizAnswer/mockAnswer/recordKakitori/学習日確定/tier）にフックして桜貝を付与。ショップは RootStack モーダル。装備中の枠は FramedPanel が反映。

**Tech Stack:** React Native / Expo SDK54 / TypeScript。テスト = `node --import tsx --test`（新規 *.test.ts は `app/package.json` の "test" に追記）。gitルート = `app/`。

## Global Constraints
- 非ペイ・トゥ・ウィン：ショップは**着せ替えのみ**（消耗品なし・連続フリーズは非売品）。既存の無料着せ替え（theme/font/badgeSet 現行選択肢）は無料のまま。
- 桜貝は**学習で稼ぐ内部通貨**。実課金でのポイント購入はしない。Pro課金とは別軸。
- 付与レート（円換算でなく桜貝）：正解 +2（1日上限 300）／完了 +15／模試 +50／漢字マスター +5／毎日初回 +10／7日 +50／30日 +200／tier昇格 +100／合格率50・70・80%到達 各+150／覚えた語100ごと +30。
- 節目（streak7/streak30/tierN/pass50/70/80/learned100…）は `claimedMilestones` で**各1回**。
- 全 AppState 追加フィールドは optional（旧state互換）。購入/装備で `updatedAt` 更新（Supabase LWW同期）。
- i18n は ja/en/ne を用意、他は ja フォールバック。

---

### Task 1: AppState に通貨・所有・装備を追加

**Files:**
- Modify: `app/src/store/state.ts`（AppState interface ＋ INITIAL_STATE）

**Interfaces:**
- Produces: `AppState.wallet?: { points: number }`, `owned?: string[]`, `equipped?: { frame?: string; outfit?: string; petal?: string; theme?: string; badge?: string }`, `claimedMilestones?: string[]`, `dailyEarn?: { day: string; amount: number }`

- [ ] **Step 1: AppState に追加**（`myList?` の直後に）

```ts
  wallet?: { points: number };          // 所持桜貝(未設定→0)
  owned?: string[];                     // 購入済みアイテムID
  equipped?: { frame?: string; outfit?: string; petal?: string; theme?: string; badge?: string };
  claimedMilestones?: string[];         // 節目付与の重複防止
  dailyEarn?: { day: string; amount: number }; // 1日獲得上限の当日累計
```

- [ ] **Step 2: tsc**

Run: `cd app && npm run tsc`
Expected: PASS（INITIAL_STATE は未設定でも optional なので変更不要）

- [ ] **Step 3: Commit**

```bash
git add app/src/store/state.ts && git commit -m "feat(shop): AppStateに通貨/所有/装備フィールド追加"
```

---

### Task 2: wallet.ts 純関数（付与・購入・装備）＋テスト

**Files:**
- Create: `app/src/store/wallet.ts`
- Create: `app/src/store/__tests__/wallet.test.ts`
- Modify: `app/package.json`（"test" に `src/store/__tests__/wallet.test.ts` 追記）

**Interfaces:**
- Consumes: `AppState`（Task 1）, `dayStr`・`withUpdatedAt`（`../store/state`）, `ShopItem`（Task 5 で定義。テストでは最小のリテラルで代用）
- Produces:
  - `EARN`（レート定数）
  - `walletPoints(state): number`
  - `addPoints(state, amount, now, opts?: { cap?: boolean }): AppState`
  - `awardOnce(state, key: string, amount: number): AppState`
  - `isOwned(state, id: string): boolean`
  - `isEquipped(state, item: { id: string; kind: ShopKind }): boolean`
  - `canBuy(state, item: { id: string; price: number }): boolean`
  - `buy(state, item: { id: string; price: number }, now): AppState`
  - `equip(state, item: { id: string; kind: ShopKind }): AppState`
  - `type ShopKind = 'frame' | 'outfit' | 'petal' | 'theme' | 'badge'`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// app/src/store/__tests__/wallet.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_STATE } from '../state';
import { EARN, walletPoints, addPoints, awardOnce, canBuy, buy, equip, isOwned, isEquipped } from '../wallet';

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0); // 2026-01-01

test('addPoints: 無上限は素直に加算', () => {
  const s = addPoints(INITIAL_STATE, 50, NOW);
  assert.equal(walletPoints(s), 50);
});

test('addPoints cap: 1日上限300を超えない', () => {
  let s = addPoints(INITIAL_STATE, 250, NOW, { cap: true });
  s = addPoints(s, 100, NOW, { cap: true }); // 250+50までしか入らない
  assert.equal(walletPoints(s), 300);
  assert.equal(s.dailyEarn?.amount, 300);
});

test('addPoints cap: 翌日はリセット', () => {
  let s = addPoints(INITIAL_STATE, 300, NOW, { cap: true });
  const NEXT = Date.UTC(2026, 0, 2, 12, 0, 0);
  s = addPoints(s, 100, NEXT, { cap: true });
  assert.equal(walletPoints(s), 400);
});

test('awardOnce: 同じ節目キーは1回だけ', () => {
  let s = awardOnce(INITIAL_STATE, 'streak7', 50);
  s = awardOnce(s, 'streak7', 50);
  assert.equal(walletPoints(s), 50);
  assert.ok(s.claimedMilestones?.includes('streak7'));
});

test('buy: 残高十分で購入→所有＆減算、二重購入は不可', () => {
  let s = addPoints(INITIAL_STATE, 600, NOW);
  const item = { id: 'frame_sakura', price: 500 };
  assert.equal(canBuy(s, item), true);
  s = buy(s, item, NOW);
  assert.equal(walletPoints(s), 100);
  assert.equal(isOwned(s, 'frame_sakura'), true);
  assert.equal(canBuy(s, item), false); // 所有済み
  s = buy(s, item, NOW); // 何も起きない
  assert.equal(walletPoints(s), 100);
});

test('buy: 残高不足は不可', () => {
  const s = addPoints(INITIAL_STATE, 100, NOW);
  assert.equal(canBuy(s, { id: 'x', price: 500 }), false);
  assert.equal(walletPoints(buy(s, { id: 'x', price: 500 }, NOW)), 100);
});

test('equip: 所有品のみ装備・kind別スロット', () => {
  let s = buy(addPoints(INITIAL_STATE, 600, NOW), { id: 'frame_sakura', price: 500 }, NOW);
  s = equip(s, { id: 'frame_sakura', kind: 'frame' });
  assert.equal(s.equipped?.frame, 'frame_sakura');
  assert.equal(isEquipped(s, { id: 'frame_sakura', kind: 'frame' }), true);
  // 未所有は装備不可
  s = equip(s, { id: 'frame_night', kind: 'frame' });
  assert.equal(s.equipped?.frame, 'frame_sakura');
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `cd app && node --import tsx --test src/store/__tests__/wallet.test.ts`
Expected: FAIL（`../wallet` が存在しない）

- [ ] **Step 3: wallet.ts を実装**

```ts
// app/src/store/wallet.ts
// 桜貝(内部通貨)の付与・購入・装備の純関数。reducerから呼ぶ。副作用なし・入力は不変。
import type { AppState } from './state';
import { dayStr, withUpdatedAt } from './state';

export type ShopKind = 'frame' | 'outfit' | 'petal' | 'theme' | 'badge';

export const EARN = {
  answer: 2, dailyCap: 300, completion: 15, mock: 50, kanjiMaster: 5,
  dailyFirst: 10, streak7: 50, streak30: 200,
  tierUp: 100, passMilestone: 150, learnedPer100: 30,
} as const;

export function walletPoints(state: AppState): number { return state.wallet?.points ?? 0; }

export function addPoints(state: AppState, amount: number, now: number, opts?: { cap?: boolean }): AppState {
  const amt = Math.max(0, Math.floor(amount || 0));
  if (amt === 0) return state;
  let add = amt;
  let dailyEarn = state.dailyEarn;
  if (opts?.cap) {
    const day = dayStr(now);
    const cur = dailyEarn && dailyEarn.day === day ? dailyEarn.amount : 0;
    add = Math.max(0, Math.min(amt, EARN.dailyCap - cur));
    dailyEarn = { day, amount: cur + add };
    if (add === 0) return { ...state, dailyEarn };
  }
  return { ...state, wallet: { points: walletPoints(state) + add }, ...(opts?.cap ? { dailyEarn } : {}) };
}

export function awardOnce(state: AppState, key: string, amount: number): AppState {
  const claimed = state.claimedMilestones ?? [];
  if (claimed.includes(key)) return state;
  const s = addPoints(state, amount, 0); // 節目は上限対象外
  return { ...s, claimedMilestones: [...claimed, key] };
}

export function isOwned(state: AppState, id: string): boolean { return (state.owned ?? []).includes(id); }
export function isEquipped(state: AppState, item: { id: string; kind: ShopKind }): boolean { return state.equipped?.[item.kind] === item.id; }
export function canBuy(state: AppState, item: { id: string; price: number }): boolean {
  return walletPoints(state) >= item.price && !isOwned(state, item.id);
}
export function buy(state: AppState, item: { id: string; price: number }, now: number): AppState {
  if (!canBuy(state, item)) return state;
  return withUpdatedAt({ ...state, wallet: { points: walletPoints(state) - item.price }, owned: [...(state.owned ?? []), item.id] }, now);
}
export function equip(state: AppState, item: { id: string; kind: ShopKind }): AppState {
  if (!isOwned(state, item.id)) return state;
  return { ...state, equipped: { ...(state.equipped ?? {}), [item.kind]: item.id } };
}
```

- [ ] **Step 4: package.json の test に追記**

`app/package.json` の "test" スクリプト末尾（`"..."` の閉じ引用符直前）に半角スペース区切りで追加：
```
src/store/__tests__/wallet.test.ts
```

- [ ] **Step 5: テストが通るのを確認**

Run: `cd app && npm test 2>&1 | grep -E "wallet|pass|fail"`
Expected: wallet の7テスト PASS、全体 fail 0

- [ ] **Step 6: Commit**

```bash
git add app/src/store/wallet.ts app/src/store/__tests__/wallet.test.ts app/package.json
git commit -m "feat(shop): 桜貝の付与/購入/装備の純関数＋テスト"
```

---

### Task 3: reducer アクション＋useAppActions

**Files:**
- Modify: `app/src/store/store.tsx`（Action union ＋ reducer ＋ useAppActions）

**Interfaces:**
- Consumes: `addPoints`, `awardOnce`, `buy`, `equip`（Task 2）, `ShopKind`
- Produces（useAppActions が返す）:
  - `addPoints(amount: number, opts?: { cap?: boolean }): void`
  - `awardOnce(key: string, amount: number): void`
  - `buyItem(item: { id: string; price: number }): void`
  - `equipItem(item: { id: string; kind: ShopKind }): void`

- [ ] **Step 1: Action union に追加**（`ADD_STUDY_SECONDS` の隣）

```ts
  | { type: 'ADD_POINTS'; amount: number; now: number; cap?: boolean }
  | { type: 'AWARD_ONCE'; key: string; amount: number }
  | { type: 'BUY_ITEM'; item: { id: string; price: number }; now: number }
  | { type: 'EQUIP_ITEM'; item: { id: string; kind: import('./wallet').ShopKind } }
```

- [ ] **Step 2: reducer に case 追加**（`ADD_STUDY_SECONDS` の隣）＋ import

`store.tsx` 冒頭の import に:
```ts
import { addPoints as walletAdd, awardOnce as walletAwardOnce, buy as walletBuy, equip as walletEquip } from './wallet';
```
reducer:
```ts
    case 'ADD_POINTS':
      return walletAdd(state, action.amount, action.now, { cap: action.cap });
    case 'AWARD_ONCE':
      return walletAwardOnce(state, action.key, action.amount);
    case 'BUY_ITEM':
      return walletBuy(state, action.item, action.now);
    case 'EQUIP_ITEM':
      return walletEquip(state, action.item);
```

- [ ] **Step 3: useAppActions に追加**（`addStudySeconds` の隣）

```ts
    addPoints: (amount: number, opts?: { cap?: boolean }) => dispatch({ type: 'ADD_POINTS', amount, now: Date.now(), cap: opts?.cap }),
    awardOnce: (key: string, amount: number) => dispatch({ type: 'AWARD_ONCE', key, amount }),
    buyItem: (item: { id: string; price: number }) => dispatch({ type: 'BUY_ITEM', item, now: Date.now() }),
    equipItem: (item: { id: string; kind: import('./wallet').ShopKind }) => dispatch({ type: 'EQUIP_ITEM', item }),
```

- [ ] **Step 4: tsc＋test**

Run: `cd app && npm run tsc && npm test 2>&1 | tail -3`
Expected: tsc PASS、fail 0

- [ ] **Step 5: Commit**

```bash
git add app/src/store/store.tsx && git commit -m "feat(shop): reducerに桜貝アクション追加"
```

---

### Task 4: 学習フローに桜貝付与をフック

**Files:**
- Modify: `app/src/store/store.tsx`（quizAnswer/mockAnswer/recordKakitori アクションで付与）

**Interfaces:**
- Consumes: useAppActions の `addPoints`/`awardOnce`（Task 3）。付与は dispatch 後に追加 dispatch する形（同一 useAppActions 内）。

- [ ] **Step 1: quizAnswer/mockAnswer で正解時 +2(cap)**

`useAppActions` の `quizAnswer` を修正：
```ts
    quizAnswer: (itemId: string, correct: boolean) => {
      recordAnswer(itemId, correct);
      dispatch({ type: 'QUIZ_ANSWER', itemId, correct, now: Date.now() });
      if (correct) dispatch({ type: 'ADD_POINTS', amount: 2, now: Date.now(), cap: true });
    },
    mockAnswer: (itemId: string, correct: boolean) => {
      recordAnswer(itemId, correct);
      dispatch({ type: 'MOCK_ANSWER', itemId, correct, now: Date.now() });
      if (correct) dispatch({ type: 'ADD_POINTS', amount: 2, now: Date.now(), cap: true });
    },
```

- [ ] **Step 2: recordKakitori でマスター時 +5(cap)**

`recordKakitori` を修正（score が満点=3star相当のとき付与。既存の applyKakitoriProgress の star 判定に合わせ、step===3 かつ score>=最高で付与。簡便に「recall(step3)成功」で +5）：
```ts
    recordKakitori: (char: string, step: number, score: number, opts?: { skipped?: boolean; now?: number }) => {
      dispatch({ type: 'KAKITORI_PROGRESS', char, step, score, skipped: opts?.skipped, now: opts?.now });
      if (step >= 3 && !opts?.skipped && score >= 2) dispatch({ type: 'ADD_POINTS', amount: 5, now: Date.now(), cap: true });
    },
```

- [ ] **Step 3: recordMockResult で模試完了 +50(cap)**

```ts
    recordMockResult: (result: MockResult) => {
      dispatch({ type: 'RECORD_MOCK', result });
      dispatch({ type: 'ADD_POINTS', amount: 50, now: Date.now(), cap: true });
    },
```

- [ ] **Step 4: tsc＋test**

Run: `cd app && npm run tsc && npm test 2>&1 | tail -3`
Expected: tsc PASS、fail 0

- [ ] **Step 5: Commit**

```bash
git add app/src/store/store.tsx && git commit -m "feat(shop): 学習(正解/漢字/模試)で桜貝付与"
```

> 注: 継続(+10/+50/+200)・tier昇格(+100)・合格率/語数マイルストーンは、HomeScreen 等での算出値に依存するため段階1後半で HomeScreen マウント時に `awardOnce` を呼ぶ形で追加（本計画の Task 8 で最小フック）。

---

### Task 5: ショップ・カタログ＋枠アセット＋frameAsset ヘルパ

**Files:**
- Create: `app/src/data/shop.ts`
- Create: `app/assets/tabs/status_frame_2.png`（Nano Banana生成の別配色枠。生成手順は下記）
- Modify: `app/src/home/FramedPanel.tsx`（equipped.frame で枠を差替）

**Interfaces:**
- Produces:
  - `type ShopItem = { id: string; kind: ShopKind; price: number; nameKey: string; descKey: string; asset?: ImageSourcePropType }`
  - `SHOP: ShopItem[]`
  - `SHOP_BY_ID: Record<string, ShopItem>`
  - `frameSourceFor(equippedFrameId?: string): ImageSourcePropType`（未装備→既定 status_frame.png）

- [ ] **Step 1: 別配色の枠を1枚生成**（着せ替えの2種目。既定＝現行 status_frame.png ＝ frame_default）

`blog/tools/` で、`status_frame.png`（藍金）とは別配色（例: 朱×金＝frame_vermilion）を生成し `app/assets/tabs/status_frame_2.png` に配置（既存 gen-images.mjs＋panelプロンプトの色替え）。実費は数円（使用後に「モデル名＋円」報告）。

- [ ] **Step 2: shop.ts を作成**

```ts
// app/src/data/shop.ts
import type { ImageSourcePropType } from 'react-native';
import type { ShopKind } from '../store/wallet';

export type ShopItem = { id: string; kind: ShopKind; price: number; nameKey: string; descKey: string; asset?: ImageSourcePropType };

const FRAME_DEFAULT = require('../../assets/tabs/status_frame.png');
const FRAME_2 = require('../../assets/tabs/status_frame_2.png');

export const SHOP: ShopItem[] = [
  { id: 'frame_default', kind: 'frame', price: 0, nameKey: 'shop.item_frame_default', descKey: 'shop.item_frame_default_d', asset: FRAME_DEFAULT },
  { id: 'frame_vermilion', kind: 'frame', price: 800, nameKey: 'shop.item_frame_vermilion', descKey: 'shop.item_frame_vermilion_d', asset: FRAME_2 },
];
export const SHOP_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP.map((i) => [i.id, i]));

export function frameSourceFor(equippedFrameId?: string): ImageSourcePropType {
  const it = equippedFrameId ? SHOP_BY_ID[equippedFrameId] : undefined;
  return (it && it.asset) ?? FRAME_DEFAULT;
}
```

- [ ] **Step 3: FramedPanel で装備枠を反映**

`app/src/home/FramedPanel.tsx`：`FRAME` 定数の使用箇所を、装備中の枠に差替。
```ts
import { useAppState } from '../store/store';
import { frameSourceFor } from '../data/shop';
// FramedPanel 内:
  const equippedFrame = useAppState().equipped?.frame;
  const frameSrc = frameSourceFor(equippedFrame);
  // <Image source={FRAME} ...> を <Image source={frameSrc} ...> に変更
```
（`export const FRAME` はデフォルト解決用に残してよい。FRAME_ASPECT は共通のため据え置き＝全枠を同一比率で書き出す。）

- [ ] **Step 4: tsc**

Run: `cd app && npm run tsc`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/data/shop.ts app/src/home/FramedPanel.tsx app/assets/tabs/status_frame_2.png
git commit -m "feat(shop): カタログ＋枠アセット＋装備枠の反映"
```

---

### Task 6: Shopルート＋上部バーの桜貝残高ボタン

**Files:**
- Modify: `app/src/navigation/types.ts`（`Shop: undefined` 追加）
- Modify: `app/App.tsx`（Shop モーダル登録＋上部バーに残高ボタン）

**Interfaces:**
- Consumes: `walletPoints`（Task 2）, `ShopScreen`（Task 7）

- [ ] **Step 1: types.ts に Shop 追加**（`Notifications: undefined;` の隣）

```ts
  Shop: undefined; // ショップ(桜貝で着せ替え購入)
```

- [ ] **Step 2: App.tsx に import＋Shopモーダル登録**

```ts
import ShopScreen from './src/screens/ShopScreen';
import { walletPoints } from './src/store/wallet';
// RootStack に:
            <RootStack.Screen name="Shop" component={ShopScreen} options={{ presentation: 'modal' }} />
```

- [ ] **Step 3: MainTabs の上部バーに残高ボタン**（通知ベルの隣に）

```tsx
        <Pressable onPress={() => nav.navigate('Shop')} accessibilityLabel={t('shop.title')} hitSlop={6}
          style={[topBar.pill, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[topBar.pillTxt, { color: c.ink }]}>🐚 {walletPoints(state)}</Text>
        </Pressable>
```
（`state` は MainTabs で `useAppState()` 済み。無ければ `const state = useAppState();` を追加。）

- [ ] **Step 4: tsc**

Run: `cd app && npm run tsc`
Expected: PASS（ShopScreen は Task 7 で作成。先に空実装でも可＝Task 7 を先行実装）

- [ ] **Step 5: Commit**

```bash
git add app/src/navigation/types.ts app/App.tsx
git commit -m "feat(shop): Shopルート＋上部バーに桜貝残高"
```

---

### Task 7: ShopScreen（着せ替えグリッド・購入/装備）

**Files:**
- Create: `app/src/screens/ShopScreen.tsx`

**Interfaces:**
- Consumes: `SHOP`（Task 5）, `walletPoints`/`isOwned`/`isEquipped`/`canBuy`（Task 2）, `useAppActions().buyItem/equipItem`（Task 3）

- [ ] **Step 1: ShopScreen を作成**

```tsx
// app/src/screens/ShopScreen.tsx
// ショップ(モーダル)= 桜貝で着せ替え購入。カテゴリタブ＋商品グリッド＋残高。
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { walletPoints, isOwned, isEquipped, canBuy } from '../store/wallet';
import { SHOP, type ShopItem } from '../data/shop';
import type { ShopKind } from '../store/wallet';
import { useT } from '../i18n';

const CATS: { kind: ShopKind; labelKey: string }[] = [
  { kind: 'frame', labelKey: 'shop.cat_frame' },
  { kind: 'outfit', labelKey: 'shop.cat_outfit' },
  { kind: 'petal', labelKey: 'shop.cat_petal' },
  { kind: 'theme', labelKey: 'shop.cat_theme' },
  { kind: 'badge', labelKey: 'shop.cat_badge' },
];

export default function ShopScreen() {
  const nav = useNavigation();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const state = useAppState();
  const { buyItem, equipItem } = useAppActions();
  const [cat, setCat] = useState<ShopKind>('frame');
  const items = SHOP.filter((i) => i.kind === cat);

  const act = (item: ShopItem) => {
    if (isOwned(state, item.id)) equipItem(item);
    else if (canBuy(state, item)) buyItem(item);
  };
  const statusOf = (item: ShopItem) =>
    isEquipped(state, item) ? t('shop.equipped')
      : isOwned(state, item.id) ? t('shop.equip')
      : canBuy(state, item) ? t('shop.buy')
      : t('shop.insufficient');

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Text style={s.title}>{t('shop.title')}</Text>
        <Text style={s.bal}>🐚 {walletPoints(state)}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable>
      </View>
      <View style={s.tabs}>
        {CATS.map((x) => (
          <Pressable key={x.kind} onPress={() => setCat(x.kind)} style={[s.tab, cat === x.kind && s.tabOn]}>
            <Text style={[s.tabTxt, cat === x.kind && s.tabTxtOn]}>{t(x.labelKey)}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={s.grid}>
        {items.length === 0 ? <Text style={s.empty}>{t('shop.empty')}</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={s.card}>
            {item.asset ? <Image source={item.asset} style={s.preview} resizeMode="contain" /> : <View style={s.previewPlaceholder} />}
            <Text style={s.name} numberOfLines={1}>{t(item.nameKey)}</Text>
            <Text style={s.price}>{item.price === 0 ? t('shop.free') : `🐚 ${item.price}`}</Text>
            <Pressable
              disabled={isEquipped(state, item) || (!isOwned(state, item.id) && !canBuy(state, item))}
              onPress={() => act(item)}
              style={[s.btn, (isEquipped(state, item) || (!isOwned(state, item.id) && !canBuy(state, item))) && s.btnOff]}
            >
              <Text style={s.btnTxt}>{statusOf(item)}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { flex: 1, fontSize: ty.h1, fontWeight: '800', color: c.ink },
  bal: { fontSize: ty.body, fontWeight: '800', color: c.ink },
  close: { fontSize: 30, color: c.mute, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, flexWrap: 'wrap' },
  tab: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
  tabOn: { backgroundColor: c.blue, borderColor: c.blue },
  tabTxt: { fontSize: ty.small, fontWeight: '800', color: c.ink2 },
  tabTxtOn: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, padding: spacing.lg },
  empty: { color: c.mute, fontSize: ty.body, padding: spacing.lg },
  card: { width: '46%', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: 6, alignItems: 'center' },
  preview: { width: '100%', height: 120, borderRadius: radius.md },
  previewPlaceholder: { width: '100%', height: 120, borderRadius: radius.md, backgroundColor: c.bgSoft },
  name: { fontSize: ty.body, fontWeight: '800', color: c.ink, textAlign: 'center' },
  price: { fontSize: ty.small, fontWeight: '700', color: c.mute },
  btn: { alignSelf: 'stretch', backgroundColor: c.blue, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  btnOff: { backgroundColor: c.line },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: ty.small },
});
```

- [ ] **Step 2: tsc**

Run: `cd app && npm run tsc`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/ShopScreen.tsx && git commit -m "feat(shop): ショップ画面(購入/装備)"
```

---

### Task 8: 継続・上達の桜貝付与（HomeScreen フック）＋i18n

**Files:**
- Modify: `app/src/screens/HomeScreen.tsx`（マウント時に節目 awardOnce）
- Modify: `app/src/i18n/{ja,en,ne}.json`（shop.*）

**Interfaces:**
- Consumes: `useAppActions().addPoints/awardOnce`, `homeStatus`（passPct/streakDays）, `state.streak.current`, `learnedNow`

- [ ] **Step 1: HomeScreen で節目付与（useEffect・1回判定は awardOnce が担保）**

```tsx
import { useEffect } from 'react';
import { useAppActions } from '../store/store';
import { learnedNow } from '../store/selectors';
// HomeScreen 内:
  const { addPoints, awardOnce } = useAppActions();
  useEffect(() => {
    // 毎日初回学習(その日学習済みなら)
    if (state.streak.history.includes(today)) awardOnce('dailyFirst-' + today, 10);
    if (state.streak.current >= 7) awardOnce('streak7', 50);
    if (state.streak.current >= 30) awardOnce('streak30', 200);
    // 合格率マイルストーン
    const p = status.passPct;
    if (p >= 50) awardOnce('pass50', 150);
    if (p >= 70) awardOnce('pass70', 150);
    if (p >= 80) awardOnce('pass80', 150);
    // tier昇格
    const tier = Math.min(9, Math.floor(p / 10));
    for (let i = 1; i <= tier; i++) awardOnce('tier' + i, 100);
    // 覚えた語100ごと
    const learned = learnedNow(state, now);
    for (let k = 1; k <= Math.floor(learned / 100); k++) awardOnce('learned' + (k * 100), 30);
  }, [state, status.passPct]); // eslint-disable-line react-hooks/exhaustive-deps
```
（`awardOnce` は claimedMilestones で二重付与を防ぐので、毎マウント呼んでも安全。`addPoints` は未使用なら import から外す。）

- [ ] **Step 2: i18n キー追加**（ja 例。en/ne も同キーで）

`app/src/i18n/ja.json` に:
```
"shop.title": "桜貝の店",
"shop.buy": "購入", "shop.equip": "装備", "shop.equipped": "装備中", "shop.insufficient": "桜貝不足", "shop.free": "無料", "shop.empty": "準備中です",
"shop.cat_frame": "枠", "shop.cat_outfit": "衣装", "shop.cat_petal": "桜", "shop.cat_theme": "テーマ", "shop.cat_badge": "称号",
"shop.item_frame_default": "藍金の枠", "shop.item_frame_default_d": "既定の和風フレーム",
"shop.item_frame_vermilion": "朱金の枠", "shop.item_frame_vermilion_d": "朱色の和風フレーム"
```
（en/ne は各言語で。無い言語は ja フォールバック。）

- [ ] **Step 3: tsc＋test**

Run: `cd app && npm run tsc && npm test 2>&1 | tail -3`
Expected: PASS、fail 0

- [ ] **Step 4: Commit＋ビルド**

```bash
git add app/src/screens/HomeScreen.tsx app/src/i18n/ja.json app/src/i18n/en.json app/src/i18n/ne.json
git commit -m "feat(shop): 継続/上達の桜貝付与＋i18n"
```
ビルド（起動時に build番号併記）:
```
gh workflow run ios-build-jlpt.yml --repo JinKato2020/safa-JLPT --ref main -f submit=true
gh workflow run android-build-jlpt.yml --repo JinKato2020/safa-JLPT --ref main -f aab=true -f publish=false -f track=internal
```

---

## Self-Review

**Spec coverage:** 通貨(Task1-2)／獲得レート・上限・節目(Task2,4,8)／ショップ着せ替え(Task5,7)／状態(Task1)／純関数＋テスト(Task2)／上部バー残高＋ショップ画面(Task6,7)／装備反映=枠(Task5)／i18n(Task8)／Pro非衝突(設計どおり消耗品なし)。段階2(衣装/エフェクト/テーマ/バッジのアセットと反映)は非対象で枠だけ用意。→ カバー。
**Placeholder scan:** なし（各ステップに実コード）。Task5 Step1 の枠生成のみ手作業（Nano Banana）だが手順明記。
**Type consistency:** `ShopKind`/`ShopItem`/`walletPoints`/`addPoints(cap)`/`awardOnce`/`buy`/`equip`/`frameSourceFor` は Task2/5 の定義と Task3/6/7/8 の使用で一致。
