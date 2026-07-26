# カードタブ＋漢字書き取り（サンプル10字） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 辞書タブをカードタブ（漢字/語彙/文法）に改め、漢字カードに3ステップ・近さ採点の書き取りゲーミフィケーションを10字サンプルで実装する。

**Architecture:** 純JSの採点関数＋KanjiVG点列データ＋react-native-svg描画（PanResponderで指の軌跡収集）。カバー率3バーはホームから撤去しCardsScreenへ移設（既存 `selectors.coverageBars` を再利用）。辞書(Browse)はモーダルへ格下げしカードのリンクから開く。書き取り進捗は `state.kakitori` に永続化。

**Tech Stack:** Expo / React Native / TypeScript、react-native-svg 15.12.1、RN標準 PanResponder、node:test（`node --import tsx --test`）、i18n JSON。

## Global Constraints

- アプリ = safa-JLPT（`app/` が git ルート）。ビルドはしない（実機確認の合図後）。
- 追加依存を増やさない: 描画は **PanResponder**（gesture-handler不使用）、描画SVGは既存 **react-native-svg 15.12.1**。
- 採点は **純JS幾何**（ピクセル読み取り/skia禁止）。
- 新規i18nキーは **en/ja のみ**（他9言語は後日）。
- 座標は **0..1 に正規化**（KanjiVG viewBox=109 で除算）。
- KanjiVG © Ulrich Apel, **CC BY-SA 3.0** を謝辞に追加。
- サンプルは **10字固定**（一 二 三 人 大 日 月 山 川 木）。
- 完了時: `npx tsc --noEmit` 緑・`npm test` 緑・新採点テスト緑・`kakitoriSample.json` を node 直 import で 10字/各画非空を確認。

---

### Task 1: 書き取りサンプルデータ＋生成スクリプト

**Files:**
- Create: `問題/tools/build_kakitori_sample.py`
- Create: `app/src/data/kakitoriSample.json`
- Test: `app/src/kakitori/data.check.mjs`（node実行の検証スクリプト）

**Interfaces:**
- Produces: `kakitoriSample.json` = `Array<{ char: string; level: string; strokes: number[][][] }>`。`strokes[i]` = i画目の点列、点 = `[x, y]`（0..1）。

- [ ] **Step 1: 生成スクリプトを書く**

`問題/tools/build_kakitori_sample.py`：
```python
# -*- coding: utf-8 -*-
"""KanjiVG SVG(10字)→ 各画を等間隔サンプリングした正規化点列JSON。
KanjiVG © Ulrich Apel, CC BY-SA 3.0。SVGは kanjivg リポの kanji/<hex>.svg。
使い方: 10字のSVGを ./kanjivg_src/<hex>.svg に置いて実行。"""
import json, os, re
from svgpathtools import parse_path  # pip install svgpathtools
SRC = os.path.join(os.path.dirname(__file__), "kanjivg_src")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "app", "src", "data", "kakitoriSample.json")
KANJI = [("一","04e00","N5"),("二","04e8c","N5"),("三","04e09","N5"),("人","04eba","N5"),
         ("大","05927","N5"),("日","065e5","N5"),("月","06708","N5"),("山","05c71","N5"),
         ("川","05ddd","N5"),("木","06728","N5")]
VIEW = 109.0  # KanjiVG viewBox
SAMPLES = 24  # 1画あたりのサンプル点数
def sample_stroke(dattr):
    p = parse_path(dattr)
    pts = []
    for i in range(SAMPLES + 1):
        c = p.point(i / SAMPLES)  # 0..1 でパス上を等分
        pts.append([round(c.real / VIEW, 4), round(c.imag / VIEW, 4)])
    return pts
def strokes_of(svg):
    # KanjiVGは各画が <path ... d="..."/>。d属性を全部拾う。
    return [sample_stroke(d) for d in re.findall(r'<path[^>]*\bd="([^"]+)"', svg)]
out = []
for char, hexid, level in KANJI:
    with open(os.path.join(SRC, hexid + ".svg"), encoding="utf-8") as f:
        svg = f.read()
    st = strokes_of(svg)
    assert st and all(len(s) >= 2 for s in st), char
    out.append({"char": char, "level": level, "strokes": st})
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("wrote", len(out), "kanji")
```

