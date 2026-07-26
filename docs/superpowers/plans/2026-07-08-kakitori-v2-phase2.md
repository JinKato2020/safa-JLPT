# 漢字書き取り v2 第2弾（UX/学習最適化）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** 実機フィードバックのUX9件を実装 — プルダウン化・お手本とヒント統合・自由練習で3モード・出題順SRS優先・リスト戻る＋漢字行タップ→詳細→書き取り自由練習・読み二重解消＋全漢字ふりがな・カード=対象レベル読み・「カード」タブ→「単語」タブ。

**Architecture:** 既存 `KakitoriScreen`/`engineHtml`/`BrowseScreen` を最小侵襲で改修し、新規 `KanjiDetailScreen`（漢字→書き取りのハブ）を追加。SRS出題順は純関数セレクタに切り出す。

**Tech Stack:** React Native/Expo SDK54, TypeScript, HanziWriter(WebView)。テスト=`node --import tsx --test`（node:test）。

## Global Constraints

- 設計: `docs/superpowers/specs/2026-07-08-kakitori-v2-corrections-design.md`（第2弾セクション）。
- テスト jest 不使用。純関数は `node:test`＋`node:assert/strict`・`.ts` import・`package.json` の `test` に登録。
- UI言語 en/ja のみ（i18nキーは両方）。既存の意匠/コンポーネント（RubyText, AppButton, chip系, theme spacing/radius/type）を踏襲・新規スタイル乱造しない。
- 状態/後方互換・null安全維持。各タスク末で該当テスト＋`npm run tsc`（`cd app`）緑・コミット。
- KakitoriScreenに触れるタスク（T2〜T5）は順次（並行実装しない）。

---

### Task 1: 「カード」タブ →「単語」タブ にリネーム

**Files:** Modify `app/src/i18n/en.json` / `ja.json`（`cards.tab`）, （任意）`app/App.tsx:46`（アイコン）

- [ ] **Step 1: ラベル変更**

- `app/src/i18n/ja.json` の `"cards.tab": "カード"` → `"単語"`。
- `app/src/i18n/en.json` の `"cards.tab": "Cards"` → `"Words"`。
- （任意）`app/App.tsx:46` のタブアイコンを語彙寄りに変更してよい（`albums`→`language` 等・Ioniconsに存在するもの）。**ルート名 `name: 'カード'` は内部識別子なので変更しない**（ナビ参照の破壊回避）。

- [ ] **Step 2: 検証＋Commit**

Run（`cd app`）: `npm run tsc` → エラーなし。
```bash
git add app/src/i18n/en.json app/src/i18n/ja.json app/App.tsx
git commit -m "feat(kakitori): rename Cards tab to Words (単語)"
```

---

### Task 2: KakitoriScreen ツールバー — お手本/ヒント統合＋グリッド/速度プルダウン

**Files:** Modify `app/src/screens/KakitoriScreen.tsx`

現状: ツールバーに チップ [田][米][×]・速度トグル・[ドリル/自由]・[↻お手本(animate)]・[ヒント(showAnswer)]・[消す(clear)]。まず現物を読むこと。

- [ ] **Step 1: お手本とヒントを1ボタンに統合**

- 「お手本(`KW.animate()`)」と「ヒント(`KW.showAnswer()`)」の2ボタンを、**1ボタン「お手本」= `KW.showAnswer()`**（外形表示＋アニメ＝救済も兼ねる）に統合。`animate()` 単独ボタンは廃止（`showAnswer` がアニメも行う）。`readyRef.current` ガードは維持。i18n は既存 `kakitori.show_model`（お手本）を使い、`kakitori.hint` の使用箇所を撤去（キーは残置可）。

- [ ] **Step 2: グリッド/速度をプルダウン化**

- 田/米/なしの3チップ → **1つのプルダウン**（現在値を表示、タップで3択）。速度(slow/normal/fast)も同様にプルダウン。
- 追加ライブラリは使わない。軽量な自作ドロップダウン: 押すと小さな `Modal`(transparent) or 画面内の選択リストを開き、選ぶと `setSettings({...})` して閉じる。既存の chip 意匠を流用したメニュー項目でよい。2つ（グリッド・速度）で共通の小コンポーネントを1つ作ると DRY（例 ローカル `Dropdown({label, value, options, onSelect})`）。
- 値の保存先は既存 `settings.kakitoriGrid`/`kakitoriSpeed`（変更なし）。選択で即 `KW.setGrid`/`KW.setSpeed` が反映されるよう、既存の `useEffect([grid,speed,free])` 経由 or 直接 inject。

- [ ] **Step 3: 検証＋Commit**

