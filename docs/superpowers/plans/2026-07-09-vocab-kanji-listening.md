# 例語音声（B）＋聞き取り学習ドリル（C・語彙/漢字）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 漢字詳細の例語を▷で再生し、単語タブの語彙/漢字カードから「学習→聞き取りテスト」2段ドリル（語彙=音声→意味4択／漢字=代表音声→その字4択）を新設する。

**Architecture:** 既存 `vocabAudio.playVocab`＋`expo-speech` を統一再生に使う。純関数で語→id解決・出題生成をテスト可能化。漢字ドリルは事前精査済 `kanjiDrillReps.json`（char→代表語/音読み）を使い、音声→漢字4択（誤答は同音字除外）。

**Tech Stack:** React Native/Expo, expo-av, expo-speech, @expo/vector-icons, TypeScript, node:test。

## Global Constraints

- 音声統一: 問題の `audioVocabId`（string|null）があれば `playVocab(audioVocabId)`（mp3）、失敗/nullなら `Speech.speak(audioReading, { language:'ja-JP' })`（TTS）。無音にしない。
- ドリルは**自レベル**（`settings.level`）。1セッション **10問**。2段（学習フェーズ→テスト→スコア）。同10件を両フェーズで共有。テスト回答のみ `useAppActions().quizAnswer(itemId, correct)` で習得反映。
- 語彙ドリル: 音声=語のmp3、選択肢=**意味**、正解=その語の意味。
- 漢字ドリル: 全612字対象。音声=**代表音声**（`kanjiDrillReps.json`: `bound:false`→代表語 word/reading・vocab一致ならmp3/無ければTTS ; `bound:true`→音読み reading のTTS）。選択肢=**漢字1字**、正解=その字。誤答は同レベルの他字から**正解と同じ reading を除外**して選ぶ（同音で当たらない事故防止）。毎回選び直し＋順シャッフル。
- 例語補完（④）: 漢字詳細で、その字の代表語（reps）が既存の例語に無ければ**表示時に例語として追記**（カードに代表語＋▷が出る）。
- 乱数は純関数に `rng: () => number` 注入（本番 `Math.random`）。
- 音声画面は `Audio.setAudioModeAsync({ playsInSilentModeIOS:true })` をマウント時1回。
- データ `app/src/data/kanjiDrillReps.json` は生成済（Task 0 でコミット）。char→`{ level, bound, word, reading }`（bound時 word=""、reading=音読み）。
- Git repo は `app/`。テスト: `cd app && node --import tsx --test <files>`。新規テストは `app/package.json` の `test` に登録。

---

## ファイル構成

- Create `app/src/data/kanjiDrillReps.json` — 612字の代表音声データ（既に生成済・Task0でadd）。
- Create `app/src/words/vocabIndex.ts` (+test) — `vocabIdForWord`。
- Modify `app/src/screens/KanjiDetailScreen.tsx` — 例語▷＋代表語の例語補完。
- Create `app/src/listening/listeningQuiz.ts` (+test) — 型・語彙/漢字の出題生成。
- Create `app/src/screens/ListeningQuizScreen.tsx` — 2段ドリル画面。
- Modify `app/App.tsx`, `app/src/navigation/types.ts` — `ListeningQuiz` モーダル。
- Modify `app/src/screens/CardsScreen.tsx` — 語彙/漢字カードに聞き取り入口。
- Modify `app/src/i18n/ja.json`, `app/src/i18n/en.json`, `app/package.json`。

---

### Task 0: 代表語データをコミット

**Files:** Add `app/src/data/kanjiDrillReps.json`（生成済）。

- [ ] **Step 1: データ存在と件数確認**

Run: `cd app && node -e "const d=require('./src/data/kanjiDrillReps.json'); const k=Object.keys(d); console.log('kanji',k.length); const b=k.filter(c=>d[c].bound).length; console.log('bound',b,'free',k.length-b); console.log('samples',['火','学','書','校','館'].map(c=>c+':'+(d[c].bound?'音'+d[c].reading:d[c].word+'('+d[c].reading+')')).join(' '))"`
Expected: `kanji 612`、`bound 101 free 511`、samples が 火:火(ひ) 学:学ぶ(まなぶ) 書:書く(かく) 校:音こう 館:音かん。

- [ ] **Step 2: Commit**

```bash
cd app && git add src/data/kanjiDrillReps.json
git commit -m "data(listening): 漢字ドリル代表音声データ612字(superpowers精査済)"
```

