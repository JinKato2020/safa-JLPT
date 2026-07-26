# 複数問／1文章「統一プレイヤー」＋文章の文法作り直し Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1文章に複数設問のタイプ(読解/文章の文法)を「文章＋全問一括提示→各問回答→最後の回答で一括採点→手動『次へ』」で出題する共通UIを作り、文章の文法を本番同形式のセットに作り直す。

**Architecture:** 共通型 `PassageSet` に読解(既存reading.json・アダプタ写像)と文章の文法(新passageGrammar.json)を統一。純関数の一括採点ロジックを中核に、`PassageSetPlayer` 1本で読解Quiz・文章の文法Quiz・模試を駆動。文章の文法は級相応漢字＋ふりがな＋pointIdでin-session生成(実費¥0)。

**Tech Stack:** TypeScript / Expo React Native / node --import tsx --test。

## Global Constraints

- gitルート=`app/`（`c:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ\app`）。全 git/npm はここで実行。
- テスト=`node --import tsx --test <file>`。**新規 `*.test.ts` は必ず `app/package.json` の `test` スクリプト末尾に追記**。型チェック=`npm run tsc`（エラーゼロ維持）。
- **ふりがな表示規約**: ルビは「ユーザーの級と同じ、またはそれより上(難)の漢字」だけ。下位(易)はルビなし。既存 `rubyNeeded(run, level)`（`src/data/index.ts`・`LV_RANK{N5:0,N4:1,N3:2,N2:3,N1:4}`, 判定 `漢字級ランク>=ユーザー級ランク`）をそのまま使用。本文・設問・選択肢すべてに適用。
- **一括提示UX**: 同一文章の複数設問は画面を切り替えず1画面に全問提示。各問タップ回答(その場で正誤を出さない)→**全問回答した瞬間に全問一括採点(色付け)＋各問 quizAnswer 記録(冪等)**→**手動「次へ」待機**→次セット。単発(1問)も同流れ。
- **マスタリーは設問(q.id)単位**。セット単位のSRS再挿入はしない。
- **文章の文法の正形式**: N3/N4=1長文×空欄5、N5=2短文×(2+3)。各級**40セット**(計120・約600問)。
- **生成規約**: 級相応の漢字/語彙/文法・過度に難しい漢字を混ぜない／全漢字 `漢字（かな）` 表記／国際ボーダーレス(個人名禁止・役割ベース)／各空欄は文法1項目・`pointId`=grammar.json実id・4択(正解1＋非競合誤答3)／空欄は本文に `【N】` で埋め他空欄は空欄のまま(旧データのように正解で埋めない)。
- 解説表示は無し(撤去済)。聴解は対象外(別spec)。

---

### Task 1: PassageSet 型＋reading アダプタ＋一括採点 純関数

**Files:**
- Create: `app/src/quiz/passageSet.ts`
- Test: `app/src/quiz/passageSet.test.ts`

**Interfaces:**
- Produces:
  - `interface PassageBlock { title?: string; body: string; format?: string }`
  - `interface SetQuestion { id: string; q?: string; blankNo?: number; choices: string[]; answerIndex: number; pointId?: string }`
  - `interface PassageSet { id: string; level: 'N5'|'N4'|'N3'; kind: 'reading'|'passage_grammar'; subtype?: string; passages: PassageBlock[]; questions: SetQuestion[] }`
  - `readingToSet(p): PassageSet` — reading.json の1エントリ(`{id,level,subtype,format,title,body,questions[]}`)を PassageSet に写像。
  - `gradeSet(answers: (number|null)[], questions: SetQuestion[]): { allAnswered: boolean; correct: boolean[]; correctCount: number }` — 純関数。全 answers が non-null なら allAnswered=true、各設問 answers[i]===questions[i].answerIndex で correct[i]。

- [ ] **Step 1: 失敗するテストを書く**

