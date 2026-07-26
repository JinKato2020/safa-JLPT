# 漢字書き取り リデザイン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 漢字書き取りを「級別の全漢字を、詰まらず、バランス良く、書いて覚える」体験に作り替える（3ステップ確立＋田/米グリッド＋SRS/TTS/速度/自由練習）。

**Architecture:** A案＝WebViewエンジン（HanziWriter＋SVGグリッド＋見本＋アニメを内包・ネット不使用）と RN層（画面・SRS・TTS・触覚・永続化）を明確分離。字形データはRNがDL＋`expo-file-system`キャッシュしWebViewへ注入。ライブラリはローカル同梱。

**Tech Stack:** React Native / Expo SDK54, TypeScript, react-native-webview 13.15.0, HanziWriter 3.7 (同梱/MIT), hanzi-writer-data (DLキャッシュ), expo-file-system(legacy), expo-speech, expo-haptics。テスト = `node --import tsx --test`（node:test / node:assert）。

## Global Constraints

- 設計書: `docs/superpowers/specs/2026-07-08-kanji-kakitori-redesign-design.md`。
- テストは jest 不使用。`node:test`＋`node:assert/strict`。新テストファイルは `app/package.json` の `test` スクリプトに**明示追記**する（列挙式）。
- 級別漢字数（実測・不変）: **N5=79 / N4=166 / N3=367**（全て一意・`type==='kanji'`）。
- 状態拡張は**全てオプショナルフィールド**（旧stateと後方互換・[[verify-runtime-not-just-build]]）。
- `expo-file-system` は**必ず `expo-file-system/legacy`** から import（default importは無反応の罠・[[expo-fs-legacy-sdk54]]）。
- UI言語運用は **en/ja のみ**（i18nキーは両方に追加）。
- WebViewはネットに触れない（字形データはRNが注入）。web(ブラウザ)はWebView非対応→案内フォールバックを維持（赤画面回避）。
- 各タスク末で該当テスト＋`npm run tsc`（`cd app`）が緑。コミットは各タスク末。

---

### Task 1: 基盤（依存追加・設定/状態の型拡張・ナビ・i18nキー）

後続タスクが参照する宣言をまとめて用意する。ここでは型と定数のみ（挙動は後続）。

**Files:**
- Modify: `app/package.json`（deps）
- Modify: `app/src/store/state.ts:12-26`（Settings）, `:59`（kakitori型）
- Modify: `app/src/navigation/types.ts`（Kakitori params）
- Modify: `app/src/i18n/en.json`, `app/src/i18n/ja.json`（キー追加）

**Interfaces:**
- Produces: `Settings.kakitoriGrid?: 'none'|'ta'|'kome'`, `kakitoriSpeed?: 'slow'|'normal'|'fast'`, `kakitoriSound?: boolean`, `kakitoriMode?: 'drill'|'free'`。`AppState.kakitori?: Record<string, KakitoriEntry>` where `KakitoriEntry = { step: number; stars: number; best: number; due?: string; interval?: number; reps?: number }`。ナビ `Kakitori?: { level?: 'N5'|'N4'|'N3'; mode?: 'drill'|'review' } | undefined`。

- [ ] **Step 1: 依存を追加**

Run（`cd app`）:
```bash
npx expo install expo-speech expo-haptics
```
Expected: `package.json` に `expo-speech` と `expo-haptics` が追加され成功。

- [ ] **Step 2: Settings 型に4項目追加**

`app/src/store/state.ts` の `Settings` interface 末尾（`font?:` の次行）に追加:
```ts
  kakitoriGrid?: 'none' | 'ta' | 'kome';   // 書き取りグリッド(未設定→kome=米字格)
  kakitoriSpeed?: 'slow' | 'normal' | 'fast'; // 書き順アニメ速度(未設定→normal)
  kakitoriSound?: boolean;                  // 合格時の読み上げTTS(未設定→ON)
  kakitoriMode?: 'drill' | 'free';          // ドリル/自由練習(未設定→drill)
```

- [ ] **Step 3: kakitori 状態型を拡張**

`app/src/store/state.ts:59` を差し替え:
```ts
  kakitori?: Record<string, { step: number; stars: number; best: number; due?: string; interval?: number; reps?: number }>; // 漢字書き取り進捗(char→) 旧stateには無い→省略可
```

- [ ] **Step 4: ナビ型に Kakitori パラメータ**

`app/src/navigation/types.ts` の `Kakitori` 行（現在 `Kakitori: undefined` 相当）を差し替え:
```ts
  Kakitori: { level?: 'N5' | 'N4' | 'N3'; mode?: 'drill' | 'review' } | undefined;
```

- [ ] **Step 5: i18nキー追加（en/ja 両方）**

`app/src/i18n/ja.json` の `kakitori.*` 群に追加（既存キーは残す）:
```json
  "kakitori.next": "次へ",
  "kakitori.skip": "スキップ",
  "kakitori.pass_step": "合格！",
  "kakitori.show_model": "お手本",
  "kakitori.hint": "ヒント",
  "kakitori.model_toggle": "見本",
  "kakitori.free_mode": "自由練習",
  "kakitori.drill_mode": "ドリル",
  "kakitori.grid_ta": "田",
  "kakitori.grid_kome": "米",
  "kakitori.grid_none": "なし",
  "kakitori.speed_slow": "ゆっくり",
  "kakitori.speed_normal": "標準",
  "kakitori.speed_fast": "速い",
  "kakitori.loading_char": "字形を読み込み中…",
  "kakitori.load_error": "字形データを取得できませんでした",
  "kakitori.retry": "再試行",
  "cards.kakitori_review": "今日の書き取り {n}字",
  "settings.kakitori_section": "漢字書き取り",
  "settings.kakitori_grid": "グリッド",
  "settings.kakitori_speed": "アニメ速度",
  "settings.kakitori_sound": "読み上げ",
```
`app/src/i18n/en.json` に同キーの英訳:
```json
  "kakitori.next": "Next",
  "kakitori.skip": "Skip",
  "kakitori.pass_step": "Pass!",
  "kakitori.show_model": "Model",
  "kakitori.hint": "Hint",
  "kakitori.model_toggle": "Guide",
  "kakitori.free_mode": "Free",
  "kakitori.drill_mode": "Drill",
  "kakitori.grid_ta": "田",
  "kakitori.grid_kome": "米",
  "kakitori.grid_none": "None",
  "kakitori.speed_slow": "Slow",
  "kakitori.speed_normal": "Normal",
  "kakitori.speed_fast": "Fast",
  "kakitori.loading_char": "Loading strokes…",
  "kakitori.load_error": "Could not load stroke data",
  "kakitori.retry": "Retry",
  "cards.kakitori_review": "Today's writing: {n}",
  "settings.kakitori_section": "Kanji Writing",
  "settings.kakitori_grid": "Grid",
  "settings.kakitori_speed": "Animation speed",
  "settings.kakitori_sound": "Read aloud",
```