- [ ] **Step 2: KanjiVGのSVGを取得**

`問題/tools/kanjivg_src/` に10ファイルを置く（各字のhexは上の `KANJI`）。取得元:
`https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/<hex>.svg`
（例 一 = `.../kanji/04e00.svg`）。CC BY-SA 3.0。

- [ ] **Step 3: 生成を実行**

Run: `pip install svgpathtools && python "問題/tools/build_kakitori_sample.py"`
Expected: `wrote 10 kanji`、`app/src/data/kakitoriSample.json` 生成。

- [ ] **Step 4: 検証スクリプトで確認**

`app/src/kakitori/data.check.mjs`：
```js
import data from '../data/kakitoriSample.json' with { type: 'json' };
if (data.length !== 10) throw new Error('expected 10, got ' + data.length);
for (const k of data) {
  if (!k.strokes?.length) throw new Error('no strokes: ' + k.char);
  for (const s of k.strokes) if (s.length < 2) throw new Error('short stroke: ' + k.char);
  for (const s of k.strokes) for (const [x, y] of s)
    if (x < 0 || x > 1 || y < 0 || y > 1) throw new Error('out of range: ' + k.char);
}
console.log('OK 10 kanji, strokes normalized');
```
Run: `cd app && node --import tsx src/kakitori/data.check.mjs`
Expected: `OK 10 kanji, strokes normalized`

- [ ] **Step 5: Commit**

```bash
cd app && git add src/data/kakitoriSample.json src/kakitori/data.check.mjs && cd .. && git -C app commit -m "feat(kakitori): add 10-kanji KanjiVG stroke sample data"
```

---

### Task 2: 採点関数（純JS・TDD）

**Files:**
- Create: `app/src/kakitori/score.ts`
- Test: `app/src/kakitori/score.test.ts`
- Modify: `app/package.json`（test スクリプトに score.test.ts 追加）

**Interfaces:**
- Produces: `export type Pt = [number, number]`、`export function scoreDrawing(user: Pt[], model: Pt[][]): number`（0..100の整数）。`user`=描いた点列（全画連結可）、`model`=手本の画ごと点列。

- [ ] **Step 1: 失敗するテストを書く**

`app/src/kakitori/score.test.ts`：
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreDrawing, type Pt } from './score';

const box: Pt[][] = [[[0.1,0.1],[0.5,0.1],[0.9,0.1]], [[0.5,0.1],[0.5,0.5],[0.5,0.9]]];

test('exact trace scores high', () => {
  const user = box.flat();
  assert.ok(scoreDrawing(user, box) >= 90);
});
test('empty input scores 0', () => {
  assert.equal(scoreDrawing([], box), 0);
  assert.equal(scoreDrawing(box.flat(), []), 0);
});
test('far-away scribble scores low', () => {
  const user: Pt[] = [[0.95,0.95],[0.9,0.95],[0.95,0.9]];
  assert.ok(scoreDrawing(user, box) <= 20);
});
test('partial coverage scores middle', () => {
  const user = box[0]; // 1画だけ
  const s = scoreDrawing(user, box);
  assert.ok(s > 20 && s < 90);
});
```

- [ ] **Step 2: テストが落ちるのを確認**

Run: `cd app && node --import tsx --test src/kakitori/score.test.ts`
Expected: FAIL（`score` 未実装）

- [ ] **Step 3: 実装を書く**

`app/src/kakitori/score.ts`：
```ts
export type Pt = [number, number];
const TOL = 0.08;           // 手本近傍とみなす正規化距離
const SPILL = 2 * TOL;      // これ超で「はみ出し」

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function nearest(p: Pt, pts: Pt[]): number {
  let m = Infinity;
  for (const q of pts) { const d = dist(p, q); if (d < m) m = d; }
  return m;
}