`app/src/quiz/passageSet.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import reading from '../data/exam/reading.json';
import { readingToSet, gradeSet, type SetQuestion } from './passageSet';

test('readingToSet は passage+questions を保持', () => {
  const p = (reading as any[])[0];
  const set = readingToSet(p);
  assert.equal(set.kind, 'reading');
  assert.equal(set.passages.length, 1);
  assert.equal(set.passages[0].body, p.body);
  assert.equal(set.questions.length, p.questions.length);
  assert.equal(set.questions[0].id, p.questions[0].id);
  assert.equal(set.questions[0].answerIndex, p.questions[0].answerIndex);
});

test('gradeSet: 未回答ありは allAnswered=false', () => {
  const qs: SetQuestion[] = [{ id: 'a', choices: ['x','y'], answerIndex: 0 }, { id: 'b', choices: ['x','y'], answerIndex: 1 }];
  const g = gradeSet([0, null], qs);
  assert.equal(g.allAnswered, false);
});

test('gradeSet: 全回答で採点', () => {
  const qs: SetQuestion[] = [{ id: 'a', choices: ['x','y'], answerIndex: 0 }, { id: 'b', choices: ['x','y'], answerIndex: 1 }];
  const g = gradeSet([0, 0], qs);
  assert.equal(g.allAnswered, true);
  assert.deepEqual(g.correct, [true, false]);
  assert.equal(g.correctCount, 1);
});
```

- [ ] **Step 2: テスト失敗を確認** — Run: `cd app && node --import tsx --test src/quiz/passageSet.test.ts` → FAIL（モジュール未作成）。

- [ ] **Step 3: 実装**

`app/src/quiz/passageSet.ts`:
```ts
// 1文章＝複数設問の共通モデルと純関数。読解(reading.json)と文章の文法(passageGrammar.json)を統一。
export interface PassageBlock { title?: string; body: string; format?: string }
export interface SetQuestion { id: string; q?: string; blankNo?: number; choices: string[]; answerIndex: number; pointId?: string }
export interface PassageSet {
  id: string;
  level: 'N5' | 'N4' | 'N3';
  kind: 'reading' | 'passage_grammar';
  subtype?: string;
  passages: PassageBlock[];
  questions: SetQuestion[];
}

interface ReadingRaw { id: string; level: string; subtype?: string; format?: string; title?: string; body: string; questions: { id: string; q: string; choices: string[]; answerIndex: number }[] }

/** reading.json の1エントリを PassageSet に写像（データ改変なし）。 */
export function readingToSet(p: ReadingRaw): PassageSet {
  return {
    id: p.id,
    level: p.level as PassageSet['level'],
    kind: 'reading',
    subtype: p.subtype,
    passages: [{ title: p.title, body: p.body, format: p.format }],
    questions: p.questions.map((q) => ({ id: q.id, q: q.q, choices: q.choices, answerIndex: q.answerIndex })),
  };
}

/** 一括採点。answers[i]=選択index or null。全問回答済みで allAnswered。 */
export function gradeSet(answers: (number | null)[], questions: SetQuestion[]): { allAnswered: boolean; correct: boolean[]; correctCount: number } {
  const allAnswered = questions.length > 0 && answers.length === questions.length && answers.every((a) => a !== null);
  const correct = questions.map((q, i) => answers[i] === q.answerIndex);
  const correctCount = correct.filter(Boolean).length;
  return { allAnswered, correct, correctCount };
}
```

- [ ] **Step 4: テスト成功＋tsc** — Run: `cd app && node --import tsx --test src/quiz/passageSet.test.ts && npm run tsc` → PASS / tscエラーなし。

- [ ] **Step 5: package.json にテスト追加** — `test` スクリプト末尾に ` src/quiz/passageSet.test.ts`。

- [ ] **Step 6: コミット**
```bash
cd app && git add src/quiz/passageSet.ts src/quiz/passageSet.test.ts package.json
git commit -m "feat(passage): PassageSet型＋readingアダプタ＋一括採点純関数"
```

---

### Task 2: PassageSetPlayer コンポーネント

**Files:**
- Create: `app/src/components/PassageSetPlayer.tsx`