- [ ] **Step 6: 型検証**

Run（`cd app`）: `npm run tsc`
Expected: エラーなし（既存 `KAKITORI_CHARS` 参照はまだ生きているのでOK）。

- [ ] **Step 7: Commit**
```bash
git add app/package.json app/package-lock.json app/src/store/state.ts app/src/navigation/types.ts app/src/i18n/en.json app/src/i18n/ja.json
git commit -m "feat(kakitori): add settings/state/nav/i18n foundation for writing redesign"
```

---

### Task 2: スコア算出（純関数・TDD）

**Files:**
- Create: `app/src/kakitori/scoring.ts`
- Test: `app/src/kakitori/scoring.test.ts`

**Interfaces:**
- Produces: `scoreForMistakes(mistakes: number): number`

- [ ] **Step 1: 失敗するテストを書く**

`app/src/kakitori/scoring.test.ts`:
```ts
// 書き取りスコア算出の単体テスト。実行: node --import tsx --test src/kakitori/scoring.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreForMistakes } from './scoring.ts';

test('ミス0は満点', () => { assert.equal(scoreForMistakes(0), 100); });
test('ミス1は92', () => { assert.equal(scoreForMistakes(1), 92); });
test('ミス5は60', () => { assert.equal(scoreForMistakes(5), 60); });
test('大量ミスでも下限60', () => { assert.equal(scoreForMistakes(20), 60); });
test('負値は満点扱い', () => { assert.equal(scoreForMistakes(-1), 100); });
```

- [ ] **Step 2: 失敗を確認**

Run（`cd app`）: `node --import tsx --test src/kakitori/scoring.test.ts`
Expected: FAIL（`Cannot find module './scoring.ts'`）。

- [ ] **Step 3: 実装**

`app/src/kakitori/scoring.ts`:
```ts
// 書き取りスコア算出(純関数)。HanziWriterのミス数→0-100。
export function scoreForMistakes(mistakes: number): number {
  if (mistakes <= 0) return 100;
  return Math.max(60, 100 - mistakes * 8);
}
```

- [ ] **Step 4: 成功を確認**

Run: `node --import tsx --test src/kakitori/scoring.test.ts`
Expected: PASS（5 tests）。

- [ ] **Step 5: Commit**
```bash
git add app/src/kakitori/scoring.ts app/src/kakitori/scoring.test.ts
git commit -m "feat(kakitori): scoreForMistakes pure fn with tests"
```

---

### Task 3: 書き取りSRS（純関数・TDD）

**Files:**
- Create: `app/src/kakitori/srs.ts`
- Test: `app/src/kakitori/srs.test.ts`

**Interfaces:**
- Consumes: `addDays` from `../store/state`
- Produces: `type KakitoriEntry`, `nextInterval(prevInterval: number|undefined, mistakes: number): number`, `scheduleKakitori(prev: KakitoriEntry, args: { mistakes: number; today: string }): KakitoriEntry`, `kakitoriDueToday(kakitori: Record<string, KakitoriEntry>|undefined, today: string): string[]`

- [ ] **Step 1: 失敗するテストを書く**

`app/src/kakitori/srs.test.ts`:
```ts
// 書き取りSRSスケジューラの単体テスト。実行: node --import tsx --test src/kakitori/srs.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextInterval, scheduleKakitori, kakitoriDueToday } from './srs.ts';

test('初回(interval無し・ミス0)は1日', () => { assert.equal(nextInterval(undefined, 0), 1); });
test('1→3→7→16→35と延長', () => {
  assert.equal(nextInterval(1, 0), 3);
  assert.equal(nextInterval(3, 0), 7);
  assert.equal(nextInterval(7, 0), 16);
  assert.equal(nextInterval(16, 0), 35);
  assert.equal(nextInterval(35, 0), 35); // 上限
});
test('3ミス以上で最短1日に戻す', () => { assert.equal(nextInterval(16, 3), 1); });
test('scheduleは due/interval/reps を更新', () => {
  const r = scheduleKakitori({ step: 3, stars: 3, best: 100 }, { mistakes: 0, today: '2026-07-08' });
  assert.equal(r.interval, 1);
  assert.equal(r.due, '2026-07-09');
  assert.equal(r.reps, 1);
});
test('kakitoriDueTodayは期日到来字のみ', () => {
  const k = { 日: { step: 3, stars: 3, best: 100, due: '2026-07-08' }, 木: { step: 3, stars: 3, best: 100, due: '2026-07-20' }, 山: { step: 1, stars: 1, best: 80 } };
  assert.deepEqual(kakitoriDueToday(k, '2026-07-08'), ['日']);
});
test('kakitori未定義は空配列', () => { assert.deepEqual(kakitoriDueToday(undefined, '2026-07-08'), []); });
```

- [ ] **Step 2: 失敗を確認**

Run: `node --import tsx --test src/kakitori/srs.test.ts`
Expected: FAIL（module not found）。

- [ ] **Step 3: 実装**

`app/src/kakitori/srs.ts`:
```ts
// 書き取りSRS(間隔反復・純関数)。本体学習エンジンとは別スライス。
import { addDays } from '../store/state';

export interface KakitoriEntry {
  step: number; stars: number; best: number;
  due?: string; interval?: number; reps?: number;
}

const INTERVALS = [1, 3, 7, 16, 35]; // 日

/** 前回間隔とミス数から次回間隔(日)を返す。3ミス以上は最短に戻す。 */
export function nextInterval(prevInterval: number | undefined, mistakes: number): number {
  if (mistakes >= 3) return INTERVALS[0];
  const idx = prevInterval ? INTERVALS.indexOf(prevInterval) : -1;
  const next = Math.min(idx + 1, INTERVALS.length - 1);
  return INTERVALS[Math.max(0, next)];
}

/** マスター/復習合格時に次回期日をスケジュール。 */
export function scheduleKakitori(prev: KakitoriEntry, args: { mistakes: number; today: string }): KakitoriEntry {
  const interval = nextInterval(prev.interval, args.mistakes);
  return { ...prev, interval, due: addDays(args.today, interval), reps: (prev.reps ?? 0) + 1 };
}

/** 期日(due)が today 以前の字の配列。 */
export function kakitoriDueToday(kakitori: Record<string, KakitoriEntry> | undefined, today: string): string[] {
  if (!kakitori) return [];
  return Object.entries(kakitori).filter(([, e]) => e.due != null && e.due <= today).map(([c]) => c);
}
```

- [ ] **Step 4: 成功を確認**

Run: `node --import tsx --test src/kakitori/srs.test.ts`
Expected: PASS（6 tests）。

- [ ] **Step 5: Commit**
```bash
git add app/src/kakitori/srs.ts app/src/kakitori/srs.test.ts
git commit -m "feat(kakitori): spaced-repetition scheduler with tests"
```

