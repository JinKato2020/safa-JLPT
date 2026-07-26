# 学習構造リニューアル Spec A 実装計画（タブ再編・模試整理・単語タブ自レベル化）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タブを「ホーム/単語/学習/辞書/設定」に再編し、ミニ模試を削除、フル模試＋信頼幅＋履歴を学習タブ最下部へ移し、単語タブを自レベル限定の学習ビューにする。

**Architecture:** 単語タブを native-stack 化（WordsHome=Cards → WordList=BrowseScreen(study)）。辞書タブ＝BrowseScreen(dict)。BrowseScreen は `mode` param で兼用。KanjiDetail はモーダルのまま `scope` param で自レベル/全読み切替。フル模試の月1ロックは純関数へ切り出す。

**Tech Stack:** React Native / Expo, @react-navigation (material-top-tabs + native-stack), TypeScript, node:test。

## Global Constraints

- タブ順: **ホーム / 単語 / 学習 / 辞書 / 設定**。テストタブは廃止。
- 単語タブ＝自レベル（`settings.level`）限定・コアデータのみ（`DICT_EXT_*` を混ぜない）。辞書タブ＝全レベル・検索・拡張辞書。
- ミニ模試は入口を断って削除。フル模試は `nav.navigate('Mock', { full: true })` のみ。MockScreen 内部の出題ビルダー（`buildExam`/`blueprintCounts`/`daimonCounts`）は変更しない。
- 学習タブ最下部に「信頼幅（`readinessFor(state,now).band`）」「模試履歴（`state.mockHistory` 直近12件）」「フル模試CTA（月1ロック・JLPT時 `test.full_*` / JFT時 `test.jft_*`）」を移設。既存 `test.full_*`/`test.jft_*`/`test.band_*`/`test.history_*`/`test.locked_*`/`test.start_btn` を流用。`test.mini_*` は削除。
- KanjiDetail: `scope: 'level' | 'all'`（既定 `'all'`）。`'level'`＝`KANJI_LEVEL_READINGS[char]`（当該レベル読み/例のみ）、`'all'`＝現行 `KANJI_CARD_READINGS[char]`（全読み）。
- 新規テストは `app/package.json` の `test` スクリプトに登録する。
- Git repo は `app/`。commit 対象は `app/` 配下のみ。テストは `cd app && node --import tsx --test <files>`。tsc は `cd app && npx tsc --noEmit`。

---

## ファイル構成

- Create `app/src/mock/fullMockLock.ts` — 純関数 `fullMockLocked(history, now)`。フル模試の月1ロック判定。
- Create `app/src/mock/fullMockLock.test.ts` — 同テスト。
- Create `app/src/words/levelList.ts` — 純関数 `levelListFor(kubun, level)`。コアデータの当該レベル配列。
- Create `app/src/words/levelList.test.ts` — 同テスト。
- Modify `app/src/screens/KanjiDetailScreen.tsx` — `scope` param＋自レベル読みビルダー。
- Modify `app/src/screens/BrowseScreen.tsx` — `mode` param（study/dict）＋自レベル固定・chrome非表示・コアのみ・漢字タップ scope、×のタブ非表示。
- Modify `app/src/screens/CardsScreen.tsx` — カード→`WordList` push（`Browse` モーダル廃止）。
- Modify `app/src/screens/StudyScreen.tsx` — 最下部に信頼幅＋履歴＋フル模試CTA。
- Delete `app/src/screens/TestScreen.tsx`。
- Modify `app/App.tsx` — WordsStack 新設・辞書タブ追加・テストタブ/Browseモーダル撤去。
- Modify `app/src/navigation/types.ts` — `WordsStackParamList` 追加・`KanjiDetail` に `scope`・`Browse` 撤去。
- Modify `app/src/i18n/ja.json`, `app/src/i18n/en.json` — `dict.tab` 追加・`test.mini_*` 削除。
- Modify `app/package.json` — test スクリプトに2テスト追記。

---

### Task 1: 純関数 fullMockLocked ＋ levelListFor（テスト付き）

**Files:**
- Create: `app/src/mock/fullMockLock.ts`, `app/src/mock/fullMockLock.test.ts`
- Create: `app/src/words/levelList.ts`, `app/src/words/levelList.test.ts`
- Modify: `app/package.json`

**Interfaces:**
- Produces: `fullMockLocked(history: MockHistoryEntry[], now: number): { locked: boolean; next: { y: number; m: number; d: number } }`
- Produces: `levelListFor(kubun: 'kanji' | 'vocab' | 'grammar', level: string): StudyItem[]`