**Interfaces:**
- Consumes: `PassageSet`,`SetQuestion`,`gradeSet`(Task1)。`RubyText`(`../components/RubyText`)、`rubyNeeded`(`../data`)、`useAppState`/`useAppActions`(`../store/store`)、`shuffleChoices`(`../quiz/quiz`)、`saveRef` は `question.pointId` から生成。
- Produces: `export default function PassageSetPlayer({ set, isLast, onNext }: { set: PassageSet; isLast: boolean; onNext: () => void }): JSX.Element`。全問回答で一括採点し各問 `quizAnswer(q.id, correct)` を1回記録、その後「次へ」で `onNext()`。

- [ ] **Step 1: 実装**

`app/src/components/PassageSetPlayer.tsx`:
```tsx
// 1文章＋全設問を一括提示→各問回答(正誤は出さない)→全問回答で一括採点(色付け)＋quizAnswer記録→「次へ」待機。
// 読解・文章の文法・模試で共用。ルビは同級以上のみ(rubyNeeded)。解説なし。pointIdある問は＋my単語帳。
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import RubyText from './RubyText';
import { rubyNeeded } from '../data';
import { useAppState, useAppActions } from '../store/store';
import { shuffleChoices } from '../quiz/quiz';
import { type PassageSet } from '../quiz/passageSet';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useT } from '../i18n';

export default function PassageSetPlayer({ set, isLast, onNext }: { set: PassageSet; isLast: boolean; onNext: () => void }) {
  const state = useAppState();
  const { quizAnswer, addToMyList } = useAppActions();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  const rubyGate = (run: string) => rubyNeeded(run, state.settings.level);

  // 選択肢は問ごとに一度だけシャッフルして固定（sh.answerIndex＝シャッフル後の正解位置）。
  const qs = useMemo(() => set.questions.map((q) => ({ q, sh: shuffleChoices(q.choices, q.answerIndex) })), [set.id]);
  const [answers, setAnswers] = useState<(number | null)[]>(() => set.questions.map(() => null));
  const [correctness, setCorrectness] = useState<boolean[]>(() => set.questions.map(() => false)); // pick時に確定
  const [recorded, setRecorded] = useState(false);
  const revealed = answers.every((a) => a !== null);

  // 全問回答した瞬間に、各設問の正誤を1回だけ記録（冪等）。
  useEffect(() => {
    if (revealed && !recorded) {
      set.questions.forEach((q, i) => quizAnswer(q.id, correctness[i]));
      setRecorded(true);
    }
  }, [revealed, recorded]);

  const pick = (qi: number, choiceIdx: number) => {
    if (answers[qi] !== null) return;
    const ok = choiceIdx === qs[qi].sh.answerIndex;
    setCorrectness((cs) => { const n = [...cs]; n[qi] = ok; return n; });
    setAnswers((a) => { const n = [...a]; n[qi] = choiceIdx; return n; });
  };

  const isSaved = (pointId?: string) => !!pointId && (state.myList ?? []).some((r) => r.type === 'grammar' && r.id === pointId);

  return (
    <ScrollView contentContainerStyle={s.body}>
      {set.passages.map((p, pi) => (
        <View key={pi} style={s.passageCard}>
          {p.format ? <Text style={s.fmtTag}>{p.format}</Text> : null}
          {p.title ? <RubyText text={p.title} style={s.passageTitle} rubyStyle={s.rubyS} rubyGate={rubyGate} /> : null}
          <View style={s.passageBodyWrap}>
            {p.body.split('\n').map((line, i) => (line ? <RubyText key={i} text={line} style={s.passageBody} rubyStyle={s.rubyS} rubyGate={rubyGate} /> : <View key={i} style={s.blankLine} />))}
          </View>
        </View>
      ))}

      {set.questions.map((q, qi) => {
        const picked = answers[qi];
        return (
          <View key={q.id} style={s.qBlock}>
            <Text style={s.qLabel}>{q.blankNo != null ? t('passage.blankLabel', { n: q.blankNo }) : t('passage.qLabel', { n: qi + 1 })}</Text>
            {q.q ? <RubyText text={q.q} style={s.qText} rubyStyle={s.rubyS} rubyGate={rubyGate} /> : null}
            <View style={s.choices}>
              {qs[qi].sh.choices.map((ch, ci) => {
                const isAns = ci === qs[qi].sh.answerIndex;
                const isPicked = ci === picked;
                return (
                  <Pressable key={ci} style={[s.choice, revealed && isAns && s.choiceOk, revealed && isPicked && !isAns && s.choiceNg, !revealed && isPicked && s.choicePicked]} onPress={() => pick(qi, ci)} disabled={revealed}>
                    <View style={s.choiceTxtWrap}><RubyText text={ch} style={s.choiceTxt} rubyStyle={s.rubyS} rubyGate={rubyGate} /></View>
                    {revealed && isAns ? <Text style={s.mark}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
            {revealed && q.pointId ? (
              <Pressable style={s.saveBtn} onPress={() => addToMyList({ type: 'grammar', id: q.pointId! })}>
                <Text style={s.saveTxt}>{isSaved(q.pointId) ? t('mywords.added') : t('mywords.add')}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {revealed ? (
        <Pressable style={s.nextBtn} onPress={onNext}><Text style={s.nextTxt}>{isLast ? t('passage.toResult') : t('passage.next')}</Text></Pressable>
      ) : (
        <Text style={s.hint}>{t('passage.hint')}</Text>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.md },
  passageCard: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: spacing.md, gap: spacing.xs },
  fmtTag: { fontSize: ty.tiny, fontWeight: '800', color: c.mute, letterSpacing: 1 },
  passageTitle: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  passageBodyWrap: { gap: 2 },
  passageBody: { fontSize: ty.body, color: c.ink2, lineHeight: 26 },
  blankLine: { height: spacing.sm },
  rubyS: { fontSize: 10, color: c.mute },
  qBlock: { gap: spacing.sm },
  qLabel: { fontSize: ty.small, fontWeight: '800', color: c.blueDark },
  qText: { fontSize: ty.body, color: c.ink },
  choices: { gap: spacing.sm },
  choice: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: c.line, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  choicePicked: { borderColor: c.blue, backgroundColor: c.blueLight },
  choiceOk: { borderColor: c.good ?? c.blue, backgroundColor: c.blueLight },
  choiceNg: { borderColor: c.bad ?? c.trace, opacity: 0.85 },
  choiceTxtWrap: { flex: 1 },
  choiceTxt: { fontSize: ty.body, color: c.ink2 },
  mark: { fontSize: ty.body, color: c.blueDark, fontWeight: '800' },
  saveBtn: { alignSelf: 'flex-start', backgroundColor: c.blueLight, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: spacing.md },
  saveTxt: { fontSize: ty.small, fontWeight: '700', color: c.blueDark },
  nextBtn: { backgroundColor: c.blue, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  nextTxt: { color: '#ffffff', fontSize: ty.body, fontWeight: '800' },
  hint: { fontSize: ty.tiny, color: c.faint, textAlign: 'center' },
});
```