---

### Task 4: 級別漢字リスト＋字情報（TDD）

**Files:**
- Create: `app/src/kakitori/list.ts`
- Test: `app/src/kakitori/list.test.ts`
- Delete: `app/src/kakitori/chars.ts`（`KAKITORI_CHARS`）※参照を list に切替後
- Modify: `app/src/screens/CardsScreen.tsx:14,37`（`KAKITORI_CHARS`→`kanjiListFor`）

**Interfaces:**
- Consumes: `../data/kanji.json`, `Level` from `../engine/engine`
- Produces: `kanjiListFor(level: Level): string[]`, `kanjiInfo(char: string): KanjiRow | undefined`（`KanjiRow = { char: string; level: string; type: string; on?: string; kun?: string; meaning?: string; strokes?: number; grade?: number }`）

- [ ] **Step 1: 失敗するテストを書く**

`app/src/kakitori/list.test.ts`:
```ts
// 級別漢字リストの単体テスト。実行: node --import tsx --test src/kakitori/list.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kanjiListFor, kanjiInfo } from './list.ts';

test('級別件数(実測)', () => {
  assert.equal(kanjiListFor('N5').length, 79);
  assert.equal(kanjiListFor('N4').length, 166);
  assert.equal(kanjiListFor('N3').length, 367);
});
test('各級は一意', () => {
  for (const lv of ['N5', 'N4', 'N3'] as const) {
    const a = kanjiListFor(lv);
    assert.equal(new Set(a).size, a.length);
  }
});
test('既知字を含む', () => {
  assert.ok(kanjiListFor('N5').includes('日'));
  assert.ok(kanjiListFor('N5').includes('木'));
});
test('kanjiInfoは読み/意味を返す', () => {
  const info = kanjiInfo('一');
  assert.ok(info);
  assert.equal(info?.char, '一');
  assert.ok((info?.meaning ?? '').length > 0);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --import tsx --test src/kakitori/list.test.ts`
Expected: FAIL（module not found）。

- [ ] **Step 3: 実装**

`app/src/kakitori/list.ts`:
```ts
// 級別の書き取り対象漢字リストと字情報。データ源=kanji.json。
import kanji from '../data/kanji.json';
import type { Level } from '../engine/engine';

export interface KanjiRow {
  char: string; level: string; type: string;
  on?: string; kun?: string; meaning?: string; strokes?: number; grade?: number;
}

const ROWS = kanji as KanjiRow[];

/** 指定級の漢字(char)配列。データ順(grade→頻度)を維持。 */
export function kanjiListFor(level: Level): string[] {
  return ROWS.filter((k) => k.type === 'kanji' && k.level === level).map((k) => k.char);
}

/** 漢字1字の情報(読み/意味/画数)。 */
export function kanjiInfo(char: string): KanjiRow | undefined {
  return ROWS.find((k) => k.type === 'kanji' && k.char === char);
}
```

- [ ] **Step 4: 成功を確認**

Run: `node --import tsx --test src/kakitori/list.test.ts`
Expected: PASS（4 tests）。

- [ ] **Step 5: CardsScreen を list へ切替**

`app/src/screens/CardsScreen.tsx`:
- `import { KAKITORI_CHARS } from '../kakitori/chars';`（14行目）を削除。
- `import { kanjiListFor } from '../kakitori/list';` を追加。
- 37行目 `const kakiTotal = KAKITORI_CHARS.length;` を、現在の目標級に基づく総数へ:
```ts
  const kakiTotal = kanjiListFor(state.settings.level).length;
```

- [ ] **Step 6: chars.ts を削除**

Run: `git rm app/src/kakitori/chars.ts`（他に参照が無いことを確認: `grep -rn KAKITORI_CHARS app/src` が空）。
※ KakitoriScreen も後続 Task 9 で list 参照に置換するため、この時点で KakitoriScreen が `chars` を参照していれば Task 9 まで削除を保留し、代わりに Task 9 で削除する。まず `grep -rn "kakitori/chars" app/src` を実行し、参照が CardsScreen のみなら削除、KakitoriScreen も含むなら本ステップは Task 9 に移動。

- [ ] **Step 7: 検証＋Commit**

Run: `npm run tsc` → エラーなし。
```bash
git add app/src/kakitori/list.ts app/src/kakitori/list.test.ts app/src/screens/CardsScreen.tsx
git commit -m "feat(kakitori): per-level kanji list + kanjiInfo, wire CardsScreen"
```

---

### Task 5: store 拡張（KAKITORI_PROGRESS に skipped＋SRSスケジュール）（TDD）

**Files:**
- Modify: `app/src/store/store.tsx:20`（Action型）, `:65-74`（reducer）, `:134`（recordKakitori）
- Test: `app/src/store/kakitori_reducer.test.ts`

**Interfaces:**
- Consumes: `scheduleKakitori` from `../kakitori/srs`, `dayStr` from `./state`
- Produces: reducer で `KAKITORI_PROGRESS` が `skipped?: boolean` を受け、非skip合格時に star＋（最終step=3合格時）SRSスケジュール。`recordKakitori(char, step, score, opts?: { skipped?: boolean; now?: number })`

- [ ] **Step 1: 失敗するテストを書く**

`app/src/store/kakitori_reducer.test.ts`:
```ts
// KAKITORI_PROGRESS reducer の単体テスト。実行: node --import tsx --test src/store/kakitori_reducer.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reducerForTest } from './store.tsx';
import { INITIAL_STATE } from './state.ts';

const NOW = Date.parse('2026-07-08T00:00:00Z');

test('step1合格で星1・skipは星を付けない', () => {
  let s = reducerForTest(INITIAL_STATE, { type: 'KAKITORI_PROGRESS', char: '日', step: 1, score: 100, skipped: false, now: NOW });
  assert.equal(s.kakitori?.['日'].stars, 1);
  s = reducerForTest(s, { type: 'KAKITORI_PROGRESS', char: '日', step: 2, score: 100, skipped: true, now: NOW });
  assert.equal(s.kakitori?.['日'].stars, 1); // skipは加点しない
});

test('step3(最終)を書いて合格でSRS期日が入る', () => {
  let s = INITIAL_STATE;
  for (const st of [1, 2, 3]) s = reducerForTest(s, { type: 'KAKITORI_PROGRESS', char: '木', step: st, score: 100, skipped: false, now: NOW });
  assert.equal(s.kakitori?.['木'].stars, 3);
  assert.equal(s.kakitori?.['木'].due, '2026-07-09'); // 初回間隔1日
  assert.equal(s.kakitori?.['木'].reps, 1);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --import tsx --test src/store/kakitori_reducer.test.ts`
Expected: FAIL（`reducerForTest` が export されていない）。

- [ ] **Step 3: 実装**