- [ ] **Step 1: fullMockLock の失敗テストを書く**

Create `app/src/mock/fullMockLock.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fullMockLocked } from './fullMockLock.ts';

const h = (day: string, full: boolean) => ({ day, pct: 50, full });

test('同一暦月にフル受験済み→locked、翌月1日がnext', () => {
  const now = Date.UTC(2026, 6, 15); // 2026-07-15
  const r = fullMockLocked([h('2026-07-03', true)], now);
  assert.equal(r.locked, true);
  assert.deepEqual(r.next, { y: 2026, m: 8, d: 1 });
});

test('12月受験→翌年1月1日がnext', () => {
  const now = Date.UTC(2026, 11, 20);
  const r = fullMockLocked([h('2026-12-02', true)], now);
  assert.equal(r.locked, true);
  assert.deepEqual(r.next, { y: 2027, m: 1, d: 1 });
});

test('先月のフルのみ→unlocked', () => {
  const now = Date.UTC(2026, 6, 15);
  assert.equal(fullMockLocked([h('2026-06-28', true)], now).locked, false);
});

test('ミニ(full=false)しかない→unlocked', () => {
  const now = Date.UTC(2026, 6, 15);
  assert.equal(fullMockLocked([h('2026-07-10', false)], now).locked, false);
});

test('履歴なし→unlocked', () => {
  assert.equal(fullMockLocked([], Date.UTC(2026, 6, 15)).locked, false);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `cd app && node --import tsx --test src/mock/fullMockLock.test.ts`
Expected: FAIL（`Cannot find module './fullMockLock.ts'`）

- [ ] **Step 3: fullMockLock.ts を実装**

Create `app/src/mock/fullMockLock.ts`:

```ts
// フル模試の月1ロック判定(純関数)。旧TestScreenのthisMonth/lastFull/nextAvailロジックを移植。
// history各要素は { day: 'YYYY-MM-DD'; full: boolean } を含む(state.mockHistory)。
export interface MockHistoryEntry { day: string; full: boolean; pct?: number }