NOTE（実装者向けの実在合わせ）: `RubyText` の props 名（`text`/`style`/`rubyStyle`/`rubyGate`）は ReadingScreen の使用に合わせる（相違あれば実在に合わせて調整）。テーマ色 `c.good`/`c.bad` が `theme.ts` に無ければ、ReadingScreen の正誤色（`choiceCorrect`/`choiceWrong` が参照する色）に置換する。`gradeSet` はテスト対象の純関数で、コンポーネントは pick 時に確定する `correctness` を使うため import しない。

- [ ] **Step 2: i18n キー追加**

`src/i18n/ja.json` と `src/i18n/en.json` に: `passage.next`(次へ/Next)、`passage.toResult`(結果へ/See results)、`passage.hint`(すべての問に答えてください/Answer all questions)、`passage.qLabel`(問{n}/Q{n})、`passage.blankLabel`({n}/No.{n})。他9言語は既存fallback。既存に同義キーあれば再利用。

- [ ] **Step 3: tsc** — Run: `cd app && npm run tsc` → エラーなし（テーマ色名・RubyText props を実在に合わせて解消）。

- [ ] **Step 4: コミット**
```bash
cd app && git add src/components/PassageSetPlayer.tsx src/i18n/ja.json src/i18n/en.json
git commit -m "feat(passage): PassageSetPlayer(一括提示→一括採点→手動次へ)"
```