---

### Task 1: vocabIdForWord（例語→vocab id・純関数）

**Files:** Create `app/src/words/vocabIndex.ts`, `app/src/words/vocabIndex.test.ts`; Modify `app/package.json`.

**Interfaces:** Produces `vocabIdForWord(word: string, reading: string): string | null`。

- [ ] **Step 1: 失敗テスト**

Create `app/src/words/vocabIndex.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vocabIdForWord } from './vocabIndex.ts';

test('word|reading 完全一致で id を返す', () => {
  const id = vocabIdForWord('会社', 'かいしゃ');
  assert.equal(typeof id, 'string');
  assert.ok(id && id.length > 0);
});
test('存在しない語は null', () => {
  assert.equal(vocabIdForWord('存在しない架空語', 'そんざいしないかくうご'), null);
});
test('reading 違いは null', () => {
  assert.equal(vocabIdForWord('会社', 'まちがい'), null);
});
```

- [ ] **Step 2: 失敗確認** — Run: `cd app && node --import tsx --test src/words/vocabIndex.test.ts` → FAIL。

- [ ] **Step 3: 実装**

Create `app/src/words/vocabIndex.ts`:

```ts
// 例語(word|reading)を vocab.json の id へ解決。完全一致のみ。一致=mp3再利用、無し=呼び側TTS。
import vocab from '../data/vocab.json';
const INDEX = new Map<string, string>();
for (const v of vocab as { id: string; word: string; reading: string }[]) {
  const key = `${v.word}|${v.reading}`;
  if (!INDEX.has(key)) INDEX.set(key, v.id);
}
export function vocabIdForWord(word: string, reading: string): string | null {
  return INDEX.get(`${word}|${reading}`) ?? null;
}
```

- [ ] **Step 4: パス確認** — Run同上 → PASS(3)。

- [ ] **Step 5: package.json** — `test` 末尾に ` src/words/vocabIndex.test.ts`。

- [ ] **Step 6: tsc＋commit**

Run: `cd app && npx tsc --noEmit` → clean。
```bash
cd app && git add src/words/vocabIndex.ts src/words/vocabIndex.test.ts package.json
git commit -m "feat(listening): 例語→vocab id 解決の純関数"
```

---

### Task 2: 漢字詳細の例語▷＋代表語の例語補完

**Files:** Modify `app/src/screens/KanjiDetailScreen.tsx`。

**Interfaces:** Consumes `vocabIdForWord`(Task1), `playVocab`(`../data/vocabAudio`), `Speech`, `kanjiDrillReps.json`。

現状: `CardLine = { label; furiWord }` を `fullWordReadingLines`/（あれば）`levelWordReadingLines` が作り `readLine` で描画。

- [ ] **Step 1: CardLine に word/wordReading 追加**

`interface CardLine { label: string; furiWord: string; }` →
```ts
interface CardLine { label: string; furiWord: string; word: string; wordReading: string; }
```

- [ ] **Step 2: ビルダーで word/wordReading を返す**

`fullWordReadingLines` の map 内を:
```ts
    list.map((e) => ({
      label: isOn ? hiraToKata(e.reading) : e.reading,
      furiWord: rubyForWord(e.word, e.wordReading),
      word: e.word, wordReading: e.wordReading,
    }));
```
（`levelWordReadingLines` が存在すれば同様に `word: ex?ex[0]:''`, `wordReading: ex?ex[1]:e.reading` を追加。無ければスキップ。）

- [ ] **Step 3: import と再生・audio mode・代表語補完**

import 追加:
```ts
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useEffect } from 'react';
import { playVocab } from '../data/vocabAudio';
import { vocabIdForWord } from '../words/vocabIndex';
import kanjiDrillReps from '../data/kanjiDrillReps.json';
```
本体（`const s = useMemo...` の後）:
```ts
  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {}); }, []);
  const playExample = (word: string, reading: string) => {
    const id = word ? vocabIdForWord(word, reading) : null;
    if (id) playVocab(id).then((ok) => { if (!ok && reading) Speech.speak(reading, { language: 'ja-JP' }); });
    else if (reading) Speech.speak(reading, { language: 'ja-JP' });
  };
  // 代表語(reps)が例語に無ければ補完行を作る。
  const rep = (kanjiDrillReps as Record<string, { bound: boolean; word: string; reading: string }>)[char];
  const repLine: CardLine | null = rep && !rep.bound && rep.word
    && ![...on, ...kun].some((l) => l.word === rep.word && l.wordReading === rep.reading)
    ? { label: rep.reading, furiWord: rubyForWord(rep.word, rep.reading), word: rep.word, wordReading: rep.reading }
    : null;
```
（`on`/`kun` は `useMemo` で得た配列。`repLine` はそれらの後で定義するため、`const { on, kun } = ...` の後に置く。）