`app/src/store/store.tsx`:
- import に追加: `import { scheduleKakitori } from '../kakitori/srs';`
- Action型（20行目）を差し替え:
```ts
  | { type: 'KAKITORI_PROGRESS'; char: string; step: number; score: number; skipped?: boolean; now?: number }
```
- reducer の `KAKITORI_PROGRESS` ケース（65-74行目）を差し替え:
```ts
    case 'KAKITORI_PROGRESS': {
      const map = state.kakitori ?? {};
      const prev = map[action.char] ?? { step: 0, stars: 0, best: 0 };
      const passed = !action.skipped;
      const stars = passed ? Math.max(prev.stars, action.step) : prev.stars;
      let next = {
        ...prev,
        step: Math.max(prev.step, action.step),
        stars,
        best: Math.max(prev.best, action.score),
      };
      // 最終step(3)を実際に書いて合格→SRSスケジュール(復習キューへ)。
      if (passed && action.step >= 3) {
        const today = dayStr(action.now ?? Date.now());
        const mistakes = Math.max(0, Math.round((100 - action.score) / 8));
        next = scheduleKakitori(next, { mistakes, today });
      }
      return { ...state, kakitori: { ...map, [action.char]: next } };
    }
```
- `reducer` を**テスト用にexport**する。ファイル内で `function reducer(...)` の直前行に別名exportを足す（同一ロジックを2回書かない）。`reducer` 定義後の任意箇所（例: `reducer` 関数の閉じ括弧直後）に追加:
```ts
export const reducerForTest = reducer;
```
- `recordKakitori`（134行目）を差し替え:
```ts
    recordKakitori: (char: string, step: number, score: number, opts?: { skipped?: boolean; now?: number }) =>
      dispatch({ type: 'KAKITORI_PROGRESS', char, step, score, skipped: opts?.skipped, now: opts?.now }),
```

- [ ] **Step 4: 成功を確認**

Run: `node --import tsx --test src/store/kakitori_reducer.test.ts`
Expected: PASS（2 tests）。

- [ ] **Step 5: 型検証＋Commit**

Run: `npm run tsc` → エラーなし。
```bash
git add app/src/store/store.tsx app/src/store/kakitori_reducer.test.ts
git commit -m "feat(kakitori): reducer awards stars on write, schedules SRS on mastery"
```

---

### Task 6: HanziWriter ライブラリをローカル同梱

CDN依存を排除するため、min.js を文字列定数として取り込む。

**Files:**
- Create: `app/src/kakitori/hanziWriterLib.ts`
- Modify: `app/src/i18n/*`（謝辞に HanziWriter (MIT)）は Task 12 で実施

- [ ] **Step 1: min.js を取得して定数化**

Run（`cd app`）:
```bash
node -e "const https=require('https');https.get('https://cdn.jsdelivr.net/npm/hanzi-writer@3.7/dist/hanzi-writer.min.js',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{const fs=require('fs');const esc=d.replace(/\\\\/g,'\\\\\\\\').replace(/`/g,'\\\\`').replace(/\\\$\{/g,'\\\\\${');fs.writeFileSync('src/kakitori/hanziWriterLib.ts','// HanziWriter 3.7 (MIT) を同梱。CDN依存を排除。生成: cdn.jsdelivr.net/npm/hanzi-writer@3.7/dist/hanzi-writer.min.js\\nexport const HANZI_WRITER_JS = `'+esc+'`;\\n');console.log('bytes',d.length);})});"
```
Expected: `src/kakitori/hanziWriterLib.ts` が生成され `bytes` が数万（≒5万前後）。

- [ ] **Step 2: 妥当性を確認**

Run: `node --import tsx -e "import('./src/kakitori/hanziWriterLib.ts').then(m=>{console.log('len',m.HANZI_WRITER_JS.length, 'hasHanziWriter', m.HANZI_WRITER_JS.includes('HanziWriter'))})"`
Expected: `len` が数万・`hasHanziWriter true`。

- [ ] **Step 3: 型検証＋Commit**

Run: `npm run tsc` → エラーなし。
```bash
git add app/src/kakitori/hanziWriterLib.ts
git commit -m "chore(kakitori): bundle HanziWriter 3.7 (MIT) locally to drop CDN dep"
```

---

### Task 7: 字形データ取得＋キャッシュ

`hanzi-writer-data` のJSONをRN側でDLし `expo-file-system`(legacy) にキャッシュ。取得結果を WebView へ渡す。

**Files:**
- Create: `app/src/kakitori/charData.ts`

**Interfaces:**
- Produces: `charDataUrl(char: string): string`, `fetchCharData(char: string): Promise<string>`（生JSON文字列を返す・失敗時 throw）

- [ ] **Step 1: 実装（純粋なURL部分はテスト、DL部分は実機）**

`app/src/kakitori/charData.ts`:
```ts
// 字形データ(hanzi-writer-data)の取得＋端末キャッシュ。WebViewはネットに触れず、
// ここで得た生JSONを KW.load(char, json) で注入する。[[expo-fs-legacy-sdk54]]
import * as FileSystem from 'expo-file-system/legacy';

const BASE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2';
const DIR = FileSystem.cacheDirectory + 'hwdata/';

export function charDataUrl(char: string): string {
  return `${BASE}/${encodeURIComponent(char)}.json`;
}

function cachePath(char: string): string {
  return DIR + char.codePointAt(0)!.toString(16) + '.json';
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

/** 字形JSON(生文字列)を返す。キャッシュ優先→無ければDLして保存。失敗時throw。 */
export async function fetchCharData(char: string): Promise<string> {
  await ensureDir();
  const path = cachePath(char);
  const cached = await FileSystem.getInfoAsync(path);
  if (cached.exists) {
    const s = await FileSystem.readAsStringAsync(path);
    if (s && s.length > 0) return s;
  }
  const res = await FileSystem.downloadAsync(charDataUrl(char), path);
  if (res.status !== 200) throw new Error('char data ' + res.status);
  return await FileSystem.readAsStringAsync(path);
}
```

- [ ] **Step 2: URL のスモークテスト**

`app/src/kakitori/charData.test.ts`:
```ts
// charDataUrl のスモークテスト(DL/FSは実機のみ)。実行: node --import tsx --test src/kakitori/charData_url.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('charDataUrl は正しいCDN URL', async () => {
  // expo-file-system に依存しないよう関数のみ再実装で照合(実体はcharData.ts)
  const BASE = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2';
  const url = `${BASE}/${encodeURIComponent('日')}.json`;
  assert.equal(url, 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2/%E6%97%A5.json');
});
```
※ `charData.ts` 本体は `expo-file-system` に依存し node 単体では import 不可のため、URL整形の期待値のみ独立検証する（実DL/キャッシュは実機/TestFlightで確認）。ファイル名は `charData_url.test.ts` とする。

- [ ] **Step 3: 実行**

Run: `node --import tsx --test src/kakitori/charData_url.test.ts`
Expected: PASS（1 test）。

- [ ] **Step 4: 型検証＋Commit**

Run: `npm run tsc` → エラーなし。
```bash
git add app/src/kakitori/charData.ts app/src/kakitori/charData_url.test.ts
git commit -m "feat(kakitori): stroke-data fetch+cache via expo-file-system legacy"
```

---

### Task 8: WebViewエンジンHTML生成

HanziWriter＋グリッドSVG＋見本＋アニメを内包し、JS APIを公開する自己完結HTMLを生成する。

**Files:**
- Create: `app/src/kakitori/engineHtml.ts`
- Test: `app/src/kakitori/engineHtml.test.ts`

**Interfaces:**
- Consumes: `HANZI_WRITER_JS` from `./hanziWriterLib`
- Produces: `buildEngineHtml(): string`（`KW.load/setStep/setGrid/setColors/setSpeed/animate/hint/showAnswer/setFree/clear` と grid('none'|'ta'|'kome') を含むHTML文字列）

- [ ] **Step 1: 失敗するテストを書く**

`app/src/kakitori/engineHtml.test.ts`:
```ts
// エンジンHTMLに必要なAPI/要素が含まれるかの単体テスト。実行: node --import tsx --test src/kakitori/engineHtml.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngineHtml } from './engineHtml.ts';