---

### Task 3: 読解Quiz(ReadingScreen)を PassageSetPlayer に載せ替え

**Files:**
- Modify: `app/src/screens/ReadingScreen.tsx`

**Interfaces:**
- Consumes: `PassageSetPlayer`(Task2)、`readingToSet`(Task1)、既存 `readingItemsForSub`/`readingItemsFor`。

- [ ] **Step 1: セット単位ステップへ改修**

`ReadingScreen.tsx` を、現在の「1問=1ステップ(flatMap)」から「1パッセージ=1セット」へ変更する:
- `steps` を「PassageSet の配列」にする: `all`(passages) を needy 優先で選び、各 passage を `readingToSet(p)` で `PassageSet` 化した配列 `sets` を作る（`flatMap`の展開は廃止）。
- `idx`(現在セット), `setIdx` を保持。`before` スナップショットは維持。
- 完了画面(`!step`)は現状のまま流用（`answered`/`correct` の集計は PassageSetPlayer 側の quizAnswer に委ねるため、完了サマリーは `SessionSummary` の before/after で表示する。`reading.scoreResult` の answered/correct は、セット横断で数える必要があれば `state.items` から算出、簡便には表示を残しつつ 0 初期化でも可＝既存 SessionSummary が主指標）。
- 現在セット `set = sets[idx]` を `<PassageSetPlayer set={set} isLast={idx+1>=sets.length} onNext={() => setIdx(i=>i+1)} />` で描画。トップバー(✕・`idx+1 / sets.length`)は残す。
- **既存の per-question relearn 再挿入(`reinsertForRelearn`)は廃止**（マスタリーはセット内 quizAnswer で記録、SRSはセッション横断）。`MAX_STEPS`/`RELEARN_GAP` 参照が不要になれば削除。
- `quizAnswer`/`RubyText` の直接使用が無くなる分の import を整理。

（実装者へ: 既存の `Step` 型・`onPick`・`advance`・パッセージ/設問描画ブロックを削除し、PassageSetPlayer に置換する。完了画面と SessionSummary、トップバーは保持。）

- [ ] **Step 2: tsc＋テスト** — Run: `cd app && npm run tsc && npm test 2>&1 | grep -E "^ℹ (pass|fail)"` → tscエラーなし・`fail 0`。

- [ ] **Step 3: 動作の目視確認事項をコミットメッセージに記載**（実機確認は後段）。

- [ ] **Step 4: コミット**
```bash
cd app && git add src/screens/ReadingScreen.tsx
git commit -m "feat(reading): 読解をPassageSetPlayerでセット一括提示に載せ替え"
```

---

### Task 4: 文章の文法コンテンツ生成（120セット）＋passageGrammar.json＋検証

**Files:**
- Create: `app/src/data/exam/passageGrammar.json`（生成物）
- Create: `app/tools/verify_passage_grammar.mjs`（検証スクリプト）
- Test: `app/src/data/exam/passageGrammar.test.ts`

**Interfaces:**
- Produces: `passageGrammar.json` = `PassageSet[]`（`kind:'passage_grammar'`）。各セット `questions[i].blankNo` は本文 `【N】` に対応、`pointId`∈grammar.json。

**生成方針（実費¥0・in-session）**: この Task は**コントローラ(親)がサブエージェントで生成**する。CLAUDE.md #9厳守＝少数の大きめエージェント(目安 級ごと数エージェント・計〜12以下)・read廃止・各エージェントが自分の担当セットを生成し JSON を返す/Write・**gen内自己検証**（各セット: 空欄数(N3/N4=5, N5=2文2+3)・`【N】`と questions の対応・pointId は渡した grammar.json id 一覧内・4択に正解1つ＋重複なし・級相応漢字＋`漢字（かな）`・個人名なし）。生成に使う grammar.json の該当級 pointId 一覧は args で渡す。

- [ ] **Step 1: 検証スクリプトを書く**