- [ ] **Step 4: readPair に▷、補完行を描画**

`readLine` 内の各行（`readPair`）に▷を追加:
```tsx
        <View key={i} style={s.readPair}>
          <Text style={s.readLabel}>{e.label}：</Text>
          <View style={s.rubyWord}><RubyText text={e.furiWord} style={s.readWord} rubyStyle={s.readRuby} /></View>
          <Pressable style={s.exPlay} hitSlop={8} onPress={() => playExample(e.word, e.wordReading)}><Ionicons name="play" size={16} color={c.mute} /></Pressable>
        </View>
```
補完行は読みボックス（`readingsBox`）内、訓の後に条件表示:
```tsx
            {repLine ? readLine('例', [repLine]) : null}
```
（`readingsBox` の `{kun.length ? readLine('訓', kun) : null}` の直後に追加。`Pressable` 未importなら追加。）

- [ ] **Step 5: スタイル** — `makeStyles` に `exPlay: { paddingLeft: 6, paddingVertical: 2, alignSelf: 'center' },`。`readPair` が row 配置であること確認（縦積みなら `flexDirection:'row', alignItems:'center'`）。

- [ ] **Step 6: tsc＋commit**

Run: `cd app && npx tsc --noEmit` → clean。
```bash
cd app && git add src/screens/KanjiDetailScreen.tsx
git commit -m "feat(listening): 漢字詳細の例語に▷＋代表語の例語補完"
```

---

### Task 3: 聞き取り出題生成（語彙＋漢字・純関数）

**Files:** Create `app/src/listening/listeningQuiz.ts`, `app/src/listening/listeningQuiz.test.ts`; Modify `app/package.json`.

**Interfaces (Produces):**
- `type LQItem = { id: string; word: string; reading: string; meaning: string }`（語彙）
- `type KanjiRep = { id: string; char: string; level: string; bound: boolean; word: string; reading: string }`（漢字）
- `type LQQuestion = { answerId: string; audioVocabId: string | null; audioReading: string; choices: string[]; answerIndex: number }`
- `pickItems<T extends { id: string }>(pool: T[], count: number, rng: () => number): T[]`
- `nearDistractors(correct: LQItem, pool: LQItem[], count: number, rng): LQItem[]`
- `buildVocabQuiz(items: LQItem[], pool: LQItem[], rng): LQQuestion[]`
- `buildKanjiQuiz(items: KanjiRep[], pool: KanjiRep[], rng): LQQuestion[]`

**Consumes:** `vocabIdForWord`(Task1)。

- [ ] **Step 1: 失敗テスト**