/** 手本(model=画ごと点列)への「形の近さ」を0..100で返す純関数。 */
export function scoreDrawing(user: Pt[], model: Pt[][]): number {
  const modelPts = model.flat();
  if (user.length === 0 || modelPts.length === 0) return 0;
  let accSum = 0, spill = 0;
  for (const p of user) {
    const d = nearest(p, modelPts);
    accSum += Math.max(0, 1 - d / TOL);   // 手本上=1, TOL以遠=0
    if (d > SPILL) spill += 1;
  }
  const accuracy = accSum / user.length;
  const spillRatio = spill / user.length;
  let covered = 0;
  for (const q of modelPts) if (nearest(q, user) <= TOL) covered += 1;
  const coverage = covered / modelPts.length;
  const raw = 0.5 * accuracy + 0.5 * coverage - 0.3 * spillRatio;
  return Math.round(100 * Math.min(1, Math.max(0, raw)));
}
```

- [ ] **Step 4: テストが通るのを確認 & test スクリプトに追加**

`app/package.json` の `"test"` 末尾に ` src/kakitori/score.test.ts` を追加。
Run: `cd app && npm test`
Expected: 既存32＋新4 = 全て PASS

- [ ] **Step 5: Commit**

```bash
git -C app add src/kakitori/score.ts src/kakitori/score.test.ts package.json && git -C app commit -m "feat(kakitori): pure-JS closeness scoring with tests"
```

---

### Task 3: store に kakitori 状態と reducer を追加

**Files:**
- Modify: `app/src/store/state.ts`（AppState/INITIAL_STATE）
- Modify: `app/src/store/store.tsx`（Action union / reducer case / dispatch helper）

**Interfaces:**
- Produces: `AppState.kakitori: Record<string, { step: number; stars: number; best: number }>`（キー=char）。dispatchヘルパ `recordKakitori(char: string, step: number, score: number)`。action `{ type:'KAKITORI_PROGRESS'; char; step; score }`。

- [ ] **Step 1: state.ts に型と初期値**

`AppState` に `kakitori: Record<string, { step: number; stars: number; best: number }>;` を追加。`INITIAL_STATE` に `kakitori: {},` を追加。

- [ ] **Step 2: store.tsx に action と reducer**

`type Action =` union に追加:
```ts
  | { type: 'KAKITORI_PROGRESS'; char: string; step: number; score: number }
```
reducer に case 追加（`RESET` の前）:
```ts
    case 'KAKITORI_PROGRESS': {
      const prev = state.kakitori[action.char] ?? { step: 0, stars: 0, best: 0 };
      const next = {
        step: Math.max(prev.step, action.step),
        stars: Math.max(prev.stars, action.step),
        best: Math.max(prev.best, action.score),
      };
      return { ...state, kakitori: { ...state.kakitori, [action.char]: next } };
    }
```
dispatchヘルパ（`recordMockResult` 付近）に追加:
```ts
    recordKakitori: (char: string, step: number, score: number) =>
      dispatch({ type: 'KAKITORI_PROGRESS', char, step, score }),
```
※ HYDRATE 後に旧保存へ `kakitori` が無い場合に備え、reducer の `HYDRATE` かセレクタ側で `state.kakitori ?? {}` を担保（`state.kakitori` 参照箇所は必ず `?? {}` でガード）。

- [ ] **Step 3: 型チェック**

Run: `cd app && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git -C app add src/store/state.ts src/store/store.tsx && git -C app commit -m "feat(kakitori): persist per-kanji writing progress in store"
```

---

### Task 4: ナビゲーション（カードタブ / 辞書モーダル / 書き取りルート）

**Files:**
- Modify: `app/src/navigation/types.ts`
- Modify: `app/App.tsx`
- Modify: `app/src/screens/BrowseScreen.tsx`

**Interfaces:**
- Produces: RootStack に `Browse: { view?: 'kanji' | 'vocab' | 'grammar' } | undefined` と `Kakitori: undefined`。タブ `カード`=`CardsScreen`。

- [ ] **Step 1: types.ts にルート追加**

`RootStackParamList` に:
```ts
  Browse: { view?: 'kanji' | 'vocab' | 'grammar' } | undefined;
  Kakitori: undefined;
