# 3タブ没入UI一新 実装計画（単語・試験・辞書）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 単語・試験・辞書の3タブを、全画面イラスト背景＋没入UI（単語=ホットスポット／試験・辞書=和紙調タイル）へ一新し、既存機能を保全する。

**Architecture:** 各タブを独立ネストスタック（Words/Study/Dict）にし「ホーム→詳細」。共通部品 `TabScene.tsx`（全画面背景・タイル・ホットスポット）と `tabArt.ts`（背景アセット）を土台に、各ホーム画面を差し替える。既存の出題/辞書/ドリル画面は詳細として再利用。

**Tech Stack:** Expo SDK54 / React Native 0.81 / TypeScript / @react-navigation(native-stack, material-top-tabs)。テスト=`node --import tsx --test`。

## 現状（重要・実装の起点）
トンネル反復で**下記の大半が既に実装済み**。本計画は「仕様適合の確定＋検証」。**唯一の設計差分＝Task 4（単語をタイル→ホットスポットへ戻す）**。他タスクは「既存実装が本計画のコードと一致するか検証し、差があれば合わせる」形で実行する。

## Global Constraints（全タスク共通・厳守）
- git ルート = `app/`。**今回はビルドしない**（保留中の大型ビルドにまとめる）。Build番号 = `1000 + git rev-list --count HEAD`。
- 型チェック = `cd app && npm run tsc`（緑必須）。テスト = `cd app && npm test`（既存192を維持）。新規 `*.test.ts` は `app/package.json` の `test` スクリプトに**追記必須**。
- 既存ナビ/型は**破壊せず追加のみ**。アセットは `app/assets/tabs/`。
- 背景表示は `resizeMode:'cover'` ＋ 親 `overflow:'hidden'`（画面外へはみ出さない）。
- 個人名を使わない。UIに専門用語を出さない（単語タブ既定）。
- 画像正本 = `画像/アプリ画像/{学習タブ,試験タブ,図書館}.PNG`。同梱名 = `word_bg.jpg / exam_bg.jpg / dict_bg.jpg`。

---

## ファイル構成
- Create: `app/assets/tabs/{word_bg,exam_bg,dict_bg}.jpg`（正本PNGをJPG q88変換）
- Create: `app/src/data/tabArt.ts`（`TAB_BG`）
- Create: `app/src/components/TabScene.tsx`（`TabBackground`/`ImmersiveHome`/`ImmersiveTile`/`Hotspot`/`IMMERSIVE`）
- Create: `app/src/screens/WordsHubScreen.tsx`（単語ハブ=ホットスポット）
- Create: `app/src/screens/DictHomeScreen.tsx`（辞書=タイル）
- Create: `app/src/screens/StudyHomeScreen.tsx`（試験=タイル）
- Create: `app/src/screens/StudyCategoryScreen.tsx`（試験カテゴリ詳細）
- Modify: `app/src/screens/CardsScreen.tsx`（`kubun` パラメータで1区分表示＋戻る）
- Modify: `app/src/navigation/types.ts`（`WordKubun`/`DictStackParamList`/`StudyStackParamList`）
- Modify: `app/App.tsx`（Words/Dict/Study スタック・TABSの3タブ差し替え）
- Delete: `app/src/screens/StudyScreen.tsx`（Home/Category に分割移設後）
- Test: `app/src/components/__tests__/tabArt.test.ts`（純関数の最小テスト）

---

### Task 1: 背景アセットの同梱と `tabArt.ts`

**Files:**
- Create: `app/assets/tabs/word_bg.jpg`, `exam_bg.jpg`, `dict_bg.jpg`
- Create: `app/src/data/tabArt.ts`

**Interfaces:**
- Produces: `TAB_BG: Record<'word'|'exam'|'dict', ImageSourcePropType>`, `type TabKey`

- [ ] **Step 1: 正本PNGをJPGへ変換して配置**（PowerShell System.Drawing, q88）。853×1844のまま `word_bg.jpg`(学習タブ) `exam_bg.jpg`(試験タブ) `dict_bg.jpg`(図書館) を `app/assets/tabs/` に出力（各≈0.4–0.5MB）。

- [ ] **Step 2: `tabArt.ts` を作成**