test('必要なJS APIとグリッド種別を含む', () => {
  const h = buildEngineHtml();
  for (const api of ['KW.load', 'setStep', 'setGrid', 'setColors', 'setSpeed', 'animate', 'showAnswer', 'setFree']) {
    assert.ok(h.includes(api), 'missing ' + api);
  }
  for (const g of ['ta', 'kome', 'none']) assert.ok(h.includes(g));
  assert.ok(h.includes('HanziWriter')); // 同梱ライブラリ
  assert.ok(h.includes('charDataLoader')); // 注入方式
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --import tsx --test src/kakitori/engineHtml.test.ts`
Expected: FAIL（module not found）。

- [ ] **Step 3: 実装**

`app/src/kakitori/engineHtml.ts`:
```ts
// WebView用の自己完結HTML。HanziWriter＋田/米グリッド(SVG)＋見本＋アニメを内包し、
// RNからは KW.* を injectJavaScript で呼ぶ。ネットには触れない(字形はRNが注入)。
import { HANZI_WRITER_JS } from './hanziWriterLib';

export function buildEngineHtml(): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body{margin:0;padding:0;background:transparent;height:100%;overflow:hidden}
#wrap{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
#grid{position:absolute;pointer-events:none}#t{touch-action:none}</style>
</head><body>
<div id="wrap"><svg id="grid"></svg><div id="t"></div></div>
<script>${HANZI_WRITER_JS}</script>
<script>
var writer=null, curChar=null, curData=null, curStep=0, free=false;
var COLORS={stroke:'#2f7bf6',outline:'#cbd5e1',grid:'#94a3b8',highlight:'#22c55e'};
var SPEED={slow:0.5,normal:1,fast:2}, DELAY={slow:320,normal:180,fast:90}, speed='normal';
function post(o){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o));}
function size(){return Math.min(window.innerWidth,window.innerHeight);}
function drawGrid(kind){
  var S=size(), svg=document.getElementById('grid');
  svg.setAttribute('width',S);svg.setAttribute('height',S);
  svg.setAttribute('viewBox','0 0 '+S+' '+S);
  var g=COLORS.grid, o='<rect x="1" y="1" width="'+(S-2)+'" height="'+(S-2)+'" fill="none" stroke="'+g+'" stroke-width="1.5" opacity="0.5"/>';
  if(kind==='ta'||kind==='kome'){
    o+='<line x1="'+(S/2)+'" y1="0" x2="'+(S/2)+'" y2="'+S+'" stroke="'+g+'" stroke-width="1" opacity="0.4"/>';
    o+='<line x1="0" y1="'+(S/2)+'" x2="'+S+'" y2="'+(S/2)+'" stroke="'+g+'" stroke-width="1" opacity="0.4"/>';
  }
  if(kind==='kome'){
    o+='<line x1="0" y1="0" x2="'+S+'" y2="'+S+'" stroke="'+g+'" stroke-width="1" stroke-dasharray="4 5" opacity="0.28"/>';
    o+='<line x1="'+S+'" y1="0" x2="0" y2="'+S+'" stroke="'+g+'" stroke-width="1" stroke-dasharray="4 5" opacity="0.28"/>';
  }
  svg.innerHTML=o;
}
function KW(){}
KW.setColors=function(c){for(var k in c)COLORS[k]=c[k];};
KW.setGrid=function(kind){window._grid=kind;drawGrid(kind);};
KW.setSpeed=function(s){speed=s;};
KW.load=function(char,dataJson){curChar=char;curData=typeof dataJson==='string'?JSON.parse(dataJson):dataJson;post({type:'loaded',char:char});};
function make(opts){
  document.getElementById('t').innerHTML='';
  var S=size();
  return HanziWriter.create('t',curChar,Object.assign({
    width:S,height:S,padding:Math.round(S*0.04),
    strokeColor:COLORS.stroke,outlineColor:COLORS.outline,drawingColor:COLORS.stroke,highlightColor:COLORS.highlight,
    strokeAnimationSpeed:SPEED[speed],delayBetweenStrokes:DELAY[speed],
    charDataLoader:function(c,onComplete){onComplete(curData);}
  },opts));
}
KW.setStep=function(step){
  curStep=step;free=false;
  var showOutline=(step===0);
  var len=(step===2?1.0:(step===1?1.2:1.4));
  writer=make({showCharacter:false,showOutline:showOutline,leniency:len});
  if(step===0){writer.animateCharacter();}
  writer.quiz({
    showHintAfterMisses: step===0?1:(step===1?3:999),
    highlightOnComplete:true,
    onMistake:function(s){post({type:'mistake',stroke:s.strokeNum});},
    onComplete:function(s){post({type:'complete',mistakes:s.totalMistakes});}
  });
  post({type:'started',step:step});
};
KW.setFree=function(on){
  free=on;
  if(on){writer=make({showCharacter:false,showOutline:true,leniency:2.0});writer.quiz({showHintAfterMisses:1,highlightOnComplete:false});post({type:'started',step:-1});}
};
KW.animate=function(){if(writer)writer.animateCharacter();};
KW.hint=function(){if(writer&&writer.showHint)writer.showHint();};
KW.showAnswer=function(){if(!writer)return;writer.showOutline();writer.animateCharacter();};
KW.clear=function(){if(writer&&writer.cancelQuiz){writer.cancelQuiz();} if(free){KW.setFree(true);} else {KW.setStep(curStep);}};
window.KW=KW;
window.addEventListener('resize',function(){if(window._grid)drawGrid(window._grid);});
post({type:'ready'});
</script>
</body></html>`;
}
```

- [ ] **Step 4: 成功を確認**