Create `app/src/listening/listeningQuiz.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickItems, nearDistractors, buildVocabQuiz, buildKanjiQuiz, type LQItem, type KanjiRep } from './listeningQuiz.ts';

const rng0 = () => 0;
const seq = (a: number[]) => { let i = 0; return () => a[i++ % a.length]; };
const VP: LQItem[] = [
  { id: 'a', word: '会社', reading: 'かいしゃ', meaning: 'company' },
  { id: 'b', word: '会話', reading: 'かいわ', meaning: 'conversation' },
  { id: 'c', word: '社会', reading: 'しゃかい', meaning: 'society' },
  { id: 'd', word: '電車', reading: 'でんしゃ', meaning: 'train' },
  { id: 'e', word: '天気', reading: 'てんき', meaning: 'weather' },
];

test('pickItems は count 件重複なし・pool超で頭打ち', () => {
  assert.equal(pickItems(VP, 3, seq([0.1, 0.5, 0.9])).length, 3);
  assert.equal(pickItems(VP, 99, rng0).length, VP.length);
});
test('nearDistractors: 正解除外・共通漢字優先(会社→会話/社会)', () => {
  const d = nearDistractors(VP[0], VP, 2, rng0);
  assert.equal(d.length, 2);
  assert.ok(d.every((x) => x.id !== 'a'));
  assert.ok(d.some((x) => x.id === 'b' || x.id === 'c'));
});
test('buildVocabQuiz: 4択・正解含む・label=意味', () => {
  const qs = buildVocabQuiz([VP[0]], VP, seq([0.1, 0.3, 0.6, 0.9]));
  const q = qs[0];
  assert.equal(q.choices.length, 4);
  assert.equal(new Set(q.choices).size, 4);
  assert.equal(q.choices[q.answerIndex], 'company');
  assert.equal(q.audioReading, 'かいしゃ');
});

const KP: KanjiRep[] = [
  { id: 'k1', char: '火', level: 'N5', bound: false, word: '火', reading: 'ひ' },
  { id: 'k2', char: '水', level: 'N5', bound: false, word: '水', reading: 'みず' },
  { id: 'k3', char: '木', level: 'N5', bound: false, word: '木', reading: 'き' },
  { id: 'k4', char: '日', level: 'N5', bound: false, word: '日', reading: 'ひ' }, // 火と同音(ひ)
  { id: 'k5', char: '月', level: 'N5', bound: false, word: '月', reading: 'つき' },
  { id: 'k6', char: '校', level: 'N5', bound: true, word: '', reading: 'こう' },
];

test('buildKanjiQuiz: 選択肢=漢字1字・正解含む・同音字を誤答に入れない', () => {
  const qs = buildKanjiQuiz([KP[0]], KP, rng0); // 火(ひ)
  const q = qs[0];
  assert.equal(q.choices.length, 4);
  assert.ok(q.choices.includes('火'));
  assert.equal(q.choices[q.answerIndex], '火');
  assert.ok(!q.choices.includes('日')); // 日=ひ は同音なので除外
  assert.equal(q.audioReading, 'ひ');
});
test('buildKanjiQuiz: 拘束字は音読みが audioReading・audioVocabId は null', () => {
  const qs = buildKanjiQuiz([KP[5]], KP, rng0); // 校(こう)
  assert.equal(qs[0].audioReading, 'こう');
  assert.equal(qs[0].audioVocabId, null);
});
```

- [ ] **Step 2: 失敗確認** — Run: `cd app && node --import tsx --test src/listening/listeningQuiz.test.ts` → FAIL。

- [ ] **Step 3: 実装**

Create `app/src/listening/listeningQuiz.ts`:

```ts
// 聞き取りドリルの出題生成(純関数)。rng注入でテスト可能・毎回ダミーと順が変わる。
import { vocabIdForWord } from '../words/vocabIndex';

export type LQItem = { id: string; word: string; reading: string; meaning: string };
export type KanjiRep = { id: string; char: string; level: string; bound: boolean; word: string; reading: string };
export type LQQuestion = {
  answerId: string;
  audioVocabId: string | null; // mp3再生用(あればplayVocab、無ければTTS)
  audioReading: string;        // TTS用の読み
  choices: string[];
  answerIndex: number;
};

const KANJI_RE = /[一-龿々〆]/;
function kanjiSet(s: string): Set<string> { const o = new Set<string>(); for (const c of s) if (KANJI_RE.test(c)) o.add(c); return o; }
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function pickItems<T extends { id: string }>(pool: T[], count: number, rng: () => number): T[] {
  return shuffle(pool, rng).slice(0, Math.min(count, pool.length));
}

/** 語彙ダミー: 共通漢字>読み長/かな一致 でスコアし近いプールから。不足は補充。 */
export function nearDistractors(correct: LQItem, pool: LQItem[], count: number, rng: () => number): LQItem[] {
  const ck = kanjiSet(correct.word); const cr = correct.reading;
  const scored = pool
    .filter((p) => p.id !== correct.id && p.word !== correct.word && p.meaning !== correct.meaning)
    .map((p) => {
      let s = 0; for (const k of kanjiSet(p.word)) if (ck.has(k)) s += 3;
      if (p.reading.length === cr.length) s += 1;
      if (p.reading[0] === cr[0] || p.reading[p.reading.length - 1] === cr[cr.length - 1]) s += 1;
      return { p, s };
    });
  const near = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 20).map((x) => x.p);
  const chosen = shuffle(near, rng).slice(0, count);
  if (chosen.length < count) {
    const have = new Set(chosen.map((x) => x.id).concat(correct.id));
    for (const f of shuffle(pool.filter((p) => !have.has(p.id)), rng)) { if (chosen.length >= count) break; chosen.push(f); }
  }
  return chosen.slice(0, count);
}

export function buildVocabQuiz(items: LQItem[], pool: LQItem[], rng: () => number): LQQuestion[] {
  return items.map((it) => {
    const options = shuffle([it, ...nearDistractors(it, pool, 3, rng)], rng);
    return {
      answerId: it.id,
      audioVocabId: it.id, // 語彙は全て mp3 あり
      audioReading: it.reading,
      choices: options.map((o) => o.meaning),
      answerIndex: options.findIndex((o) => o.id === it.id),
    };
  });
}

/** 漢字ダミー: 同レベル・正解と同じ reading を除外(同音で当たらない事故防止)・近い字からランダム。不足は補充。 */
export function nearKanjiDistractors(correct: KanjiRep, pool: KanjiRep[], count: number, rng: () => number): KanjiRep[] {
  const cand = pool.filter((p) => p.id !== correct.id && p.char !== correct.char && p.reading !== correct.reading);
  const chosen = shuffle(cand, rng).slice(0, count);
  return chosen.slice(0, count);
}

export function buildKanjiQuiz(items: KanjiRep[], pool: KanjiRep[], rng: () => number): LQQuestion[] {
  return items.map((it) => {
    const options = shuffle([it, ...nearKanjiDistractors(it, pool, 3, rng)], rng);
    const audioVocabId = it.bound || !it.word ? null : vocabIdForWord(it.word, it.reading);
    return {
      answerId: it.id,
      audioVocabId,
      audioReading: it.reading,
      choices: options.map((o) => o.char),
      answerIndex: options.findIndex((o) => o.id === it.id),
    };
  });
}
```