```ts
import type { ImageSourcePropType } from 'react-native';
export type TabKey = 'word' | 'exam' | 'dict';
export const TAB_BG: Record<TabKey, ImageSourcePropType> = {
  word: require('../../assets/tabs/word_bg.jpg'),
  exam: require('../../assets/tabs/exam_bg.jpg'),
  dict: require('../../assets/tabs/dict_bg.jpg'),
};
```

- [ ] **Step 3: 検証** `cd app && npm run tsc` → 緑（require解決）。`git add`/commit はしない（ビルド不要）。

---

### Task 2: 共通部品 `TabScene.tsx`

**Files:**
- Create: `app/src/components/TabScene.tsx`

**Interfaces:**
- Produces: `TabBackground({source,scrim?})`, `ImmersiveHome({bg,title,scrim?,children})`, `ImmersiveTile({glyph,label,sub?,count?,accent,onPress})`, `Hotspot({area,onPress,label?})`, `type Area`, `IMMERSIVE`

- [ ] **Step 1: コンポーネント実装**（`overflow:'hidden'` で背景がはみ出さない）

```tsx
import React from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet, type DimensionValue, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const IMMERSIVE = { card: 'rgba(255,251,244,0.88)', sheet: 'rgba(255,250,242,0.76)', gold: 'rgba(184,146,74,0.75)', goldStrong: '#b8924a' };

export function TabBackground({ source, scrim = 0, children }: { source: ImageSourcePropType; scrim?: number; children?: React.ReactNode }) {
  return (
    <View style={styles.fill}>
      <Image source={source} style={styles.bg} resizeMode="cover" />
      {scrim > 0 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${scrim})` }]} /> : null}
      {children}
    </View>
  );
}
export function ImmersiveHome({ bg, title, scrim = 0.16, children }: { bg: ImageSourcePropType; title: string; scrim?: number; children?: React.ReactNode }) {
  return (
    <View style={styles.fill}>
      <TabBackground source={bg} scrim={scrim}>
        <SafeAreaView edges={['top']} style={styles.homeSafe}>
          <Text style={styles.homeTitle}>{title}</Text>
          <ScrollView contentContainerStyle={styles.gridPad} showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>{children}</View>
          </ScrollView>
        </SafeAreaView>
      </TabBackground>
    </View>
  );
}
export function ImmersiveTile({ glyph, label, sub, count, accent, onPress }: { glyph: string; label: string; sub?: string; count?: number; accent: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
      <View style={[styles.glyphWrap, { borderColor: accent }]}><Text style={[styles.glyph, { color: accent }]}>{glyph}</Text></View>
      <Text style={styles.tileLabel}>{label}</Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
      {count != null && count > 0 ? <Text style={[styles.count, { backgroundColor: accent }]}>{count}</Text> : null}
    </Pressable>
  );
}
export type Area = { left: DimensionValue; top: DimensionValue; width: DimensionValue; height: DimensionValue };
export function Hotspot({ area, onPress, label }: { area: Area; onPress: () => void; label?: string }) {
  return <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [{ position: 'absolute', ...area, borderRadius: 14 }, pressed && styles.hotPressed]} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  hotPressed: { backgroundColor: 'rgba(255,255,255,0.22)' },
  homeSafe: { flex: 1, paddingHorizontal: 16 },
  homeTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: 6, textAlign: 'center', marginTop: 8, marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  gridPad: { paddingBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  tile: { width: '47.5%', aspectRatio: 1.32, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 8, backgroundColor: IMMERSIVE.card, borderWidth: 1.5, borderColor: IMMERSIVE.gold, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  tilePressed: { transform: [{ scale: 0.97 }], backgroundColor: 'rgba(255,255,255,0.95)' },
  glyphWrap: { width: 50, height: 50, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.72)' },
  glyph: { fontSize: 28, fontWeight: '900', fontFamily: 'ShipporiMincho-Bold' },
  tileLabel: { fontSize: 15, fontWeight: '800', color: '#4a3826', textAlign: 'center' },
  tileSub: { fontSize: 11, fontWeight: '700', color: '#8a7a66' },
  count: { position: 'absolute', top: 8, right: 10, fontSize: 12, fontWeight: '800', color: '#fff', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden' },
});
```

- [ ] **Step 2: 検証** `npm run tsc` 緑（`Area` の `DimensionValue` 型で `'5%'` 等が通ること）。

---

### Task 3: ナビ型の追加

**Files:**
- Modify: `app/src/navigation/types.ts`

**Interfaces:**
- Produces: `WordsStackParamList.WordKubun`, `DictStackParamList`, `StudyStackParamList`

- [ ] **Step 1: 型を追加**（`Category` は既に import 済み）

```ts
export type WordsStackParamList = {
  WordsHome: undefined;
  WordKubun: { kubun: Kubun };
  WordList: { view: Kubun; mode: 'study' };
};
export type DictStackParamList = { DictHome: undefined; DictList: { view: Kubun } };
export type StudyStackParamList = { StudyHome: undefined; StudyCategory: { cat: Category } };
```

- [ ] **Step 2: 検証** `npm run tsc` 緑。

---

### Task 4: 単語タブ＝没入ホットスポット（★唯一の設計差分）

**Files:**
- Create/Overwrite: `app/src/screens/WordsHubScreen.tsx`（タイル版があれば**ホットスポット版へ上書き**）
- Modify: `app/src/screens/CardsScreen.tsx`

**Interfaces:**
- Consumes: `TabBackground`, `Hotspot`(Task2), `TAB_BG`(Task1), `WordKubun`(Task3)
- Produces: `WordsHubScreen`（`WordsHome`）, `CardsScreen`（`WordKubun`＝1区分）

- [ ] **Step 1: `WordsHubScreen` をホットスポット版で実装**（掛軸/札がボタン・タイルなし）

```tsx
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, WordsStackParamList } from '../navigation/types';
import { TabBackground, Hotspot } from '../components/TabScene';
import { TAB_BG } from '../data/tabArt';