`app/tools/verify_passage_grammar.mjs`:
```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '../src/data/exam');
const sets = JSON.parse(readFileSync(join(dir, 'passageGrammar.json'), 'utf8'));
const gids = new Set(JSON.parse(readFileSync(join(dir, '../shared/grammar.json'), 'utf8')).map((g) => g.id));
const errs = [];
const byLv = {};
for (const s of sets) {
  byLv[s.level] = (byLv[s.level] || 0) + 1;
  const nBlank = s.level === 'N5' ? 5 : 5; // N5は2文合計5、N3/N4は1文5
  if (s.kind !== 'passage_grammar') errs.push(`${s.id}: kind`);
  if (!Array.isArray(s.passages) || s.passages.length < 1) errs.push(`${s.id}: passages`);
  if (s.level === 'N5' && s.passages.length !== 2) errs.push(`${s.id}: N5は2文`);
  if ((s.level === 'N3' || s.level === 'N4') && s.passages.length !== 1) errs.push(`${s.id}: N3/N4は1文`);
  if (s.questions.length !== nBlank) errs.push(`${s.id}: 設問数 ${s.questions.length}≠${nBlank}`);
  const bodyAll = s.passages.map((p) => p.body).join('\n');
  for (const q of s.questions) {
    if (!bodyAll.includes(`【${q.blankNo}】`)) errs.push(`${s.id}:${q.blankNo} 本文に空欄なし`);
    if (!(q.answerIndex >= 0 && q.answerIndex < q.choices.length)) errs.push(`${s.id}:${q.blankNo} answerIndex`);
    if (new Set(q.choices).size !== q.choices.length) errs.push(`${s.id}:${q.blankNo} 選択肢重複`);
    if (q.pointId && !gids.has(q.pointId)) errs.push(`${s.id}:${q.blankNo} pointId未解決 ${q.pointId}`);
  }
  const ids = s.questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) errs.push(`${s.id}: 設問id重複`);
}
console.log('セット数:', sets.length, '級別:', byLv);
if (errs.length) { console.error('NG', errs.length, errs.slice(0, 20)); process.exit(1); }
console.log('OK: all sets valid');
```

- [ ] **Step 2: 生成（コントローラがサブエージェントで実施）**
級ごとに 40 セット、計120。各エージェントに (a) 級、(b) 担当セット数、(c) その級の grammar.json pointId 一覧＋point/意味、(d) 生成規約(Global Constraints の生成規約)＋出力JSONスキーマ、(e) 自己検証条件 を args で渡し、`PassageSet[]` 断片を返させる。返却を統合して `passageGrammar.json` に書き出す。id 規約: `pg-<level>-<3桁>`、設問 `pg-<level>-<3桁>-q<blankNo>`。

- [ ] **Step 3: 検証実行**
Run: `cd app && node tools/verify_passage_grammar.mjs`
Expected: `セット数: 120 級別: { N5:40, N4:40, N3:40 } … OK: all sets valid`（NG が出たら該当セットのみ再生成して統合し直す）。

- [ ] **Step 4: 失敗するテスト→実装確認**

`app/src/data/exam/passageGrammar.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sets from './passageGrammar.json';
import grammar from '../shared/grammar.json';

const S = sets as any[];
const gids = new Set((grammar as any[]).map((g) => g.id));

test('120セット・級別40', () => {
  assert.equal(S.length, 120);
  const by: Record<string, number> = {};
  for (const s of S) by[s.level] = (by[s.level] || 0) + 1;
  assert.deepEqual(by, { N5: 40, N4: 40, N3: 40 });
});

test('各セット: 設問5・空欄対応・pointId解決・4択', () => {
  for (const s of S) {
    assert.equal(s.kind, 'passage_grammar');
    assert.equal(s.questions.length, 5);
    if (s.level === 'N5') assert.equal(s.passages.length, 2);
    else assert.equal(s.passages.length, 1);
    const body = s.passages.map((p: any) => p.body).join('\n');
    for (const q of s.questions) {
      assert.ok(body.includes(`【${q.blankNo}】`), `${s.id} 本文に【${q.blankNo}】`);
      assert.ok(q.answerIndex >= 0 && q.answerIndex < q.choices.length);
      assert.equal(new Set(q.choices).size, q.choices.length);
      if (q.pointId) assert.ok(gids.has(q.pointId));
    }
  }
});
```
Run: `cd app && node --import tsx --test src/data/exam/passageGrammar.test.ts` → PASS。