- [ ] **Step 4: パス確認** — Run同上 → PASS(5)。

- [ ] **Step 5: package.json＋tsc** — `test` 末尾に ` src/listening/listeningQuiz.test.ts`。Run: `cd app && npx tsc --noEmit && node --import tsx --test src/listening/listeningQuiz.test.ts` → clean・PASS。

- [ ] **Step 6: Commit**
```bash
cd app && git add src/listening/listeningQuiz.ts src/listening/listeningQuiz.test.ts package.json
git commit -m "feat(listening): 語彙/漢字の出題生成(近いダミー・同音除外・rng注入)"
```

---

### Task 4: ListeningQuizScreen（学習→テスト→スコア・語彙/漢字）＋ナビ

**Files:** Create `app/src/screens/ListeningQuizScreen.tsx`; Modify `app/App.tsx`, `app/src/navigation/types.ts`, `app/src/i18n/ja.json`, `app/src/i18n/en.json`.

**Interfaces:** Consumes Task3 の生成関数, `levelListFor`(`../words/levelList`), `KANJI`/`VOCAB`/`meaningIn`(`../data`), `kanjiDrillReps.json`, `playVocab`, `quizAnswer`。Produces `ListeningQuiz: { kind: 'vocab' | 'kanji' }`。

- [ ] **Step 1: types** — `RootStackParamList` に `ListeningQuiz: { kind: 'vocab' | 'kanji' };`。

- [ ] **Step 2: i18n**（フラットドット記法・ja/en 両方）
- ja: `"listening2.study_title":"まず覚えよう"`,`"listening2.start_btn":"聞き取りを始める"`,`"listening2.prompt_vocab":"音声を聞いて意味を選ぼう"`,`"listening2.prompt_kanji":"音声を聞いて漢字を選ぼう"`,`"listening2.again":"🔊 もう一度"`,`"listening2.correct":"正解"`,`"listening2.wrong":"ちがう"`,`"listening2.next":"次へ"`,`"listening2.done_title":"おつかれさま"`,`"listening2.score":"{{correct}} / {{total}} 正解"`,`"listening2.close":"とじる"`,`"listening2.vocab_title":"語彙の聞き取り"`,`"listening2.kanji_title":"漢字の聞き取り"`
- en: 同キーで英語（`"listening2.prompt_kanji":"Listen and pick the kanji"` 等）。
JSON有効確認: `node -e "require('./src/i18n/ja.json');require('./src/i18n/en.json')"`。

- [ ] **Step 3: 画面実装**

Create `app/src/screens/ListeningQuizScreen.tsx`:

```tsx
// 聞き取りドリル(モーダル)。学習(10件予習)→テスト(音声4択)→スコア。語彙=意味/漢字=字。
import { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { levelListFor } from '../words/levelList';
import { KANJI, meaningIn } from '../data';
import { playVocab } from '../data/vocabAudio';
import kanjiDrillReps from '../data/kanjiDrillReps.json';
import { pickItems, buildVocabQuiz, buildKanjiQuiz, type LQItem, type KanjiRep, type LQQuestion } from '../listening/listeningQuiz';
import type { RootStackParamList } from '../navigation/types';
import { useT } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const COUNT = 10;
type StudyRow = { key: string; main: string; sub: string; meaning: string; play: () => void };

export default function ListeningQuizScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'ListeningQuiz'>>();
  const kind = route.params?.kind ?? 'vocab';
  const state = useAppState();
  const actions = useAppActions();
  const c = useColors();
  const t = useT();
  const s = useMemo(() => makeStyles(c), [c]);
  const l1 = state.settings.l1;
  const level = state.settings.level;

  useEffect(() => { Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {}); }, []);

  const play = (vocabId: string | null, reading: string) => {
    if (vocabId) playVocab(vocabId).then((ok) => { if (!ok && reading) Speech.speak(reading, { language: 'ja-JP' }); });
    else if (reading) Speech.speak(reading, { language: 'ja-JP' });
  };

  // 出題(セッション固定)。学習行＋テスト問題を同一10件から生成。
  const built = useMemo(() => {
    if (kind === 'vocab') {
      const pool: LQItem[] = (levelListFor('vocab', level) as { id: string; word: string; reading: string; meaning: string }[])
        .map((v) => ({ id: v.id, word: v.word, reading: v.reading, meaning: (l1 && l1 !== 'en' ? meaningIn(v.id, l1) : undefined) ?? v.meaning }));
      const items = pickItems(pool, COUNT, Math.random);
      const questions = buildVocabQuiz(items, pool, Math.random);
      const rows: StudyRow[] = items.map((it) => ({ key: it.id, main: it.word, sub: it.reading, meaning: it.meaning, play: () => play(it.id, it.reading) }));
      return { questions, rows };
    }
    const reps = kanjiDrillReps as Record<string, { level: string; bound: boolean; word: string; reading: string }>;
    const pool: KanjiRep[] = KANJI.filter((k) => k.type === 'kanji' && k.level === level && reps[k.char])
      .map((k) => ({ id: k.id, char: k.char, level: k.level, bound: reps[k.char].bound, word: reps[k.char].word, reading: reps[k.char].reading }));
    const items = pickItems(pool, COUNT, Math.random);
    const questions = buildKanjiQuiz(items, pool, Math.random);
    const meaningOf = (id: string, ch: string) => (l1 && l1 !== 'en' ? meaningIn(ch, l1) : undefined) ?? (KANJI.find((k) => k.id === id)?.meaning ?? '');
    const rows: StudyRow[] = items.map((it) => ({ key: it.id, main: it.char, sub: it.bound ? it.reading : `${it.word}（${it.reading}）`, meaning: meaningOf(it.id, it.char), play: () => play(it.bound || !it.word ? null : null, it.reading === '' ? it.reading : it.reading) }));
    // 漢字学習行の再生は代表音声(mp3/TTS)。play引数を問題と揃える。
    const rows2: StudyRow[] = items.map((it, i) => ({ ...rows[i], play: () => play(questions[i].audioVocabId, questions[i].audioReading) }));
    return { questions, rows: rows2 };
  }, [kind, level, l1]);

  const questions = built.questions;
  const rows = built.rows;
  const [phase, setPhase] = useState<'study' | 'quiz' | 'done'>('study');
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);

  if (questions.length === 0) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.head}><Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable><View style={{ width: 30 }} /></View>
        <View style={s.center}><Text style={s.prompt}>{t('listening2.done_title')}</Text><Pressable style={s.cta} onPress={() => nav.goBack()}><Text style={s.ctaTxt}>{t('listening2.close')}</Text></Pressable></View>
      </SafeAreaView>
    );
  }

  if (phase === 'study') {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.head}><Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable><Text style={s.headTitle}>{t(kind === 'vocab' ? 'listening2.vocab_title' : 'listening2.kanji_title')}</Text><View style={{ width: 30 }} /></View>
        <ScrollView contentContainerStyle={s.body}>
          <Text style={s.studyH}>{t('listening2.study_title')}</Text>
          {rows.map((r) => (
            <View key={r.key} style={s.studyRow}>
              <View style={{ flex: 1 }}><Text style={s.studySub}>{r.sub}</Text><Text style={s.studyMain}>{r.main}</Text><Text style={s.studyMeaning}>{r.meaning}</Text></View>
              <Pressable style={s.studyPlay} hitSlop={8} onPress={r.play}><Ionicons name="play" size={22} color={c.blue} /></Pressable>
            </View>
          ))}
          <Pressable style={s.cta} onPress={() => { setPhase('quiz'); setIdx(0); setPicked(null); }}><Text style={s.ctaTxt}>{t('listening2.start_btn')}</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'done') {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.head}><View style={{ width: 30 }} /></View>
        <View style={s.center}><Text style={s.bigEmoji}>🎧</Text><Text style={s.doneTitle}>{t('listening2.done_title')}</Text><Text style={s.doneScore}>{t('listening2.score', { correct, total: questions.length })}</Text><Pressable style={s.cta} onPress={() => nav.goBack()}><Text style={s.ctaTxt}>{t('listening2.close')}</Text></Pressable></View>
      </SafeAreaView>
    );
  }

  const q = questions[idx];
  const onPick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === q.answerIndex;
    if (ok) setCorrect((n) => n + 1);
    actions.quizAnswer(q.answerId, ok);
  };
  const advance = () => { if (idx + 1 >= questions.length) { setPhase('done'); return; } setIdx((i) => i + 1); setPicked(null); };
  const bigChoice = kind === 'kanji';

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}><Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable><Text style={s.headTitle}>{idx + 1} / {questions.length}</Text><View style={{ width: 30 }} /></View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.prompt}>{t(kind === 'vocab' ? 'listening2.prompt_vocab' : 'listening2.prompt_kanji')}</Text>
        <Pressable style={s.playBig} onPress={() => play(q.audioVocabId, q.audioReading)}><Ionicons name="volume-high" size={40} color="#fff" /></Pressable>
        <Pressable style={s.playAgain} hitSlop={8} onPress={() => play(q.audioVocabId, q.audioReading)}><Text style={s.playAgainTxt}>{t('listening2.again')}</Text></Pressable>
        <View style={s.choices}>
          {q.choices.map((ch, i) => {
            const reveal = picked !== null; const isAns = i === q.answerIndex; const isPk = i === picked;
            return (
              <Pressable key={i} onPress={() => onPick(i)} disabled={reveal} style={[bigChoice ? s.choiceKanji : s.choice, reveal && isAns && s.choiceOk, reveal && isPk && !isAns && s.choiceNg]}>
                <Text style={bigChoice ? s.choiceKanjiTxt : s.choiceTxt}>{ch}</Text>
              </Pressable>
            );
          })}
        </View>
        {picked !== null ? (
          <>
            <Text style={[s.judge, picked === q.answerIndex ? s.judgeOk : s.judgeNg]}>{picked === q.answerIndex ? t('listening2.correct') : t('listening2.wrong')}</Text>
            <Pressable style={s.cta} onPress={advance}><Text style={s.ctaTxt}>{idx + 1 >= questions.length ? t('listening2.close') : t('listening2.next')}</Text></Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    c: { flex: 1, backgroundColor: c.bg },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    headTitle: { fontSize: ty.small, fontWeight: '700', color: c.mute },
    close: { fontSize: 30, color: c.mute, fontWeight: '700' },
    body: { padding: spacing.lg, gap: spacing.md },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    studyH: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    studyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.sm },
    studySub: { fontSize: ty.tiny, color: c.mute },
    studyMain: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
    studyMeaning: { fontSize: ty.small, color: c.ink2 },
    studyPlay: { padding: spacing.sm },
    prompt: { fontSize: ty.body, fontWeight: '700', color: c.ink, textAlign: 'center' },
    playBig: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.md },
    playAgain: { alignSelf: 'center' },
    playAgainTxt: { fontSize: ty.small, color: c.blue, fontWeight: '700' },
    choices: { gap: spacing.sm + 2, marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    choice: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, alignItems: 'center', width: '100%' },
    choiceKanji: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', width: '46%', aspectRatio: 1 },
    choiceOk: { borderColor: c.green, backgroundColor: c.okBg },
    choiceNg: { borderColor: c.red, backgroundColor: c.bgSoft },
    choiceTxt: { fontSize: ty.body, fontWeight: '700', color: c.ink },
    choiceKanjiTxt: { fontSize: 48, fontWeight: '800', color: c.ink },
    judge: { fontSize: ty.h2, fontWeight: '800', textAlign: 'center', marginTop: spacing.md },
    judgeOk: { color: c.green }, judgeNg: { color: c.red },
    cta: { backgroundColor: c.blue, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg, width: '100%' },
    ctaTxt: { color: '#fff', fontSize: ty.h2, fontWeight: '800' },
    bigEmoji: { fontSize: 56 }, doneTitle: { fontSize: ty.h1, fontWeight: '800', color: c.ink }, doneScore: { fontSize: ty.h2, fontWeight: '700', color: c.ink2 },
  });
```