type Nav = NativeStackNavigationProp<WordsStackParamList & RootStackParamList>;

export default function WordsHubScreen() {
  const nav = useNavigation<Nav>();
  return (
    <View style={styles.c}>
      <TabBackground source={TAB_BG.word}>
        {/* 掛軸: 語彙 / 文法 / 漢字（座標は実機で微調整） */}
        <Hotspot label="語彙" area={{ left: '12%', top: '17%', width: '15%', height: '11%' }} onPress={() => nav.navigate('WordKubun', { kubun: 'vocab' })} />
        <Hotspot label="文法" area={{ left: '28%', top: '16%', width: '15%', height: '11%' }} onPress={() => nav.navigate('WordKubun', { kubun: 'grammar' })} />
        <Hotspot label="漢字" area={{ left: '42%', top: '17%', width: '15%', height: '11%' }} onPress={() => nav.navigate('WordKubun', { kubun: 'kanji' })} />
        {/* 今日の目標 札 → 今日のオススメ */}
        <Hotspot label="今日の目標" area={{ left: '2%', top: '38%', width: '38%', height: '17%' }} onPress={() => nav.navigate('WordDrill', { kind: 'mixed' })} />
      </TabBackground>
    </View>
  );
}
const styles = StyleSheet.create({ c: { flex: 1 } });
```

- [ ] **Step 2: `CardsScreen` を `kubun` 対応に**（`useRoute` で `kubun` を読み、その1区分のみ表示。区分指定時は「今日のオススメ」カード非表示＋上部に「←戻る」）。差分のみ:
  - `import { useNavigation, useRoute } from '@react-navigation/native';`
  - コンポーネント冒頭: `const route = useRoute(); const kubunParam = (route.params as { kubun?: Key } | undefined)?.kubun; const shownCards = kubunParam ? CARDS.filter((c) => c.key === kubunParam) : CARDS;`
  - タイトル部を `kubunParam ? (←＋区分名) : (cards.title)` に分岐（`s.hubHead`/`s.back` スタイル追加）。
  - 「今日のオススメ」カードを `{!kubunParam && (...)}` で囲む。
  - `CARDS.map` を `shownCards.map` に。

- [ ] **Step 3: 検証** `npm run tsc` 緑。実機（トンネル）で単語タブ→掛軸3つ→各区分（一覧＋ドリル表示）／札→今日のオススメ、を確認。ホットスポット座標がズレていれば % を調整。

---

### Task 5: 辞書タブ＝和紙調タイル

**Files:**
- Create: `app/src/screens/DictHomeScreen.tsx`
- 前提: `BrowseScreen` は `route.params={view}`（辞書モード）で従来どおり動く（改修不要）。

**Interfaces:**
- Consumes: `ImmersiveHome`/`ImmersiveTile`(Task2), `TAB_BG.dict`(Task1), `DictList`/`MyWords`
- Produces: `DictHomeScreen`（`DictHome`）

- [ ] **Step 1: `DictHomeScreen` 実装**

```tsx
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, DictStackParamList, Kubun } from '../navigation/types';
import { ImmersiveHome, ImmersiveTile } from '../components/TabScene';
import { TAB_BG } from '../data/tabArt';
import { useAppState } from '../store/store';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<DictStackParamList & RootStackParamList>;
export default function DictHomeScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const { myList } = useAppState();
  return (
    <ImmersiveHome bg={TAB_BG.dict} title={t('dict.tab')}>
      <ImmersiveTile glyph="語" label={t('browse.vocab')} accent="#3f9d5a" onPress={() => nav.navigate('DictList', { view: 'vocab' as Kubun })} />
      <ImmersiveTile glyph="漢" label={t('browse.kanji')} accent="#d9743f" onPress={() => nav.navigate('DictList', { view: 'kanji' as Kubun })} />
      <ImmersiveTile glyph="文" label={t('browse.grammar')} accent="#7b6bd6" onPress={() => nav.navigate('DictList', { view: 'grammar' as Kubun })} />
      <ImmersiveTile glyph="★" label={t('mywords.card')} accent="#c05580" count={myList?.length ?? 0} onPress={() => nav.navigate('MyWords')} />
    </ImmersiveHome>
  );
}
```

- [ ] **Step 2: 検証** `npm run tsc` 緑。トンネルで辞書タブ→4タイル→各リスト（検索/区分/レベルが従来どおり）→「×」で戻る／My単語帳件数。

---

### Task 6: 試験タブ＝タイル → カテゴリ詳細（＋旧StudyScreen分割）

**Files:**
- Create: `app/src/screens/StudyHomeScreen.tsx`
- Create: `app/src/screens/StudyCategoryScreen.tsx`
- Delete: `app/src/screens/StudyScreen.tsx`

**Interfaces:**
- Consumes: `ImmersiveHome`/`ImmersiveTile`(Task2), `TAB_BG.exam`(Task1), `StudyCategory`(Task3), `ringsFor`/`examOf`/`fullMockLocked`/`Quiz`/`Mock`
- Produces: `StudyHomeScreen`（`StudyHome`）, `StudyCategoryScreen`（`StudyCategory`）

- [ ] **Step 1: `StudyHomeScreen`（タイル）実装** — オススメ／4カテゴリ(正答率%)／模試(ロック時非活性)。`glyph` 字/文/読/聴/試/✦、`sub`=`ringsFor` の % or ロック次回時刻。カテゴリ→`StudyCategory{cat}`、オススメ→`Quiz{category:'all'}`、模試→`Mock{full:true}`。（コードは本セッションの `StudyHomeScreen.tsx` を正とする。）

- [ ] **Step 2: `StudyCategoryScreen`（詳細）実装** — 旧StudyScreenの `subRingsFor`/`mixPress`/カテゴリカード（全体リング＋ミックス＋大問リング＋凡例）を1カテゴリ分に切り出し、上部に「←戻る」。文章の文法は `PassageGrammar` へ、他大問は `Quiz{daimon}`、読解/聴解は各 subtype へ（従来の遷移を厳密に踏襲）。

- [ ] **Step 3: 旧 `StudyScreen.tsx` を削除**。模試の履歴（棒グラフ）は本ホームから撤去（＝模試フロー側へ集約。今回は履歴UIをホームに出さない。データ `mockHistory` は不変で保持）。

- [ ] **Step 4: 検証** `npm run tsc` 緑（`StudyScreen` を import する箇所が残っていないこと＝`grep`）。トンネルで試験タブ→カテゴリタイル→詳細→ミックス/大問出題、オススメ、模試（ロック挙動）を確認。

---

### Task 7: `App.tsx` タブ配線の統合

**Files:**
- Modify: `app/App.tsx`

**Interfaces:**
- Consumes: `WordsHubScreen`/`CardsScreen`/`DictHomeScreen`/`StudyHomeScreen`/`StudyCategoryScreen`/`BrowseScreen` と各 StackParamList

- [ ] **Step 1: 3スタックを定義し TABS を差し替え**

```tsx
// import 追加: WordsHubScreen, DictHomeScreen, StudyHomeScreen, StudyCategoryScreen / 型 DictStackParamList, StudyStackParamList
// StudyScreen の import は削除。
const WordsStack = createNativeStackNavigator<WordsStackParamList>();
function WordsTab() {
  return (
    <WordsStack.Navigator screenOptions={{ headerShown: false }}>
      <WordsStack.Screen name="WordsHome" component={WordsHubScreen} />
      <WordsStack.Screen name="WordKubun" component={CardsScreen} />
      <WordsStack.Screen name="WordList" component={BrowseScreen} initialParams={{ mode: 'study' }} />
    </WordsStack.Navigator>
  );
}
const DictStack = createNativeStackNavigator<DictStackParamList>();
function DictTab() {
  return (
    <DictStack.Navigator screenOptions={{ headerShown: false }}>
      <DictStack.Screen name="DictHome" component={DictHomeScreen} />
      <DictStack.Screen name="DictList" component={BrowseScreen} />
    </DictStack.Navigator>
  );
}
const StudyStack = createNativeStackNavigator<StudyStackParamList>();
function StudyTab() {
  return (
    <StudyStack.Navigator screenOptions={{ headerShown: false }}>
      <StudyStack.Screen name="StudyHome" component={StudyHomeScreen} />
      <StudyStack.Screen name="StudyCategory" component={StudyCategoryScreen} />
    </StudyStack.Navigator>
  );
}
// TABS: 単語→WordsTab / 学習→StudyTab / 辞書→DictTab（ホーム/設定は不変）
```

- [ ] **Step 2: 検証** `npm run tsc` 緑。アプリ起動→5タブ表示、横スワイプ移動、各タブが新ホームで開く。

---

### Task 8: 純関数テストと最終検証

**Files:**
- Create: `app/src/components/__tests__/tabArt.test.ts`
- Modify: `app/package.json`（test スクリプトに追記）

- [ ] **Step 1: 最小テスト（失敗→実装済で通す）** — `TAB_BG` が3キー（word/exam/dict）を持ち各 truthy（`require` が数値/オブジェクトを返す）ことを表明。

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAB_BG } from '../../data/tabArt';
test('TAB_BG は word/exam/dict の3タブ背景を持つ', () => {
  for (const k of ['word', 'exam', 'dict'] as const) assert.ok(TAB_BG[k], `${k} bg missing`);
});
```
（注: RNの`require(png)`はMetro外だと数値化されないため、jsdom無しで通らない場合はこのテストをスキップし、代わりに `tabArt` から純関数を切り出してテストする。UI画面は手動/トンネル検証を正とする。）