- [ ] **Step 5: package.json にテスト追加** — ` src/data/exam/passageGrammar.test.ts`。

- [ ] **Step 6: コミット**
```bash
cd app && git add src/data/exam/passageGrammar.json tools/verify_passage_grammar.mjs src/data/exam/passageGrammar.test.ts package.json
git commit -m "feat(passage): 文章の文法120セットを本番形式で生成＋検証"
```

---

### Task 5: 文章の文法を新データ経路へ差し替え＋Quiz接続＋旧passage_grammar除外

**Files:**
- Modify: `app/src/data/index.ts`（passageGrammar を export）
- Modify: `app/src/data/daimon.ts`（BANK から passage_grammar 除外）
- Create: `app/src/screens/PassageGrammarScreen.tsx`（または既存 QuizScreen 分岐）— 文章の文法Quizを PassageSetPlayer で提示
- Modify: `app/src/navigation/types.ts`＋`App.tsx`（新画面を登録する場合）
- Modify: 文章の文法Quiz を起動している箇所（StudyScreen 等）
- Test: `app/src/data/passageGrammarWire.test.ts`

**Interfaces:**
- Consumes: `passageGrammar.json`、`PassageSet`、`PassageSetPlayer`。
- Produces: `export const PASSAGE_GRAMMAR = passageGrammar as PassageSet[]`（index.ts）。`passageGrammarSetsFor(level): PassageSet[]`。

- [ ] **Step 1: 失敗するテスト**

`app/src/data/passageGrammarWire.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANK } from './daimon';
import { PASSAGE_GRAMMAR, passageGrammarSetsFor } from './index';

test('BANK に passage_grammar が含まれない(新経路へ移行)', () => {
  assert.equal(BANK.some((b) => b.daimon === 'passage_grammar'), false);
});
test('passageGrammarSetsFor は級で絞る', () => {
  assert.ok(PASSAGE_GRAMMAR.length === 120);
  const n3 = passageGrammarSetsFor('N3');
  assert.ok(n3.length === 40 && n3.every((s) => s.level === 'N3'));
});
```

- [ ] **Step 2: 失敗確認** — Run: `cd app && node --import tsx --test src/data/passageGrammarWire.test.ts` → FAIL。

- [ ] **Step 3: index.ts に export 追加**
`src/data/index.ts` に:
```ts
import passageGrammar from './exam/passageGrammar.json';
import type { PassageSet } from '../quiz/passageSet';
export const PASSAGE_GRAMMAR = passageGrammar as PassageSet[];
export function passageGrammarSetsFor(level: string): PassageSet[] { return PASSAGE_GRAMMAR.filter((s) => s.level === level); }
```

- [ ] **Step 4: daimon.ts の BANK から passage_grammar 除外**
`src/data/daimon.ts` の `BANK` フィルタを拡張:
```ts
export const BANK: BankUnit[] = (KNOWLEDGE_BANK as BankUnit[])
  .filter((b) => !(b.daimon === 'order' && b.ambiguous))
  .filter((b) => b.daimon !== 'passage_grammar'); // 文章の文法は passageGrammar.json(セット形式)へ移行
```
（`daimonUnitIds`/`questionForUnit` の passage_grammar 分岐は BANK 経由で自然に空になる。ただし `BUNPOU_DAIMON` に passage_grammar が残ることでカバー率/リング分母に影響する場合は、passage_grammar の母数を `passageGrammarSetsFor(level)` の設問数に置換する—実装者は `sectionUnitIds`/`daimonUnitIds('passage_grammar')` の呼び出し元を確認し、passage_grammar の母数=セット設問idの集合に差し替える。）