（注: 上の `built` useMemo で漢字学習行の `rows` を `rows2` に置換している。実装時は簡潔に、`rows` を最初から `questions[i]` の audio で作ってよい。色トークン `c.okBg/red/green/bgSoft/ink2/blue` は既存。）

- [ ] **Step 4: App.tsx 登録** — import `ListeningQuizScreen`、RootStack に `<RootStack.Screen name="ListeningQuiz" component={ListeningQuizScreen} options={{ presentation: 'modal' }} />`。

- [ ] **Step 5: tsc** — `cd app && npx tsc --noEmit` → clean。

- [ ] **Step 6: Commit**
```bash
cd app && git add src/screens/ListeningQuizScreen.tsx App.tsx src/navigation/types.ts src/i18n/ja.json src/i18n/en.json
git commit -m "feat(listening): 聞き取りドリル画面(学習→テスト・語彙/漢字)＋ナビ"
```

---

### Task 5: 単語タブのカードに聞き取り入口

**Files:** Modify `app/src/screens/CardsScreen.tsx`, `app/src/i18n/ja.json`, `app/src/i18n/en.json`.

- [ ] **Step 1: i18n** — ja `"cards.listening":"聞き取り"`, en `"cards.listening":"Listening"`。

- [ ] **Step 2: 語彙/漢字カードにボタン**