Run: `npm run tsc` → エラーなし。（web export スモークは任意）
```bash
git add app/src/screens/KakitoriScreen.tsx app/src/i18n/en.json app/src/i18n/ja.json
git commit -m "feat(kakitori): merge model/hint into one button; grid & speed as dropdowns"
```

---

### Task 3: 自由練習で3モード（なぞり/見て書く/見ないで書く）選択

**Files:** Modify `app/src/kakitori/engineHtml.ts`, `app/src/screens/KakitoriScreen.tsx`

現状: 自由練習 = `KW.setFree(true)` 固定（外形表示・leniency最大・採点/前進なし）。要件: 自由の中で3モードの見え方を選べる（採点/前進なしのまま）。

- [ ] **Step 1: エンジンに「練習ステップ(前進しない)」を追加**

`engineHtml.ts` の `KW` に `setFreeStep(step)` を追加（`setStep` と同じ外形/ゴースト/leniency設定だが quiz の `onComplete` で**前進通知を出さない=採点イベントを送らない**）。実装は `setStep` を流用しつつ、`onComplete`/`onMistake` ハンドラを付けない（自由=記録しない）。`setFree(true)` は「なぞり相当(外形表示)」の既定として残すか、`setFreeStep(0)` に置換。文字列テンプレート内のエスケープに注意。
- テスト: `engineHtml.test.ts` に `setFreeStep` がHTMLに含まれる assertion を1つ追加。

- [ ] **Step 2: 画面に自由練習モード選択を追加**

- 自由練習中は「なぞり/見て書く/見ないで書く」の3択（既存 chip or Task2のDropdown流用）を表示。選択で `KW.setFreeStep(0|1|2)` を inject。採点/星/前進なし（`onComplete` は自由時は無視＝既存の free ガード踏襲）。`state.settings` に保存は不要（セッション内 state で可）。

- [ ] **Step 3: 検証＋Commit**

Run: `node --import tsx --test src/kakitori/engineHtml.test.ts`（PASS）／`npm run tsc`（クリーン）。
```bash
git add app/src/kakitori/engineHtml.ts app/src/kakitori/engineHtml.test.ts app/src/screens/KakitoriScreen.tsx
git commit -m "feat(kakitori): free practice lets you pick trace/guided/recall mode"
```

---

### Task 4: 出題順を SRS 優先に（ドリル）

**Files:** Create `app/src/kakitori/queue.ts` ＋ `app/src/kakitori/queue.test.ts`; Modify `app/src/screens/KakitoriScreen.tsx:54-56`

**Interfaces:**
- Produces: `kakitoriDrillQueue(kakitori: Record<string, KakitoriEntry>|undefined, chars: string[], today: string): string[]`
  — 優先順: ①due到来(due<=today) → ②未着手(kakitori無し) → ③苦手(stars<3、stars昇順→best昇順) → ④習得済(stars>=3、due遠い順)。安定ソート。入力 `chars` は級の全漢字(`kanjiListFor(level)`)。

- [ ] **Step 1: 失敗するテストを書く**

`app/src/kakitori/queue.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kakitoriDrillQueue } from './queue.ts';

const T = '2026-07-10';
test('due到来→未着手→苦手→習得済 の順', () => {
  const k = {
    済: { step:3, stars:3, best:100, due:'2026-08-01' },      // 習得済(未due)
    苦: { step:2, stars:1, best:70 },                          // 苦手(低星)
    期: { step:3, stars:3, best:100, due:'2026-07-09' },       // due到来
  };
  const chars = ['済','未','苦','期']; // 未=未着手
  assert.deepEqual(kakitoriDrillQueue(k, chars, T), ['期','未','苦','済']);
});
test('kakitori未定義は入力順のまま', () => {
  assert.deepEqual(kakitoriDrillQueue(undefined, ['a','b'], T), ['a','b']);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --import tsx --test src/kakitori/queue.test.ts` → FAIL（module not found）。

- [ ] **Step 3: 実装**

`app/src/kakitori/queue.ts`:
```ts
// 書き取りドリルの出題順(SRS優先・純関数)。①due到来→②未着手→③苦手→④習得済。
import type { KakitoriEntry } from './srs';

export function kakitoriDrillQueue(
  kakitori: Record<string, KakitoriEntry> | undefined,
  chars: string[],
  today: string,
): string[] {
  if (!kakitori) return [...chars];
  const rank = (c: string): number => {
    const e = kakitori[c];
    if (e?.due && e.due <= today) return 0;      // ①due到来
    if (!e) return 1;                            // ②未着手
    if ((e.stars ?? 0) < 3) return 2;            // ③苦手
    return 3;                                    // ④習得済
  };
  return chars
    .map((c, i) => ({ c, i, r: rank(c) }))
    .sort((a, b) => {
      if (a.r !== b.r) return a.r - b.r;
      if (a.r === 2) { // 苦手内: stars昇順→best昇順
        const ea = kakitori[a.c]!, eb = kakitori[b.c]!;
        if ((ea.stars ?? 0) !== (eb.stars ?? 0)) return (ea.stars ?? 0) - (eb.stars ?? 0);
        if ((ea.best ?? 0) !== (eb.best ?? 0)) return (ea.best ?? 0) - (eb.best ?? 0);
      }
      return a.i - b.i; // 安定
    })
    .map((x) => x.c);
}
```