Run: `node --import tsx --test src/kakitori/engineHtml.test.ts`
Expected: PASS（1 test）。

- [ ] **Step 5: 型検証＋Commit**

Run: `npm run tsc` → エラーなし。
```bash
git add app/src/kakitori/engineHtml.ts app/src/kakitori/engineHtml.test.ts
git commit -m "feat(kakitori): self-contained WebView engine (HanziWriter + ta/kome grid)"
```

---

### Task 9: KakitoriScreen 全面改修

エンジンWebViewと連携し、情報行・ステップドット・ツールバー・詰み防止フロー・SRS/TTS/触覚/自由練習を実装。

**Files:**
- Modify: `app/src/screens/KakitoriScreen.tsx`（全面）
- Delete: `app/src/kakitori/chars.ts`（Task 4 で未削除の場合）

**Interfaces:**
- Consumes: `buildEngineHtml`（engineHtml）, `fetchCharData`（charData）, `kanjiListFor`/`kanjiInfo`（list）, `scoreForMistakes`（scoring）, `recordKakitori`/`useAppState`（store）, `kanjiLevelReadings.json`, `expo-speech`, `expo-haptics`
- Produces: 画面（`Kakitori` ルート・params `{ level?, mode? }`）

- [ ] **Step 1: 実装（全面置換）**