- [ ] **Step 2: `package.json` の `test` に上記テストファイルを追記**（既存パターンに合わせる）。

- [ ] **Step 3: 全体検証** `cd app && npm run tsc`（緑）→ `npm test`（既存192＋新規、全pass）→ トンネルで iOSバンドル200を確認（`index.ts.bundle` が 200 で返る）。

- [ ] **Step 4: 後始末** 未使用の旧アセット（`*_day.png`/`*_night.png` 等）を削除し `app/assets/tabs/` は `*_bg.jpg` のみに保つ。

---

## Self-Review（計画→仕様の突合）
- **Spec coverage:** §6.1→Task4, §6.2→Task6, §6.3→Task5, §4背景→Task1, §5共通部品→Task2/§ナビ→Task3/Task7, §7機能保全/模試履歴→Task6-3, §9テスト→Task8。全項目に対応タスクあり。
- **Placeholder scan:** 具体コードを各タスクに記載。ホットスポット座標は「実機微調整」と明示（仕様§10）。
- **Type consistency:** `WordKubun{kubun:Kubun}`/`DictList{view:Kubun}`/`StudyCategory{cat:Category}` は Task3 で定義し Task4-7 で同一に使用。`ImmersiveTile` の props（glyph/label/sub/count/accent/onPress）は Task2 定義と Task5/6 使用で一致。
- **Scope:** 単一実装計画で収まる（1機能・8タスク）。

## Execution Handoff
実装計画は `docs/superpowers/plans/2026-07-12-3tab-immersive-ui.md` に保存。**大半は実装済みのため、実務上の主作業は Task4（単語=ホットスポット化）＋各タスクの仕様適合検証**。