- [ ] **Step 4: 成功を確認**

Run: `node --import tsx --test src/kakitori/queue.test.ts` → PASS。

- [ ] **Step 5: ドリルモードに配線**

`KakitoriScreen.tsx` の `chars` useMemo のドリル分岐（現 `return kanjiListFor(level);`）を:
```ts
    return kakitoriDrillQueue(state.kakitori, kanjiListFor(level), dayOf(Date.now()));
```
（review分岐は不変。import 追加。deps は `[mode, level]` のまま＝セッション開始時スナップショット固定を維持＝mastering中に順が動かない。）

- [ ] **Step 6: 検証＋Commit**

Run: `npm run tsc` → クリーン。
```bash
git add app/src/kakitori/queue.ts app/src/kakitori/queue.test.ts app/src/screens/KakitoriScreen.tsx
git commit -m "feat(kakitori): SRS-first drill order (due, new, weak, mastered)"
```

---

### Task 5: Kakitori 単字自由練習パラメータ（`char`）

**Files:** Modify `app/src/navigation/types.ts`, `app/src/screens/KakitoriScreen.tsx`

漢字詳細画面の「書き取り練習」から1字だけを自由練習するための入口。

- [ ] **Step 1: ナビ型に char を追加**

`app/src/navigation/types.ts` の `Kakitori` を:
```ts
  Kakitori: { level?: 'N5' | 'N4' | 'N3'; mode?: 'drill' | 'review'; char?: string } | undefined;
```

- [ ] **Step 2: char 指定時は当該1字を自由練習**

`KakitoriScreen.tsx`:
- `const singleChar = route.params?.char;`
- `chars` useMemo: `if (singleChar) return [singleChar];`（最優先）。
- `singleChar` 指定時は初期を自由練習に: `const [free, setFree] = useState(singleChar ? true : state.settings.kakitoriMode === 'free');`
- deps に影響しない範囲で最小変更。単字の場合、完了後は done 画面（`idx>=1`）でよい。

- [ ] **Step 3: 検証＋Commit**

Run: `npm run tsc` → クリーン。
```bash
git add app/src/navigation/types.ts app/src/screens/KakitoriScreen.tsx
git commit -m "feat(kakitori): Kakitori accepts a single char for free practice"
```

---

### Task 6: 漢字詳細画面 KanjiDetailScreen（新規）

**Files:** Create `app/src/screens/KanjiDetailScreen.tsx`; Modify `app/App.tsx`（RootStack登録・import）, `app/src/navigation/types.ts`（`KanjiDetail: { char: string }`）, `app/src/i18n/*`

詳細＝**全読み**（音訓・全レベル）＋意味＋例語＋「書き取り練習」ボタン。読みは既存 `KANJI_CARD_READINGS`（全読み）を使用。例語は**語全体ルビ**。

- [ ] **Step 1: ナビ型＋登録**

- `types.ts` に `KanjiDetail: { char: string };` 追加。
- `App.tsx` に `import KanjiDetailScreen from './src/screens/KanjiDetailScreen';` と `<RootStack.Screen name="KanjiDetail" component={KanjiDetailScreen} options={{ presentation: 'modal' }} />`（Browse と同様）。

- [ ] **Step 2: 画面実装**

`app/src/screens/KanjiDetailScreen.tsx`（既存 BrowseScreen の意匠/RubyText/`KANJI_CARD_READINGS`/`kanjiInfo` を参考に）:
- ヘッダ: ×戻る（`nav.goBack()`）＋大きな漢字。
- 意味（`kanjiInfo(char)?.meaning` or KANJI）＋画数。
- **全読み**（音/訓）を `KANJI_CARD_READINGS[char]` から一覧（例語つき・**語全体ルビ**でその語の全漢字が読める形）。
- CTA「書き取り練習」→ `nav.navigate('Kakitori', { char })`（Task 5）。
- i18n: `kanjiDetail.practice`（書き取り練習/Practice writing）等の必要キーを en/ja に追加。

- [ ] **Step 3: 検証＋Commit**

Run: `npm run tsc` → クリーン。（web bundle スモーク任意）
```bash
git add app/src/screens/KanjiDetailScreen.tsx app/App.tsx app/src/navigation/types.ts app/src/i18n/en.json app/src/i18n/ja.json
git commit -m "feat(kanji): KanjiDetail screen (full readings + writing-practice link)"
```