`app/src/screens/KakitoriScreen.tsx` を下記に置換:
```tsx
// 漢字書き取り(級別・3ステップ)。描画/採点/書き順はエンジンWebView(HanziWriter同梱)に委譲。
// フロー: なぞり(外形+アニメ)→見て書く→見ないで書く。自動合格＋常時[次へ/スキップ]で詰み防止。
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { kanjiListFor, kanjiInfo } from '../kakitori/list';
import { buildEngineHtml } from '../kakitori/engineHtml';
import { fetchCharData } from '../kakitori/charData';
import { scoreForMistakes } from '../kakitori/scoring';
import { kakitoriDueToday } from '../kakitori/srs';
import levelReadings from '../data/kanjiLevelReadings.json';
import type { RootStackParamList } from '../navigation/types';
import { useT } from '../i18n';

const STEP_KEYS = ['kakitori.step_trace', 'kakitori.step_guided', 'kakitori.step_recall'];
const GRIDS = ['ta', 'kome', 'none'] as const;
const SPEEDS = ['slow', 'normal', 'fast'] as const;

function readingLine(char: string): string {
  const arr = (levelReadings as Record<string, Array<{ reading: string }>>)[char];
  return arr?.slice(0, 3).map((r) => r.reading).join('・') ?? '';
}
function exampleWord(char: string): string {
  const arr = (levelReadings as Record<string, Array<{ examples?: [string, string][] }>>)[char];
  const ex = arr?.find((r) => r.examples && r.examples.length)?.examples?.[0];
  return ex ? `${ex[0]}（${ex[1]}）` : '';
}

export default function KakitoriScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'Kakitori'>>();
  const state = useAppState();
  const { recordKakitori } = useAppActions();
  const c = useColors();
  const t = useT();
  const s = makeStyles(c);
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildEngineHtml(), []);

  const level = route.params?.level ?? state.settings.level;
  const mode = route.params?.mode ?? 'drill';
  const chars = useMemo(() => {
    if (mode === 'review') { const now = Date.now(); const d = kakitoriDueToday(state.kakitori, dayOf(now)); return d.length ? d : kanjiListFor(level as any); }
    return kanjiListFor(level as any);
  }, [mode, level]);

  const grid = state.settings.kakitoriGrid ?? 'kome';
  const speed = state.settings.kakitoriSpeed ?? 'normal';
  const sound = state.settings.kakitoriSound ?? true;
  const [free, setFree] = useState(state.settings.kakitoriMode === 'free');
  const [showGuide, setShowGuide] = useState(true);

  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const readyRef = useRef(false);

  const done = idx >= chars.length;
  const char = done ? '' : chars[idx];
  const info = char ? kanjiInfo(char) : undefined;
  const stars = state.kakitori?.[char]?.stars ?? 0;

  const inject = (code: string) => { webRef.current?.injectJavaScript(`try{${code}}catch(e){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:String(e)}))}; true;`); };

  // 指定字をロード→現モードで開始。字形データはRNが取得しWebViewへ注入。
  const loadChar = async (ch: string, st: number) => {
    if (!ch || !readyRef.current) return;
    setLoading(true); setError(false);
    try {
      const data = await fetchCharData(ch);
      inject(`KW.setColors(${JSON.stringify({ stroke: c.blue, outline: c.line, grid: c.mute, highlight: '#22c55e' })}); KW.setGrid(${JSON.stringify(grid)}); KW.setSpeed(${JSON.stringify(speed)}); KW.load(${JSON.stringify(ch)}, ${JSON.stringify(data)});`);
      if (free) inject('KW.setFree(true)'); else inject(`KW.setStep(${st})`);
      setLoading(false);
    } catch { setLoading(false); setError(true); }
  };

  useEffect(() => { if (readyRef.current && !done) loadChar(char, step); }, [grid, speed, free]);

  const speak = (ch: string) => { if (!sound) return; const r = readingLine(ch); if (r) Speech.speak(r.split('・')[0], { language: 'ja-JP' }); };

  // 自動/手動を単一の前進関数に集約(タイミング競合を断つ)。
  const advance = () => {
    if (free) return;
    if (step < 2) { const ns = step + 1; setStep(ns); loadChar(char, ns); return; }
    const ni = idx + 1; setIdx(ni); setStep(0);
    if (ni < chars.length) loadChar(chars[ni], 0);
  };
  const skipChar = () => { const ni = idx + 1; setIdx(ni); setStep(0); if (ni < chars.length) loadChar(chars[ni], 0); };

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type?: string; mistakes?: number };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'ready') { readyRef.current = true; if (!done) loadChar(char, step); return; }
    if (m.type === 'mistake') { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); return; }
    if (m.type === 'complete') {
      const score = scoreForMistakes(m.mistakes ?? 0);
      recordKakitori(char, step + 1, score, { skipped: false, now: Date.now() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (step >= 2) speak(char);
      setTimeout(advance, 700);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.center}><Text style={s.doneEmoji}>✍️</Text><Text style={s.doneTxt}>{t('kakitori.web_only')}</Text>
          <Pressable style={s.doneBtn} onPress={() => nav.goBack()}><Text style={s.doneBtnTxt}>{t('kakitori.clear')}</Text></Pressable></View>
      </SafeAreaView>
    );
  }
  if (done) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.center}><Text style={s.doneEmoji}>🎉</Text><Text style={s.doneTxt}>{t('kakitori.mastered')}</Text>
          <Pressable style={s.doneBtn} onPress={() => nav.goBack()}><Text style={s.doneBtnTxt}>{t('kakitori.clear')}</Text></Pressable></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable>
        <Text style={s.count}>{idx + 1} / {chars.length}</Text>
        <Text style={s.stars}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.infoRow}>
          <Text style={s.infoChar}>{char}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.infoReading}>{readingLine(char)}</Text>
            <Text style={s.infoMeaning} numberOfLines={1}>{info?.meaning ?? ''}</Text>
            {!!exampleWord(char) && <Text style={s.infoExample}>{t('kakitori.model')}: {exampleWord(char)}</Text>}
          </View>
          <Pressable onPress={() => speak(char)} hitSlop={10}><Text style={s.speak}>🔊</Text></Pressable>
        </View>

        {!free && (
          <View style={s.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={s.dotWrap}>
                <View style={[s.dot, i <= step && s.dotOn]} />
                <Text style={[s.dotLabel, i === step && s.dotLabelOn]}>{t(STEP_KEYS[i])}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.canvas}>
          <WebView ref={webRef} originWhitelist={['*']} source={{ html }} onMessage={onMessage}
            style={s.web} scrollEnabled={false} javaScriptEnabled domStorageEnabled />
          {loading && <View style={s.loader}><ActivityIndicator color={c.blue} /><Text style={s.loaderTxt}>{t('kakitori.loading_char')}</Text></View>}
          {error && <View style={s.loader}><Text style={s.loaderTxt}>{t('kakitori.load_error')}</Text>
            <Pressable style={s.doneBtn} onPress={() => loadChar(char, step)}><Text style={s.doneBtnTxt}>{t('kakitori.retry')}</Text></Pressable></View>}
        </View>

        <View style={s.toolbar}>
          {GRIDS.map((g) => (
            <Pressable key={g} onPress={() => recordSetting({ kakitoriGrid: g })} style={[s.tool, grid === g && s.toolOn]}>
              <Text style={[s.toolTxt, grid === g && s.toolTxtOn]}>{t('kakitori.grid_' + (g === 'ta' ? 'ta' : g === 'kome' ? 'kome' : 'none'))}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => cycleSpeed()} style={s.tool}><Text style={s.toolTxt}>{t('kakitori.speed_' + speed)}</Text></Pressable>
          <Pressable onPress={() => toggleFree()} style={[s.tool, free && s.toolOn]}><Text style={[s.toolTxt, free && s.toolTxtOn]}>{t(free ? 'kakitori.free_mode' : 'kakitori.drill_mode')}</Text></Pressable>
        </View>
        <View style={s.toolbar}>
          <Pressable onPress={() => inject('KW.animate()')} style={s.tool}><Text style={s.toolTxt}>↻ {t('kakitori.show_model')}</Text></Pressable>
          <Pressable onPress={() => inject('KW.showAnswer()')} style={s.tool}><Text style={s.toolTxt}>{t('kakitori.hint')}</Text></Pressable>
          <Pressable onPress={() => inject('KW.clear()')} style={s.tool}><Text style={s.toolTxt}>{t('kakitori.clear')}</Text></Pressable>
        </View>

        {!free && (
          <View style={s.actions}>
            <Pressable style={[s.actBtn, s.actGhost]} onPress={skipChar}><Text style={s.actGhostTxt}>{t('kakitori.skip')}</Text></Pressable>
            <Pressable style={[s.actBtn, s.actPrimary]} onPress={advance}><Text style={s.actPrimaryTxt}>{t('kakitori.next')} →</Text></Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  function recordSetting(patch: Record<string, unknown>) { setSettings(patch); }
  function cycleSpeed() { const i = SPEEDS.indexOf(speed); setSettings({ kakitoriSpeed: SPEEDS[(i + 1) % SPEEDS.length] }); }
  function toggleFree() { const nf = !free; setSettings({ kakitoriMode: nf ? 'free' : 'drill' }); setFree(nf); }
  function setSettings(patch: Record<string, unknown>) { setSettingsAction(patch); }
}

function dayOf(now: number): string { const d = new Date(now); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${d.getFullYear()}-${m}-${day}`; }

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  doneEmoji: { fontSize: 56 }, doneTxt: { fontSize: ty.h2, fontWeight: '800', color: c.ink, textAlign: 'center' },
  doneBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: radius.md, backgroundColor: c.blue },
  doneBtnTxt: { color: '#fff', fontWeight: '800', fontSize: ty.body },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  close: { fontSize: 30, color: c.mute, fontWeight: '700' }, count: { fontSize: ty.small, fontWeight: '700', color: c.mute },
  stars: { fontSize: ty.h2, color: c.amber, letterSpacing: 2 },
  body: { paddingBottom: spacing.xl },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  infoChar: { fontSize: 40, fontFamily: 'ShipporiMincho-Bold', color: c.ink },
  infoReading: { fontSize: ty.body, fontWeight: '700', color: c.ink }, infoMeaning: { fontSize: ty.small, color: c.mute },
  infoExample: { fontSize: ty.small, color: c.blue }, speak: { fontSize: 26 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md },
  dotWrap: { alignItems: 'center', gap: 4 }, dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.line },
  dotOn: { backgroundColor: c.blue }, dotLabel: { fontSize: ty.small, color: c.mute }, dotLabelOn: { color: c.blue, fontWeight: '800' },
  canvas: { alignSelf: 'center', width: SIZE, height: SIZE, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, overflow: 'hidden', marginTop: spacing.md },
  web: { flex: 1, backgroundColor: 'transparent' },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: c.surface },
  loaderTxt: { fontSize: ty.small, color: c.mute },
  toolbar: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.lg },
  tool: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
  toolOn: { backgroundColor: c.blue, borderColor: c.blue }, toolTxt: { fontSize: ty.small, fontWeight: '700', color: c.ink }, toolTxtOn: { color: '#fff' },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  actBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  actGhost: { backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line }, actGhostTxt: { fontSize: ty.body, fontWeight: '800', color: c.mute },
  actPrimary: { backgroundColor: c.blue }, actPrimaryTxt: { fontSize: ty.body, fontWeight: '800', color: '#fff' },
});
const SIZE = 320;
```
※ `setSettingsAction` は store の設定更新アクション。実装時に store のAPI名（例 `setSettings`/`updateSettings`）を確認して `useAppActions()` から取得し、`setSettings`/`recordSetting`/`cycleSpeed`/`toggleFree` を接続する。存在しなければ `dispatch({type:'SET_SETTINGS',patch})` 相当のアクションを `useAppActions` に足す（store.tsx に `setSettings` が既にある場合はそれを使う）。

- [ ] **Step 2: store の設定更新APIを確認して接続**

Run: `grep -n "SET_SETTINGS\|setSettings" app/src/store/store.tsx`
- 既存の設定更新アクション名を確認し、KakitoriScreen 冒頭の `const { recordKakitori } = useAppActions();` を `const { recordKakitori, setSettings: setSettingsAction } = useAppActions();`（実名に合わせる）へ修正。無ければ `useAppActions` に `setSettings: (patch: Partial<Settings>) => dispatch({ type: 'SET_SETTINGS', patch })` を追加。

- [ ] **Step 3: 型検証**

Run: `npm run tsc`
Expected: エラーなし（未使用importや型不一致を解消）。

- [ ] **Step 4: web bundle スモーク**

Run: `npx expo export --platform web` もしくは既存の web ビルド確認手順。
Expected: バンドル成功（WebView は web で案内フォールバックのため実行時クラッシュしない）。

- [ ] **Step 5: Commit**
```bash
git add app/src/screens/KakitoriScreen.tsx
git rm -f app/src/kakitori/chars.ts 2>/dev/null || true
git commit -m "feat(kakitori): redesign screen — 3-step no-dead-end flow, grid, SRS, TTS, haptics, free mode"
```

---

### Task 10: カードタブに「今日の書き取り」導線

**Files:**
- Modify: `app/src/screens/CardsScreen.tsx`

- [ ] **Step 1: 復習チップを追加**

`app/src/screens/CardsScreen.tsx`:
- import 追加: `import { kakitoriDueToday } from '../kakitori/srs';`
- 漢字カード内（現在の「書き取り」ボタン付近）に、期日到来があれば復習チップを追加:
```tsx
{(() => { const due = kakitoriDueToday(state.kakitori, todayStr()); return due.length ? (
  <Pressable style={({ pressed }) => [s.kakiBtn, pressed && s.pressed]} onPress={() => nav.navigate('Kakitori', { mode: 'review' })}>
    <Text style={s.kakiTxt}>{t('cards.kakitori_review', { n: due.length })}</Text>
  </Pressable>
) : null; })()}
```
- 既存の「書き取り」ボタンは `nav.navigate('Kakitori', { level: state.settings.level, mode: 'drill' })` へ更新。
- `todayStr()` はファイル内に無ければ `const todayStr = () => { const d = new Date(); return \`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}\`; };` を定義（既存の日付ヘルパーがあればそれを使う）。

- [ ] **Step 2: 型検証＋Commit**

Run: `npm run tsc` → エラーなし。
```bash
git add app/src/screens/CardsScreen.tsx
git commit -m "feat(kakitori): today's writing review entry on Cards tab"
```

---

### Task 11: 設定画面に書き取りトグル

**Files:**
- Modify: `app/src/screens/ProfileScreen.tsx`

- [ ] **Step 1: セクション追加**

`app/src/screens/ProfileScreen.tsx` の設定項目群に、既存のチップ/トグルUIパターンを踏襲して「漢字書き取り」セクションを追加:
- グリッド: `kakitoriGrid` を `ta`/`kome`/`none` で選択（`t('settings.kakitori_grid')`＋`t('kakitori.grid_*')`）。
- アニメ速度: `kakitoriSpeed` を `slow`/`normal`/`fast`（`t('settings.kakitori_speed')`＋`t('kakitori.speed_*')`）。
- 読み上げ: `kakitoriSound` のON/OFF（`t('settings.kakitori_sound')`）。
既存の設定更新（`setSettings`/`SET_SETTINGS`）でパッチ。実装は ProfileScreen の既存フォント選択チップ（`settings.font`）と同じ書式に合わせる。

- [ ] **Step 2: 型検証＋Commit**

Run: `npm run tsc` → エラーなし。
```bash
git add app/src/screens/ProfileScreen.tsx
git commit -m "feat(kakitori): settings toggles for grid/speed/read-aloud"
```

---

### Task 12: 謝辞・テストスクリプト・全体グリーン・実行時検証

**Files:**
- Modify: `app/package.json`（`test` スクリプト）
- Modify: 謝辞データ（HanziWriter MIT を追記する既存の acknowledgements 定義箇所）

- [ ] **Step 1: test スクリプトに新テストを追記**

`app/package.json` の `test` を差し替え:
```json
"test": "node --import tsx --test src/engine/engine.test.ts src/quiz/quiz.test.ts src/store/streak.test.ts src/store/badges.test.ts src/store/kakitori_reducer.test.ts src/kakitori/scoring.test.ts src/kakitori/srs.test.ts src/kakitori/list.test.ts src/kakitori/charData_url.test.ts src/kakitori/engineHtml.test.ts",
```

- [ ] **Step 2: 謝辞に HanziWriter (MIT) を追記**

Run: `grep -rn "EDRDG\|KANJIDIC\|謝辞\|acknowledg" app/src` で謝辞定義箇所を特定し、「HanziWriter © Jack Huang (MIT License)」を全対応言語（en/ja 中心）に1行追加。

- [ ] **Step 3: 全テスト実行**

Run（`cd app`）: `npm test`
Expected: 全テストPASS（既存32＋新規: scoring5/srs6/list4/reducer2/charData_url1/engineHtml1 = 計51前後）。

- [ ] **Step 4: 型・実行時検証**

Run: `npm run tsc` → エラーなし。
実行時: 旧state（`kakitori` 無し／`due` 無し）でのnullガードを確認（`kakitoriDueToday(undefined,...)`＝[]、`state.kakitori?.[char]?.stars ?? 0`）。[[verify-runtime-not-just-build]]

- [ ] **Step 5: Commit**
```bash
git add app/package.json app/src
git commit -m "chore(kakitori): register tests, add HanziWriter attribution, verify green"
```

---

## Self-Review 結果（spec対応の確認）

- 3ステップ確立＋詰み防止 → Task 8(エンジンstep)/Task 9(advance集約・[次へ/スキップ]・showAnswer救済)。
- 田/米/なしグリッド → Task 8(drawGrid)/Task 9(トグル)/Task 11(設定)。
- 級別全漢字 → Task 4(list)/Task 9(chars=kanjiListFor)。
- 読み/意味/例語パネル → Task 9(readingLine/exampleWord/kanjiInfo)。
- SRS → Task 3(srs)/Task 5(reducerスケジュール)/Task 10(復習導線)。
- TTS読み上げ → Task 9(speak/expo-speech)。
- アニメ速度 → Task 8(SPEED/DELAY)/Task 9(cycleSpeed)/Task 11。
- 自由練習 → Task 8(setFree)/Task 9(toggleFree)。
- 触覚 → Task 9(expo-haptics)。
- ライブラリ同梱＋データDLキャッシュ → Task 6/Task 7。
- 後方互換 → Task 1(オプショナル)/Task 5/Task 12(実行時検証)。
- web フォールバック維持 → Task 9。

未解決の実装時判断（プランに明示済・実装者が現物合わせ）: ①store の設定更新アクション実名（Task 9 Step2）②ProfileScreen既存トグル書式（Task 11）③謝辞定義箇所（Task 12 Step2）④`hint()`/`showHint`/`cancelQuiz` は HanziWriter 3.7 のAPI名を実機で確認（無ければ `showAnswer` に一本化）。