function ym(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 同一暦月にフル模試を受けていれば locked。next = 翌月1日。 */
export function fullMockLocked(
  history: MockHistoryEntry[],
  now: number,
): { locked: boolean; next: { y: number; m: number; d: number } } {
  const thisMonth = ym(now);
  const lastFull = [...history].reverse().find((m) => m.full);
  const locked = !!lastFull && lastFull.day.slice(0, 7) === thisMonth;
  const [y, m] = thisMonth.split('-').map(Number);
  const next = { y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1, d: 1 };
  return { locked, next };
}
```

注: 実アプリでは `now = Date.now()`（ローカル時刻）で呼ぶ。テストは UTC 基準で月境界を検証（`ym` は UTC 使用に統一）。実挙動は「暦月が変われば解除」で旧仕様と一致。

- [ ] **Step 4: パス確認**

Run: `cd app && node --import tsx --test src/mock/fullMockLock.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: levelListFor の失敗テストを書く**

Create `app/src/words/levelList.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelListFor } from './levelList.ts';

test('kanji N5 は当該レベルの漢字のみ・全てlevel===N5', () => {
  const r = levelListFor('kanji', 'N5');
  assert.ok(r.length > 0);
  assert.ok(r.every((i) => i.level === 'N5' && i.type === 'kanji'));
});

test('vocab N5 は当該レベルの語彙のみ', () => {
  const r = levelListFor('vocab', 'N5');
  assert.ok(r.length > 0);
  assert.ok(r.every((i) => i.level === 'N5' && i.type === 'vocab'));
});

test('grammar N4 は当該レベルの文法のみ', () => {
  const r = levelListFor('grammar', 'N4');
  assert.ok(r.every((i) => i.level === 'N4'));
});

test('存在しないレベルは空配列', () => {
  assert.deepEqual(levelListFor('kanji', 'N1').filter((i) => i.level !== 'N1'), []);
});
```

- [ ] **Step 6: 失敗を確認**

Run: `cd app && node --import tsx --test src/words/levelList.test.ts`
Expected: FAIL（モジュール無し）

- [ ] **Step 7: levelList.ts を実装**

まず `app/src/data/index.ts` で `KANJI`/`VOCAB`/`GRAMMAR` と `StudyItem` 型が export されていることを確認（BrowseScreen が `import { KANJI, VOCAB, GRAMMAR } from '../data'` 済み）。`StudyItem` 型の import 元も確認（BrowseScreen 冒頭の型 import に合わせる）。

Create `app/src/words/levelList.ts`:

```ts
// 単語タブ(自レベル学習)用: コアデータの当該レベルのみを返す純関数。拡張辞書(DICT_EXT)は含めない。
import { KANJI, VOCAB, GRAMMAR } from '../data';
import type { StudyItem } from '../data';

export type Kubun = 'kanji' | 'vocab' | 'grammar';

/** kubun の当該 level のコア項目(安定順=元データ順)。 */
export function levelListFor(kubun: Kubun, level: string): StudyItem[] {
  const src: StudyItem[] = kubun === 'kanji' ? KANJI : kubun === 'vocab' ? VOCAB : GRAMMAR;
  return src.filter((i) => i.level === level);
}
```

※ `StudyItem` が `../data` から type export されていない場合は、BrowseScreen が使っている型 import 元（例 `../data/types` 等）へ合わせる。実装時に BrowseScreen 冒頭の import を確認して同じ経路にする。

- [ ] **Step 8: パス確認**

Run: `cd app && node --import tsx --test src/words/levelList.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 9: package.json に登録**

`app/package.json` の `test` スクリプト末尾に ` src/mock/fullMockLock.test.ts src/words/levelList.test.ts` を追加。

- [ ] **Step 10: 全テスト＋tsc**

Run: `cd app && npx tsc --noEmit && node --import tsx --test src/mock/fullMockLock.test.ts src/words/levelList.test.ts`
Expected: tsc clean、9 tests PASS。

- [ ] **Step 11: Commit**

```bash
cd app && git add src/mock/fullMockLock.ts src/mock/fullMockLock.test.ts src/words/levelList.ts src/words/levelList.test.ts package.json
git commit -m "feat(revamp): フル模試ロック＋自レベルリストの純関数を追加"
```

---

### Task 2: KanjiDetail に scope param（自レベル読み対応）

**Files:**
- Modify: `app/src/screens/KanjiDetailScreen.tsx`
- Modify: `app/src/navigation/types.ts`（`KanjiDetail` に `scope`）

**Interfaces:**
- Consumes: `KANJI_LEVEL_READINGS`（`../data`・`Record<string, { reading: string; type: 'on'|'kun'; examples: [string,string][] }[]>`）、`KANJI_CARD_READINGS`（既存）。
- Produces: `KanjiDetail` param `{ char: string; scope?: 'level' | 'all' }`。

- [ ] **Step 1: types に scope を追加**

`app/src/navigation/types.ts` の

```ts
  KanjiDetail: { char: string }; // 漢字詳細(全読み＋例語＋書き取り練習への導線)
```

を

```ts
  KanjiDetail: { char: string; scope?: 'level' | 'all' }; // scope=level:自レベル読み(単語タブ) / all(既定):全読み(辞書)
```

に変更。

- [ ] **Step 2: 自レベル読みビルダーを追加**

`app/src/screens/KanjiDetailScreen.tsx` の import に `KANJI_LEVEL_READINGS` を追加（既存 `import { KANJI, KANJI_CARD_READINGS, meaningIn } from '../data';` を `import { KANJI, KANJI_CARD_READINGS, KANJI_LEVEL_READINGS, meaningIn } from '../data';` に）。

`fullWordReadingLines` 関数の直後に、自レベル読み版を追加:

```ts
// scope='level': KANJI_LEVEL_READINGS(当該レベルの読み/例のみ)から行を作る。
// examplesは [word, wordReading] の配列。先頭例を語全体ルビにする。
function levelWordReadingLines(char: string): { on: CardLine[]; kun: CardLine[] } {
  const entries = KANJI_LEVEL_READINGS[char];
  if (!entries) return { on: [], kun: [] };
  const on: CardLine[] = [];
  const kun: CardLine[] = [];
  for (const e of entries) {
    const ex = e.examples && e.examples[0];
    const line: CardLine = {
      label: e.type === 'on' ? hiraToKata(e.reading) : e.reading,
      furiWord: ex ? rubyForWord(ex[0], ex[1]) : e.reading,
    };
    (e.type === 'on' ? on : kun).push(line);
  }
  return { on, kun };
}
```

- [ ] **Step 3: scope で読みビルダーを分岐**

`KanjiDetailScreen` 本体の

```ts
  const { on, kun } = useMemo(() => fullWordReadingLines(char), [char]);
```

を

```ts
  const scope = route.params?.scope ?? 'all';
  const { on, kun } = useMemo(
    () => (scope === 'level' ? levelWordReadingLines(char) : fullWordReadingLines(char)),
    [char, scope],
  );
```

に変更。

- [ ] **Step 4: 書き取りCTAの char 遷移はそのまま**（変更不要・`nav.navigate('Kakitori', { char })`）。

- [ ] **Step 5: tsc**

Run: `cd app && npx tsc --noEmit`
Expected: clean。（`KANJI_LEVEL_READINGS` の型が `../data` に無ければ `data/index.ts` の export 型を確認し、`examples` の型に合わせて `levelWordReadingLines` の `ex[0]/ex[1]` アクセスを調整。）

- [ ] **Step 6: Commit**

```bash
cd app && git add src/screens/KanjiDetailScreen.tsx src/navigation/types.ts
git commit -m "feat(revamp): 漢字詳細にscope(level/all)=自レベル読み対応"
```

---

### Task 3: BrowseScreen に mode param（study=自レベル学習 / dict=辞書）

**Files:**
- Modify: `app/src/screens/BrowseScreen.tsx`

**Interfaces:**
- Consumes: `levelListFor`（Task1）、`KanjiDetail{ char, scope:'level' }`（Task2）。
- Produces: BrowseScreen が params `{ view?: Kubun; mode?: 'dict' | 'study' }` を受ける（`mode` 既定 `'dict'`）。

- [ ] **Step 1: params を mode 対応に（route 型をローカル化）**

BrowseScreen は単語スタック（WordList）と辞書タブの2箇所で使うため、`RouteProp<RootStackParamList,'Browse'>` 依存をやめてローカル型にする。

`import { useRoute, type RouteProp } from ...`（該当行）を確認し、route 取得部

```ts
  const route = useRoute<RouteProp<RootStackParamList, 'Browse'>>();
  const [kubun, setKubun] = useState<Kubun>(route.params?.view ?? 'vocab');
  const [level, setLevel] = useState<string>(settings.level);
```

を次に変更:

```ts
  const route = useRoute();
  const params = (route.params ?? {}) as { view?: Kubun; mode?: 'dict' | 'study' };
  const study = params.mode === 'study';
  const [kubun, setKubun] = useState<Kubun>(params.view ?? 'vocab');
  const [level, setLevel] = useState<string>(study ? settings.level : settings.level);
```

（`RootStackParamList` の import が他で未使用になれば削除。`RouteProp` も未使用なら削除。）

- [ ] **Step 2: study 時のデータソースをコア当該レベルのみに**

`levelListFor` を import（`import { levelListFor } from '../words/levelList';`）。`src` の useMemo を study 分岐に:

```ts
  const src = useMemo<StudyItem[]>(
    () =>
      study
        ? levelListFor(kubun, settings.level)
        : kubun === 'vocab' ? (sVocab ?? [...VOCAB, ...DICT_EXT_VOCAB])
        : kubun === 'kanji' ? (sKanji ?? [...KANJI, ...DICT_EXT_KANJI])
        : GRAMMAR,
    [kubun, sVocab, sKanji, study, settings.level],
  );
```

study 時は `effLevel` に依らず全件（既に当該レベルのみ）を出したいので、`results` の useMemo を study 分岐:

```ts
  const results = useMemo(() => {
    if (study) return src; // 既に当該レベルのコアのみ・検索なし
    const byLevel =
      effLevel === 'all'
        ? [...src].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
        : src.filter((i) => i.level === effLevel);
    const q = query.trim().toLowerCase();
    return q ? byLevel.filter((i) => haystack(i).includes(q)) : byLevel;
  }, [src, effLevel, query, study]);
```

- [ ] **Step 3: study 時は 検索バー / レベルチップ / 区分チップ / × を隠す**

ヘッダ部（`s.top` の中の×と検索、`s.filters` のレベル/区分チップ）を study 判定で出し分ける。該当 JSX を確認し、次の方針で編集:
- `study` の時: ×（`nav.goBack()` の Pressable）は**表示**（タブ内スタックの戻る＝区分リストから単語ホームへ戻る）。ただしラベルは「←」でも「×」でも可。**検索 TextInput は非表示**。**レベルチップ（`s.filters` のレベル選択）は非表示**。**区分チップ（KUBUN 切替）は非表示**（単一区分固定）。代わりに区分名の見出しを出す。
- `dict` の時（既定）: 現状のまま。ただし×は「タブルート（`route.params` 無し）」の時のみ非表示（辞書タブ）。

具体編集（該当行はファイルを読んで合わせる）:

(a) × Pressable（現 `onPress={() => nav.goBack()}` の `×`）を:

```tsx
        {study || route.params ? (
          <Pressable onPress={() => nav.goBack()} hitSlop={12}>
            <Text style={s.close}>{study ? '←' : '×'}</Text>
          </Pressable>
        ) : <View style={{ width: 30 }} />}
```

（辞書タブ＝`route.params` 無し＝×非表示。モーダル/スタック＝表示。）

(b) 検索 TextInput を `{!study && (<TextInput ... />)}` で包む。study 時は代わりに区分見出し `<Text style={s.title}>{t(KUBUN.find(k=>k.key===kubun)!.labelKey)}</Text>` を出す。

(c) レベルチップ／区分チップの `View style={s.filters}` ブロックを `{!study && (<View style={s.filters}>...</View>)}` で包む。

- [ ] **Step 4: 漢字行タップに scope を付与**

漢字行の遷移（現 `nav.navigate('KanjiDetail', { char: item.char })`）を、study 時は自レベル読みに:

```tsx
        <Pressable style={s.row} onPress={() => nav.navigate('KanjiDetail', { char: item.char, scope: study ? 'level' : 'all' })}>
```

- [ ] **Step 5: tsc**

Run: `cd app && npx tsc --noEmit`
Expected: clean。（`nav` の型が `RootStackParamList` を要求するため、`KanjiDetail`/`Kakitori` へ navigate できることを確認。単語スタック内から RootStack モーダルへ navigate するには親ナビゲータに解決される＝型は RootStack の Nav を使う。必要なら `useNavigation<NativeStackNavigationProp<RootStackParamList>>()` のままでよい。）

- [ ] **Step 6: Commit**

```bash
cd app && git add src/screens/BrowseScreen.tsx
git commit -m "feat(revamp): BrowseScreenにmode(study/dict)=単語タブ兼用を追加"
```

---

### Task 4: ナビ再編（単語スタック・辞書タブ・テスト/Browseモーダル撤去）＋Cardsカード遷移

**Files:**
- Modify: `app/App.tsx`
- Modify: `app/src/navigation/types.ts`
- Modify: `app/src/screens/CardsScreen.tsx`

**Interfaces:**
- Consumes: `BrowseScreen`（mode: Task3）、`CardsScreen`。
- Produces: 単語タブ = WordsStack（`WordsHome` + `WordList`）。辞書タブ = BrowseScreen(dict)。

- [ ] **Step 1: types に WordsStack を追加・Browse を撤去**

`app/src/navigation/types.ts`:
- `Browse: { view?: 'kanji' | 'vocab' | 'grammar' } | undefined;` の行を**削除**（辞書はタブ・単語はスタックで params 型は各ナビゲータ側）。
- ファイル末尾に単語スタックの param list を追加:

```ts
export type Kubun = 'kanji' | 'vocab' | 'grammar';
export type WordsStackParamList = {
  WordsHome: undefined;
  WordList: { view: Kubun; mode: 'study' };
};
```

（`RootStackParamList` から `Browse` を消したことで参照切れが出る箇所は Task3 でローカル型化済み。他に `navigate('Browse'` が無いか grep して確認。）

- [ ] **Step 2: App.tsx に WordsStack を定義**

`App.tsx` の import に `WordsStackParamList` 追加、`createNativeStackNavigator` は既に import 済み。`MainTabs` の直前に単語スタックを定義:

```tsx
const WordsStack = createNativeStackNavigator<WordsStackParamList>();
function WordsTab() {
  return (
    <WordsStack.Navigator screenOptions={{ headerShown: false }}>
      <WordsStack.Screen name="WordsHome" component={CardsScreen} />
      <WordsStack.Screen name="WordList" component={BrowseScreen} initialParams={{ mode: 'study' }} />
    </WordsStack.Navigator>
  );
}
```

- [ ] **Step 3: TABS を再編（テスト→辞書、カード=WordsTab）**

`App.tsx` の `TABS` 配列を次に置換:

```tsx
const TABS = [
  { name: 'ホーム', component: HomeScreen, icon: 'home', iconOff: 'home-outline', labelKey: 'nav.home' },
  { name: '単語', component: WordsTab, icon: 'language', iconOff: 'language-outline', labelKey: 'cards.tab' },
  { name: '学習', component: StudyScreen, icon: 'book', iconOff: 'book-outline', labelKey: 'study.tab' },
  { name: '辞書', component: BrowseScreen, icon: 'library', iconOff: 'library-outline', labelKey: 'dict.tab' },
  { name: '設定', component: ProfileScreen, icon: 'settings', iconOff: 'settings-outline', labelKey: 'profile.tab' },
] as const;
```

（辞書タブは BrowseScreen を直接タブ画面に。params 無し＝`mode` 既定 `'dict'`＝×非表示。）

- [ ] **Step 4: RootStack から Browse と Test を撤去**

`App.tsx` の RootStack から `<RootStack.Screen name="Browse" .../>` を削除。`TestScreen` の import は元々タブ経由なので、`import TestScreen` 行と旧 `テスト` タブは Step3 で消える。`BrowseScreen` import は残す（タブ＆スタックで使用）。`TestScreen` import 行を削除。

- [ ] **Step 5: CardsScreen のカード遷移を WordList push に**

`app/src/screens/CardsScreen.tsx`:
- `useNavigation` の型を単語スタック用に。冒頭 `type Nav = NativeStackNavigationProp<RootStackParamList>;` を `WordsStackParamList` ベースに変更（Kakitori 等 RootStack への navigate も要るため、複合が必要）。**簡便策**: `const nav = useNavigation<any>()` は避け、`NativeStackNavigationProp<WordsStackParamList>` を主にしつつ Kakitori/Kanji へは親経由で解決。型が厳しければ `useNavigation<NativeStackNavigationProp<WordsStackParamList & RootStackParamList>>()` として両方の name を許可。
- カードのリンクボタン（現 `onPress={() => nav.navigate('Browse', { view: card.key })}`・line 70）を:

```tsx
                onPress={() => nav.navigate('WordList', { view: card.key, mode: 'study' })}
```

- 書き取りボタン（`nav.navigate('Kakitori', ...)`）はそのまま（RootStack モーダルへは親ナビゲータが解決）。

- [ ] **Step 6: tsc**

Run: `cd app && npx tsc --noEmit`
Expected: clean。ナビゲーションの型で詰まる場合、CardsScreen/BrowseScreen の `useNavigation` を `NativeStackNavigationProp<WordsStackParamList & RootStackParamList>` にして両ナビゲータの route 名を許容する。

- [ ] **Step 7: 参照切れ確認**

Run: `cd app && grep -rn "navigate('Browse'\|name=\"Browse\"\|'Test'\|TestScreen" src App.tsx`
Expected: 出力なし（Browse モーダル/Test の参照が残っていない）。残っていれば該当を修正。

- [ ] **Step 8: Commit**

```bash
cd app && git add App.tsx src/navigation/types.ts src/screens/CardsScreen.tsx
git commit -m "feat(revamp): 単語スタック＋辞書タブ化・テスト/Browseモーダル撤去"
```

---

### Task 5: 学習タブ最下部に信頼幅＋履歴＋フル模試CTA・TestScreen削除・i18n整理

**Files:**
- Modify: `app/src/screens/StudyScreen.tsx`
- Delete: `app/src/screens/TestScreen.tsx`
- Modify: `app/src/i18n/ja.json`, `app/src/i18n/en.json`

**Interfaces:**
- Consumes: `fullMockLocked`（Task1）、`readinessFor`、`state.mockHistory`、既存 `test.*` i18n。

- [ ] **Step 1: StudyScreen に import と派生値を追加**

`app/src/screens/StudyScreen.tsx` の import に追加:

```ts
import { readinessFor } from '../store/selectors';
import { fullMockLocked } from '../mock/fullMockLock';
```

（`ringsFor` 等の既存 selectors import 行に `readinessFor` を足す形でよい。）

StudyScreen 本体（`nav`/`state`/`c`/`s` 定義付近）に:

```ts
  const isJft = (state.settings.targetExam ?? 'jft') === 'jft' ? true : (state.settings.targetExam === 'jft');
  const readiness = useMemo(() => readinessFor(state, Date.now()), [state]);
  const measured = readiness.score > 0;
  const hist = state.mockHistory ?? [];
  const recentMocks = hist.slice(-12);
  const avgPct = hist.length ? Math.round(hist.reduce((a, m) => a + m.pct, 0) / hist.length) : 0;
  const lock = fullMockLocked(hist, Date.now());
```

（`isJft` は TestScreen と同じ `const isJft = (state.settings.targetExam ?? 'jlpt') === 'jft';` にする。上の冗長版ではなく `const isJft = (state.settings.targetExam ?? 'jlpt') === 'jft';` を使うこと。）

- [ ] **Step 2: 模試ブロックの JSX を StudyScreen の ScrollView 末尾に追加**

StudyScreen の `ScrollView` の最後（既存カテゴリカード群の後）に、TestScreen から移植した以下を追加（`t` は既存の `useT()`。スタイルは StudyScreen の `makeStyles` に Step3 で追加）:

```tsx
        {/* ===== フル模試・信頼幅・履歴(旧テストタブから移設) ===== */}
        <View style={s.mockBand}>
          <Text style={s.mockBandLabel}>{t('test.band_label')}</Text>
          <Text style={s.mockBandVal}>±{readiness.band}</Text>
          <Text style={s.mockBandHint}>{measured ? t('test.band_hint_measured') : t('test.band_hint_unmeasured')}</Text>
        </View>

        {hist.length > 0 ? (
          <View style={s.mockHist}>
            <View style={s.mockHistTop}>
              <Text style={s.mockHistMain}>{t('test.history_latest', { n: hist[hist.length - 1].pct })}</Text>
              <Text style={s.mockHistSub}>{t('test.history_summary', { n: hist.length, avg: avgPct })}</Text>
            </View>
            <View style={s.mockHistBars}>
              {recentMocks.map((m, i) => (
                <View key={i} style={s.mockHistCol}>
                  <View style={[s.mockHistBar, { height: 6 + (54 * m.pct) / 100, backgroundColor: m.pct >= 80 ? c.green : m.pct >= 50 ? c.amber : c.red }]} />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={s.mockCta}>
          <View style={s.mockCtaHead}>
            <Text style={s.mockCtaTitle}>{isJft ? t('test.jft_title') : t('test.full_title')}</Text>
            {lock.locked ? <Text style={s.mockLockBadge}>{t('test.locked_badge')}</Text> : null}
            <Text style={s.mockTime}>{isJft ? t('test.jft_time') : t('test.full_time')}</Text>
          </View>
          <Text style={s.mockNote}>{isJft ? t('test.jft_note') : t('test.full_note')}</Text>
          {lock.locked ? (
            <View style={s.mockCtaDisabled}>
              <Text style={s.mockCtaDisabledTxt}>{t('test.locked_next', lock.next)}</Text>
            </View>
          ) : (
            <Pressable style={s.mockCtaBtn} onPress={() => nav.navigate('Mock', { full: true })}>
              <Text style={s.mockCtaBtnTxt}>{t('test.start_btn')}</Text>
            </Pressable>
          )}
        </View>
```

（`Pressable` が StudyScreen で未 import なら `react-native` の import に追加。`nav.navigate('Mock', ...)` は RootStack モーダル＝StudyScreen の既存 `Nav` 型で解決可能なことを確認。）

- [ ] **Step 3: StudyScreen の makeStyles に mock* スタイルを追加**

`makeStyles` の `StyleSheet.create({...})` に追加（TestScreen の該当スタイルを mock 接頭辞で移植）:

```ts
    mockBand: { backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.line, padding: spacing.lg, alignItems: 'center', marginTop: spacing.lg },
    mockBandLabel: { fontSize: ty.small, color: c.mute },
    mockBandVal: { fontSize: 40, fontWeight: '800', color: c.ink, lineHeight: 46 },
    mockBandHint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center', marginTop: spacing.xs },
    mockHist: { backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.line, padding: spacing.lg, marginTop: spacing.sm },
    mockHistTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    mockHistMain: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    mockHistSub: { fontSize: ty.tiny, color: c.mute },
    mockHistBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 64, marginTop: spacing.md },
    mockHistCol: { flex: 1, justifyContent: 'flex-end' },
    mockHistBar: { borderRadius: 2, width: '100%' },
    mockCta: { backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.line, padding: spacing.lg, marginTop: spacing.sm, gap: spacing.sm },
    mockCtaHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    mockCtaTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink, flex: 1 },
    mockLockBadge: { fontSize: ty.tiny, fontWeight: '800', color: c.mute, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line, paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radius.pill, overflow: 'hidden' },
    mockTime: { fontSize: ty.tiny, fontWeight: '700', color: c.mute, backgroundColor: c.bgSoft, paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radius.pill, overflow: 'hidden' },
    mockNote: { fontSize: ty.small, color: c.ink2, lineHeight: 18 },
    mockCtaBtn: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
    mockCtaBtnTxt: { color: '#ffffff', fontSize: ty.h2, fontWeight: '800' },
    mockCtaDisabled: { backgroundColor: c.bgSoft, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
    mockCtaDisabledTxt: { color: c.faint, fontSize: ty.body, fontWeight: '700' },
```

（`radius`/`spacing`/`ty` は StudyScreen が既に import 済み。`c.amber`/`c.red`/`c.green`/`c.ink2`/`c.bgSoft` 等の色トークンが存在することを確認＝TestScreen で使用済みなので存在する。）

- [ ] **Step 4: TestScreen を削除**

```bash
cd app && git rm src/screens/TestScreen.tsx
```

- [ ] **Step 5: i18n の test.mini_* を削除**

`app/src/i18n/ja.json` と `app/src/i18n/en.json` の `test` セクションから `mini_title`・`mini_time`・`mini_note` の3キーを削除（`full_*`/`jft_*`/`band_*`/`history_*`/`locked_*`/`start_btn` は残す）。両ファイルで削除すること。

- [ ] **Step 6: dict.tab を i18n に追加**

`ja.json`/`en.json` に辞書タブのラベルを追加（`cards.tab` の近く or `nav`/`study` の並びに合わせる）:
- ja: `"dict": { "tab": "辞書" }`（既存に `dict` があれば `tab` を追記。無ければ新設）
- en: `"dict": { "tab": "Dictionary" }`

実装時に既存 `dict` キーの有無を確認し、重複しないよう追記/統合する。

- [ ] **Step 7: tsc＋全テスト**

Run: `cd app && npx tsc --noEmit && npm test 2>&1 | tail -4`
Expected: tsc clean、全テスト PASS。（TestScreen 削除で参照切れが無いこと＝Task4 Step7 の grep で担保。）

- [ ] **Step 8: Commit**

```bash
cd app && git add src/screens/StudyScreen.tsx src/i18n/ja.json src/i18n/en.json
git commit -m "feat(revamp): 学習タブ最下部にフル模試＋信頼幅＋履歴を移設・TestScreen削除・辞書タブ文言"
```

---

## Self-Review

**1. Spec coverage:**
- タブ再編（テスト→辞書・単語スタック） → Task 4 ✅
- ミニ模試削除（入口断ち・i18n削除・TestScreen削除） → Task 5 ✅
- フル模試＋信頼幅＋履歴を学習タブ最下部 → Task 5 ✅
- 月1ロック純関数化 → Task 1（fullMockLocked）✅
- 単語タブ自レベルリスト（コアのみ・chrome非表示） → Task 3（Browse study）＋Task 4（stack）✅
- 辞書タブ＝全レベル参照（×非表示） → Task 3（dict時×＝route.params無しで非表示）＋Task 4 ✅
- KanjiDetail 自レベルスコープ → Task 2 ✅
- levelListFor / fullMockLocked テスト → Task 1 ✅
- 語彙詳細は作らない（YAGNI） → 計画に無し（意図的）✅

**2. Placeholder scan:** 「実装時に確認」は grep 等の**具体手順**を併記済み（StudyItem 型経路・i18n dict 既存有無・nav 型）。TBD/未記載コードなし。✅

**3. Type consistency:** `Kubun`（kanji/vocab/grammar）は levelList.ts と types.ts で一致。`fullMockLocked` の戻り `{ locked, next:{y,m,d} }` は Task1定義→Task5使用で一致。`KanjiDetail{char,scope}` は Task2定義→Task3使用で一致。`WordList{view,mode}` は types(Task4)→App/Cards(Task4)で一致。✅

**留意（実装者向け）:**
- ナビゲーションの TS 型が最大の難所。単語スタック内画面（Cards/Browse-study）から RootStack モーダル（Kakitori/KanjiDetail/Mock）へ navigate するため、`useNavigation<NativeStackNavigationProp<WordsStackParamList & RootStackParamList>>()` で両ナビゲータの route 名を型許容するのが安全。
- material-top-tabs のタブ内に native-stack をネストする構成。Android バックキーで単語スタックが1階層戻ること・タブ切替で状態保持されることを実機確認。
- `state.mockHistory` の各要素は `{ day, pct, full }`（MockScreen `recordMockResult` が書く形）。`fullMockLocked` の `MockHistoryEntry` と一致。