---

### Task 7: BrowseScreen — 戻る＋漢字行タップ→詳細＋カード=対象レベル読み＋全漢字ふりがな＋二重解消

**Files:** Modify `app/src/screens/BrowseScreen.tsx`; Modify `app/src/data/index.ts`（未使用の `kanjiLevelReadings.json` を export）

現状（要現物確認）: `headReading`（要約行・189-192で描画）と `cardReadingLines`（詳細行・195-216）で読みが二重。行は `View`（タップ不可）。ヘッダ/戻る無し。例語ルビは対象漢字だけ。

- [ ] **Step 1: レベル別読みデータを export**

`app/src/data/index.ts` に未使用の `kanjiLevelReadings.json`（既にimport行あり）を `export const KANJI_LEVEL_READINGS = kanjiLevelReadings as Record<string, Array<{reading:string; type:'on'|'kun'; examples:[string,string][]}>>;` として公開（既存の import を確認し重複しないように）。

- [ ] **Step 2: 戻るボタン**

- `BrowseScreen` にヘッダ（×戻る `nav.goBack()`）を追加（modalのスワイプ下げに加えて明示ボタン）。既存の見出し/検索バー付近に配置し意匠を合わせる。`useNavigation` を import。

- [ ] **Step 3: 漢字行タップ→詳細**

- 漢字区分(`kanji`)の行を `Pressable` 化 → `nav.navigate('KanjiDetail', { char })`（Task 6）。語彙/文法行は現状維持（タップ不要）。

- [ ] **Step 4: カード=対象レベル読み＋二重解消＋全漢字ふりがな**

- 漢字カードの読み表示を、**要約行(`headReading`)を削除**し詳細行のみに（二重解消）。
- 詳細行の読み源を `KANJI_CARD_READINGS`（全読み）→ **`KANJI_LEVEL_READINGS[char]`（対象レベル絞込）** に切替（外→がい/そと/ほか のみ・げ/はず 等は詳細画面へ）。データ形が異なる（`{reading,type,examples:[[word,reading]]}` の配列）ので `cardReadingLines` を調整 or 新レンダラで対応。
- 例語のルビを**語全体ルビ**（`RubyText` で 語の上に語全体の読み）に変更＝例語中の全漢字が読める。従来の「対象漢字だけルビ」をやめる。

- [ ] **Step 5: 検証＋Commit**

Run: `npm run tsc` → クリーン。実行時: `KANJI_LEVEL_READINGS[char]` 欠け時の空配列ガード。
```bash
git add app/src/screens/BrowseScreen.tsx app/src/data/index.ts
git commit -m "feat(kanji): browse kanji rows tap→detail, back button, level-only readings, whole-word furigana"
```

---

### Task 8: 仕上げ（テスト登録・全体グリーン・実行時検証）

**Files:** Modify `app/package.json`（test）

- [ ] **Step 1: 新規テスト登録**

`app/package.json` の `test` に `src/kakitori/queue.test.ts` を追加（`ls src/kakitori/*.test.ts` で存在確認して登録）。

- [ ] **Step 2: 全テスト＋型**

Run: `npm test` → 全PASS（件数報告）。`npm run tsc` → クリーン。

- [ ] **Step 3: 実行時スポットチェック（コード確認）**

- タブ「単語」表示・お手本1ボタン・グリッド/速度プルダウン・自由3モード・ドリルSRS順・Browse戻る＆漢字タップ→詳細→練習の導線・カード=レベル読み・語全体ルビ が破綻なく繋がること（型/参照で確認）。
- 旧state・欠け読み・欠け字形のガード維持。

- [ ] **Step 4: Commit**
```bash
git add app/package.json
git commit -m "chore(kakitori): register drill-queue test, verify phase2 green"
```

---

## Self-Review 結果（spec対応）

- ② プルダウン → Task 2 Step2。③ 統合 → Task 2 Step1。⑦ 自由3モード → Task 3。⑧ SRS順 → Task 4。⑨ 戻る → Task 7 Step2。⑩(nav)+⑫ 行タップ→詳細→練習 → Task 5+6+7 Step3。⑪ 読み二重＋全漢字ふりがな → Task 7 Step4。⑫ カード=レベル読み → Task 7 Step4（+Task6詳細=全読み）。（新）単語タブ → Task 1。
- 未解決の実装時判断（明示）: Dropdown/詳細画面/読みレンダラは既存 BrowseScreen の意匠・RubyText・データ形に合わせて現物調整（各タスクで現物読込）。engineHtml `setFreeStep` のエスケープ（Task3で tsc＋test 確認）。