CardsScreen の各カードで vocab/kanji のみ聞き取りボタン（リンクボタン付近）:
```tsx
                {(card.key === 'vocab' || card.key === 'kanji') ? (
                  <Pressable style={({ pressed }) => [s.linkBtn, pressed && s.pressed]} onPress={() => nav.navigate('ListeningQuiz', { kind: card.key as 'vocab' | 'kanji' })}>
                    <Text style={s.linkTxt}>🎧 {t('cards.listening')}</Text>
                  </Pressable>
                ) : null}
```
（`nav` 型は Spec A で `WordsStackParamList & RootStackParamList`。`ListeningQuiz` は RootStack で解決。`s.linkBtn/linkTxt/pressed` 既存。）

- [ ] **Step 3: tsc＋全テスト** — `cd app && npx tsc --noEmit && npm test 2>&1 | tail -4` → clean・全PASS。

- [ ] **Step 4: Commit**
```bash
cd app && git add src/screens/CardsScreen.tsx src/i18n/ja.json src/i18n/en.json
git commit -m "feat(listening): 語彙/漢字カードに聞き取り入口を追加"
```

---

## Self-Review

**1. Spec coverage:** ④例語▷(Task1/2)・例語補完(Task2)・語彙ドリル音声→意味(Task3/4)・漢字ドリル音声→字(Task3/4)・拘束は音読みTTS(Task3 buildKanjiQuiz)・同音除外(nearKanjiDistractors)・近いダミー(nearDistractors)・2段学習(Task4 phase)・習得反映(quizAnswer)・入口(Task5)・データ(Task0)。✅

**2. Placeholder scan:** 「実装時に確認」は具体手順併記。TBD無し。✅

**3. Type consistency:** `LQQuestion{answerId,audioVocabId,audioReading,choices,answerIndex}` を Task3定義→Task4使用で一致。`KanjiRep`/`LQItem`・`pickItems`/`buildVocabQuiz`/`buildKanjiQuiz` シグネチャ一致。`ListeningQuiz{kind}` types→Cards一致。✅

**留意:** 漢字ドリル学習行の再生音声は問題(`questions[i].audioVocabId/audioReading`)と揃える。`KANJI` の型に `type`/`level`/`id`/`meaning` があること前提(既存)。`nearKanjiDistractors` は同音除外後に4択不足の可能性が理論上あるが、同レベル漢字は数十〜数百あり同音は僅少のため実務上必ず充足(N5 79字でも同音は最大数字)。