- [ ] **Step 5: 文章の文法Quiz 画面を PassageSetPlayer で実装**
`PassageGrammarScreen.tsx`（新規・RootStack modal）: `passageGrammarSetsFor(level)` から needy(未習得設問を含む)優先でセットを選び、`idx` でセット送り、`<PassageSetPlayer set={sets[idx]} isLast={...} onNext={...} />`。完了画面は ReadingScreen と同型（SessionSummary）。`navigation/types.ts` に `PassageGrammar: undefined` を追加、`App.tsx` に modal 登録、StudyScreen(または該当起動元)の「文章の文法」導線を新画面へ向ける。

- [ ] **Step 6: テスト＋tsc** — Run: `cd app && node --import tsx --test src/data/passageGrammarWire.test.ts && npm run tsc && npm test 2>&1 | grep -E "^ℹ (pass|fail)"` → PASS / tscエラーなし / `fail 0`。

- [ ] **Step 7: package.json にテスト追加** — ` src/data/passageGrammarWire.test.ts`。

- [ ] **Step 8: コミット**
```bash
cd app && git add src/data/index.ts src/data/daimon.ts src/screens/PassageGrammarScreen.tsx src/navigation/types.ts src/App.tsx src/screens/StudyScreen.tsx src/data/passageGrammarWire.test.ts package.json
git commit -m "feat(passage): 文章の文法を新セット経路へ差し替え＋Quiz接続＋旧BANK除外"
```

---

### Task 6: 模試(MockScreen)を passage-set 対応

**Files:**
- Modify: `app/src/screens/MockScreen.tsx`

**Interfaces:**
- Consumes: `PassageSetPlayer`、`readingToSet`、`passageGrammarSetsFor`。

- [ ] **Step 1: 模試のステップに passage-set を組み込む**
`MockScreen.tsx` の出題ビルドで、読解・文章の文法を **passage-set 単位のステップ**として扱う:
- 読解の設問群は `readingToSet` でセット化、文章の文法は `passageGrammarSetsFor(level)` からセットを採用（examBlueprint の規定数）。
- 該当ステップは `<PassageSetPlayer set={set} isLast={最終か} onNext={次ステップへ} />` で描画。採点は PassageSetPlayer 内の quizAnswer で設問単位に記録され、模試スコアは**設問ごとに加算**（現行の word/listening ステップは従来どおり）。
- 制限時間タイマー(`setTimeout`によるカウントダウン→結果遷移)は維持。タイムアウト時は未回答を不正解扱いで結果へ（現行動作を保つ）。
- 「次へ」は PassageSetPlayer の onNext（単発 word/listening ステップは前バッチで実装済みの手動「次へ」）で統一。

（実装者へ: 現行 MockScreen は 1item=1step。reading/passage_grammar を含むステップを「セット型ステップ」に拡張し、`cur.kind` に応じて PassageSetPlayer か既存 word/listening 描画を出し分ける。スコア集計は設問数ベースへ調整。）

- [ ] **Step 2: tsc＋テスト** — Run: `cd app && npm run tsc && npm test 2>&1 | grep -E "^ℹ (pass|fail)"` → tscエラーなし・`fail 0`。

- [ ] **Step 3: コミット**
```bash
cd app && git add src/screens/MockScreen.tsx
git commit -m "feat(mock): 模試を passage-set 一括提示に対応(設問単位採点・タイマー維持)"
```

---

### Task 7: 最終検証

- [ ] **Step 1: 全チェック** — Run: `cd app && npm run tsc && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)" && node tools/verify_passage_grammar.mjs`
Expected: tscエラーなし・`fail 0`・`OK: all sets valid`。
- [ ] **Step 2: grep 健全性** — `grep -rn "passage_grammar" src/data/daimon.ts` が BANK 除外のみ、`grep -rn "reinsertForRelearn" src/screens/ReadingScreen.tsx` が空（載せ替え済）。
- [ ] **Step 3: 手元確認事項（実機）**: 読解で1文章に複数問が1画面表示・全回答で一括採点・手動次へ／文章の文法で長文＋空欄5(N5は2文2+3)・一括採点・pointId問に＋my単語帳／模試でセット提示＋タイマー継続。

## 実装順序（依存）
Task1→2→3（読解が先に動く・テスト可）→4（生成）→5（文章の文法接続）→6（模試）→7（最終）。