```

- [ ] **Step 2: App.tsx の TABS 並べ替え & Browse をモーダル化**

`TABS` を並べ替え、辞書エントリを Cards に置換（`import CardsScreen`）:
```ts
const TABS = [
  { name: 'ホーム', component: HomeScreen, icon: 'home', iconOff: 'home-outline', labelKey: 'nav.home' },
  { name: 'カード', component: CardsScreen, icon: 'albums', iconOff: 'albums-outline', labelKey: 'cards.tab' },
  { name: '学習', component: StudyScreen, icon: 'book', iconOff: 'book-outline', labelKey: 'study.tab' },
  { name: 'テスト', component: TestScreen, icon: 'clipboard', iconOff: 'clipboard-outline', labelKey: 'test.tab' },
  { name: '設定', component: ProfileScreen, icon: 'settings', iconOff: 'settings-outline', labelKey: 'profile.tab' },
] as const;
```
RootStack.Navigator の他モーダル（Reading/Listening）と並べて追加:
```tsx
            <RootStack.Screen name="Browse" component={BrowseScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Kakitori" component={KakitoriScreen} options={{ presentation: 'modal' }} />
```
（`import BrowseScreen`、`import KakitoriScreen` を追加。BrowseScreen は TABS から外す）

- [ ] **Step 3: BrowseScreen が view パラメータで初期タブを決める**

`app/src/screens/BrowseScreen.tsx`：`useRoute` で `route.params?.view` を取り、
`const [kubun, setKubun] = useState<Kubun>('vocab');` を
`const [kubun, setKubun] = useState<Kubun>(route.params?.view ?? 'vocab');` に変更。
モーダルなので戻る導線（右上に閉じるボタン／ヘッダ）を1つ追加（既存の見出し行に `nav.goBack()` の×を置く）。

- [ ] **Step 4: 型チェック**

Run: `cd app && npx tsc --noEmit`
Expected: エラーなし（CardsScreen/KakitoriScreen は次タスクで作成するため、先に空コンポーネントの雛形を置いて通す→Task5/6で中身）。

雛形（先に置く）: `app/src/screens/CardsScreen.tsx` と `KakitoriScreen.tsx` に
```tsx
import { View, Text } from 'react-native';
export default function CardsScreen() { return <View><Text>Cards</Text></View>; }
```
（Kakitori も同様）

- [ ] **Step 5: Commit**

```bash
git -C app add src/navigation/types.ts App.tsx src/screens/BrowseScreen.tsx src/screens/CardsScreen.tsx src/screens/KakitoriScreen.tsx && git -C app commit -m "feat(cards): add Cards tab, demote dictionary to modal, add Kakitori route"
```

---

### Task 5: CardsScreen（3カード＋カバー率移設＋リンク）

**Files:**
- Modify: `app/src/screens/CardsScreen.tsx`（雛形→本実装）

**Interfaces:**
- Consumes: `selectors.coverageBars(state, now): {key:'kanji'|'vocab'|'grammar';learned;total}[]`、`state.kakitori`、`Badge`、`badgeTierIndex`、i18n。
- Produces: 画面。ナビ: `nav.navigate('Browse',{view})`、`nav.navigate('Kakitori')`。

- [ ] **Step 1: 実装**

StudyScreen の `makeStyles`/カード意匠を踏襲。各カード（漢字/語彙/文法）に:
- 見出し `t('cards.kanji'|'cards.vocab'|'cards.grammar')`
- カバー率: `coverageBars` の該当行から `learned/total` バー＋`<Badge set={badgeSet} metric="cover" pct={pct} size={60}/>`＋`t('home.coverTier'+badgeTierIndex(pct))`（ホーム④と同じ表示・既存i18n流用）
- リンク: 漢字→`Browse{view:'kanji'}` ボタン `t('cards.kanji_list')`、語彙→`Browse{view:'vocab'}` `t('cards.vocab_list')`、文法→`Browse{view:'grammar'}` `t('cards.grammar_list')`
- 漢字カードのみ追加: 「書き取り」ボタン `t('cards.kakitori_entry')`→`nav.navigate('Kakitori')`、進捗 `t('cards.kakitori_progress',{done,total})`（done=`Object.values(state.kakitori??{}).filter(k=>k.step>=3).length`、total=10）

`pct` は `b.total>0 ? Math.round(100*b.learned/b.total) : 0`。`badgeSet=state.settings.badgeSet??'gorgeous'`。
UIパターン（カード/Pressable/影/角丸）は `StudyScreen.tsx` の `makeStyles` をそのまま参考にする（`shadow(1)`, `radius.lg`, `c.surface` 等）。

- [ ] **Step 2: 型チェック & 起動確認**

Run: `cd app && npx tsc --noEmit`
Expected: エラーなし
Run（web束ね確認）: `cd app && npx expo export --platform web 2>&1 | tail -5` もしくは既存の確認手段。
Expected: バンドル成功。

- [ ] **Step 3: Commit**

```bash
git -C app add src/screens/CardsScreen.tsx && git -C app commit -m "feat(cards): 3 cards with moved coverage bars/badges and dictionary links"
```

---

### Task 6: KakitoriScreen（描画＋3ステップ＋採点＋星）

**Files:**
- Modify: `app/src/screens/KakitoriScreen.tsx`（雛形→本実装）

**Interfaces:**
- Consumes: `kakitoriSample.json`、`scoreDrawing`/`Pt`、`recordKakitori`、react-native-svg（`Svg,Polyline`）、PanResponder。

- [ ] **Step 1: 実装**

構成:
- state: `idx`（何字目 0..9）、`step`（0=trace,1=guided,2=recall）、`userPts: Pt[]`、`lastScore: number|null`。
- 現在字 `k = data[idx]`。描画領域は正方形（例 一辺 `SIZE=300`）。正規化↔px変換 `toPx([x,y])=[x*SIZE,y*SIZE]`。
- **PanResponder**: `onPanResponderMove` で `evt.nativeEvent.locationX/Y` を `/SIZE` 正規化して `userPts` に push（`onStartShouldSetPanResponder=()=>true`）。
- **描画（react-native-svg）**:
  - 手本: step 0=濃く（opacity 0.5）, step 1=薄く（opacity 0.18）, step 2=非表示。各画を `<Polyline points={stroke.map(toPx)} stroke="#8aa" .../>`。
  - ユーザー: `<Polyline points={userPts.map(toPx)} stroke={c.blue} strokeWidth={10} fill="none"/>`。
- **操作ボタン**:
  - 「採点」`t('kakitori.grade')`: `const s=scoreDrawing(userPts, k.strokes as Pt[][]); setLastScore(s);` 合格(`s>=70`)なら `recordKakitori(k.char, step+1, s)` → 次stepへ（step<2）またはstep2合格で次字へ（`idx++`, step=0）。表示 `t('kakitori.score',{n:s})`＋合否 `t('kakitori.pass'|'kakitori.retry')`。
  - 「消す」`t('kakitori.clear')`: `setUserPts([])`。
- **ヘッダ**: 字・`t('kakitori.step_trace'|_guided|_recall)`・星（`state.kakitori[k.char]?.stars` を★で）。全字マスターで `t('kakitori.mastered')` 表示。閉じる×で `nav.goBack()`。
- 端条件: `userPts` 空で採点→`scoreDrawing`が0を返す（クラッシュしない）。`data[idx]` 欠損は `idx>=data.length` で完了画面。

閾値・重みは Global Constraints と score.ts の定数に一致（PASS=70）。

- [ ] **Step 2: 型チェック**

Run: `cd app && npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 実行時スモーク**

Run: `cd app && node --import tsx src/kakitori/data.check.mjs`（データ健全性再確認）
Expected: `OK 10 kanji, strokes normalized`
（描画は実機/webで目視。ここではクラッシュ要因＝データとscoreの健全性を担保）

- [ ] **Step 4: Commit**

```bash
git -C app add src/screens/KakitoriScreen.tsx && git -C app commit -m "feat(kakitori): 3-step tracing screen with closeness grading and stars"
```

---

### Task 7: ホーム掃除＋i18n＋謝辞＋最終検証

**Files:**
- Modify: `app/src/screens/HomeScreen.tsx`
- Modify: `app/src/i18n/en.json`, `app/src/i18n/ja.json`
- Modify: 謝辞表示元（`app/src/i18n/*` の credits か設定の謝辞画面。既存のKANJIDIC/JMdict/Waller表記に併記）

- [ ] **Step 1: ホームの④カバー率ブロックを撤去**

`HomeScreen.tsx` の `{/* ④ カバー率(量)... */}` の見出し `home.coverage_title` と `cov.map(...)` ブロックを削除。`cov` 変数が他で未使用になるなら定義も削除（`coverageBars` 呼び出し）。レイアウト（成長カードの閉じ `</View>` 等）を壊さないよう確認。

- [ ] **Step 2: i18n キー追加（en/ja）**

`en.json` / `ja.json` に追加（他9言語は後日）:
```
cards.tab, cards.kanji, cards.vocab, cards.grammar,
cards.kanji_list, cards.vocab_list, cards.grammar_list,
cards.kakitori_entry, cards.kakitori_progress ("書き取り {done}/{total}" / "Writing {done}/{total}"),
kakitori.title, kakitori.step_trace, kakitori.step_guided, kakitori.step_recall,
kakitori.grade, kakitori.clear, kakitori.pass, kakitori.retry,
kakitori.score ("スコア {n}" / "Score {n}"), kakitori.mastered
```
ja例: `cards.tab`="カード", `cards.kanji`="漢字", `cards.kanji_list`="漢字リスト", `cards.kakitori_entry`="書き取り", `kakitori.step_trace`="なぞり書き", `kakitori.step_guided`="手本を見て書く", `kakitori.step_recall`="見ないで書く", `kakitori.pass`="合格！", `kakitori.retry`="もう一度"。
en例: `cards.tab`="Cards", `cards.kanji`="Kanji", `kakitori.step_trace`="Trace", `kakitori.step_guided`="Copy", `kakitori.step_recall`="From memory"。

- [ ] **Step 3: KanjiVG 謝辞を追加**

既存の出典表記（KANJIDIC2/JMdict © EDRDG、Waller CC BY）に併記: "Stroke data: KanjiVG © Ulrich Apel, CC BY-SA 3.0"。

- [ ] **Step 4: 最終検証**

Run: `cd app && npx tsc --noEmit && npm test && node --import tsx src/kakitori/data.check.mjs`
Expected: tsc エラーなし・全テスト PASS・`OK 10 kanji`

- [ ] **Step 5: Commit**

```bash
git -C app add src/screens/HomeScreen.tsx src/i18n/en.json src/i18n/ja.json && git -C app commit -m "feat(cards): remove home coverage block, add i18n and KanjiVG credit"
```

---

## Self-Review

- **Spec coverage:** ①ナビ=Task4 / ②CardsScreen=Task5 / ③Home撤去=Task7 / ④Browse view=Task4 / ⑤書き取りデータ=Task1・採点=Task2・画面=Task6・永続化=Task3 / i18n・謝辞=Task7 / テスト=Task2,1,7。全項目に対応タスクあり。
- **Placeholder scan:** コード必要箇所（score.ts, テスト, reducer, データ生成, check.mjs）は完全コード。UI（Cards/Kakitori）は既存 StudyScreen パターン参照＋キー挙動を明記（完全な画面ソースは既存意匠依存のため実装時に踏襲）。
- **Type consistency:** `Pt=[number,number]`、`scoreDrawing(user:Pt[],model:Pt[][]):number`、`recordKakitori(char,step,score)`、`state.kakitori[char]={step,stars,best}`、`kakitoriSample.json` 要素 `{char,level,strokes:number[][][]}` を全タスクで一致使用。閾値 PASS=70 / TOL=0.08 を score.ts と Kakitori で共有。
