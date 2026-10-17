# 漢字・語彙・文法のカテゴリー分類 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 単語タブの漢字/語彙/文法リストを50音順から「種類ごとに最適な軸のテーマ分類（全レベル共通枠）」のセクション表示にし、漢数字に数え方の例を加える。

**Architecture:** 正本タクソノミー `categories.ts` ＋ 割当JSON3本（char/vocabId/grammarId → カテゴリid）。純関数 `groupByCategory` でセクション化し、`BrowseScreen`(study) を `FlatList`→`SectionList` に。割当は「規則生成＋全件レビュー」。

**Tech Stack:** React Native / Expo, TypeScript, node:test + tsx, Python(データ生成/音声), Google TTS Neural2-B.

## Global Constraints
- 全項目は**ちょうど1カテゴリ**（未割当0・重複0）。ビルド前に`node`テストで保証。
- カテゴリ枠は**全レベル共通**（per-level差なし）。中身のitem集合は既存のまま不変（例外: 文法にある非自立24語はvocab割当から除外）。
- ラベルは i18n `cat.<id>`（初期 ja/en、他言語は後続翻訳パス。無い言語は ja/en フォールバック）。
- 新規テストは `app/package.json` の `test` スクリプトに登録。
- 音声は既存mp3再利用、未生成読みのみ かな送信で Neural2-B 生成。1000円ルール厳守（超なら見積提示）。
- タクソノミーidは spec §1-3 と一字一句一致。

## File Structure
- `app/src/data/categories.ts`（新規・正本）: 型・`CATS`配列・索引。
- `app/src/data/kanjiCategory.json`（新規）: `{ char: umbrellaId }` 612件。
- `app/src/data/vocabCategory.json`（新規）: `{ vocabId: subId }`（文法移管24除く全語）。
- `app/src/data/grammarCategory.json`（新規）: `{ grammarId: funcId }` 全点。
- `app/src/words/groupByCategory.ts`（新規）: セクション化純関数。
- `app/src/words/groupByCategory.test.ts` / `categories.test.ts`（新規テスト）。
- `app/src/screens/BrowseScreen.tsx`（改修）: study時 SectionList。
- `app/src/data/kanjiCardReadings.json`（改修）: 漢数字に数え方例追加。
- `問題/tools/build_number_audio.py`（新規・git外）: 数え方の未生成読みを生成。
- `問題/tools/gen_categories.py`（新規・git外）: 規則で割当JSONを一次生成。

---

### Task 1: タクソノミー `categories.ts` ＋ セクション化純関数

**Files:**
- Create: `app/src/data/categories.ts`
- Create: `app/src/words/groupByCategory.ts`
- Test: `app/src/data/categories.test.ts`, `app/src/words/groupByCategory.test.ts`

**Interfaces:**
- Produces:
  - `type CatKind = 'kanji' | 'vocab' | 'grammar'`
  - `interface Cat { id: string; kind: CatKind; umbrella?: string; label: string; order: number }`
  - `const CATS: Cat[]`（漢字傘8＝kind:'kanji'／語彙小テーマ30＝kind:'vocab'・umbrella付／文法11＝kind:'grammar'）
  - `const CAT_BY_ID: Record<string, Cat>`
  - `interface CatSection<T> { catId: string; label: string; umbrella?: string; data: T[] }`
  - `function groupByCategory<T>(items: T[], mapping: Record<string,string>, keyOf: (t:T)=>string, kind: CatKind): CatSection<T>[]`

- [ ] **Step 1: Write failing test** (`categories.test.ts`)
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATS, CAT_BY_ID } from './categories.ts';
test('CATS: id一意・umbrella参照は有効・kind別件数', () => {
  const ids = CATS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length); // 一意
  const kanji = CATS.filter((c) => c.kind === 'kanji');
  const vocab = CATS.filter((c) => c.kind === 'vocab');
  const gram = CATS.filter((c) => c.kind === 'grammar');
  assert.equal(kanji.length, 8);
  assert.equal(gram.length, 11);
  assert.ok(vocab.length >= 25);
  for (const v of vocab) assert.ok(v.umbrella && CAT_BY_ID[v.umbrella]?.kind === 'kanji'); // 傘は漢字8の何れか
});
```

- [ ] **Step 2: Run test → FAIL**
Run: `cd app && node --import tsx --test src/data/categories.test.ts`
Expected: FAIL（categories.ts 未作成）

- [ ] **Step 3: Implement `categories.ts`**（spec §1-3 全項目・order昇順）
```ts
export type CatKind = 'kanji' | 'vocab' | 'grammar';
export interface Cat { id: string; kind: CatKind; umbrella?: string; label: string; order: number }

// 漢字傘8（語彙の傘も兼ねる）
const K: [string, string][] = [
  ['nature','自然・天地'],['position','位置・方向'],['body','人・体・家族'],['numtime','数・時・暦'],
  ['action','動作'],['state','様子・性質'],['society','暮らし・社会'],['mind','心・考え・抽象'],
];
// 語彙小テーマ [id, umbrella, label]
const V: [string, string, string][] = [
  ['weather','nature','天気・季節'],['animal','nature','動物'],['plant','nature','植物'],['geo','nature','地理・自然'],
  ['direction','position','位置・方向'],['deixis','position','指示(こそあど場所)'],
  ['family','body','家族・人'],['bodyhealth','body','体・健康'],['relation','body','人間関係・呼び方'],
  ['number','numtime','数・量'],['time','numtime','時間・日付'],['counter','numtime','助数詞（数え方）'],
  ['move','action','移動・往来'],['giveget','action','授受・売買'],['perceive','action','見る聞く話す'],['daily','action','日常動作'],['mindverb','action','心の動き'],
  ['size','state','大小・多少・長短'],['quality','state','新旧・良悪'],['color','state','色'],['sense','state','感覚・様子'],['adverb','state','副詞'],
  ['food','society','食べ物・飲み物'],['home','society','家・日用品'],['clothes','society','衣服'],['shopmoney','society','買い物・お金'],['transport','society','交通'],['place','society','場所・建物'],['school','society','学校・勉強'],['work','society','仕事・社会'],['hobby','society','趣味・遊び'],
  ['emotion','mind','気持ち・感情'],['think','mind','思考・判断'],['abstract','mind','抽象概念'],['expression','mind','あいさつ・表現'],['function','mind','機能語'],
];
// 文法機能11
const G: [string, string][] = [
  ['particle','助詞'],['verbform','動詞・活用の形'],['pattern','文型・接続'],['timeorder','時・順序'],
  ['reason','理由・目的'],['condition','条件・仮定'],['request','依頼・許可・禁止・意志'],['degree','比較・程度'],
  ['evidential','推量・伝聞・様態'],['suffix','接尾・機能語'],['keigo','敬語・丁寧'],
];
let o = 0;
export const CATS: Cat[] = [
  ...K.map(([id, label]): Cat => ({ id, kind: 'kanji', label, order: o++ })),
  ...V.map(([id, umbrella, label]): Cat => ({ id, kind: 'vocab', umbrella, label, order: o++ })),
  ...G.map(([id, label]): Cat => ({ id, kind: 'grammar', label, order: o++ })),
];
export const CAT_BY_ID: Record<string, Cat> = Object.fromEntries(CATS.map((c) => [c.id, c]));
```

- [ ] **Step 4: Run test → PASS**
Run: `cd app && node --import tsx --test src/data/categories.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing test** (`groupByCategory.test.ts`)
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByCategory } from './groupByCategory.ts';
test('groupByCategory: taxonomy順・空カテゴリ除外・keyOfで割当', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const map = { a: 'action', b: 'nature', c: 'nature' }; // natureが先(order小)
  const secs = groupByCategory(items, map, (i) => i.id, 'kanji');
  assert.deepEqual(secs.map((s) => s.catId), ['nature', 'action']); // order昇順
  assert.equal(secs[0].data.length, 2);
  assert.equal(secs[0].label, '自然・天地');
});
```

- [ ] **Step 6: Run test → FAIL**
Run: `cd app && node --import tsx --test src/words/groupByCategory.test.ts`
Expected: FAIL（未実装）

- [ ] **Step 7: Implement `groupByCategory.ts`**
```ts
import { CATS, CAT_BY_ID, type CatKind, type Cat } from '../data/categories';
export interface CatSection<T> { catId: string; label: string; umbrella?: string; data: T[] }
export function groupByCategory<T>(
  items: T[], mapping: Record<string, string>, keyOf: (t: T) => string, kind: CatKind,
): CatSection<T>[] {
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const cid = mapping[keyOf(it)];
    if (!cid) continue; // 未割当は表示しない(テストで0保証)
    (buckets.get(cid) ?? buckets.set(cid, []).get(cid)!).push(it);
  }
  return CATS
    .filter((c: Cat) => (kind === 'vocab' ? c.kind === 'vocab' : c.kind === kind) && buckets.has(c.id))
    .map((c) => ({ catId: c.id, label: c.label, umbrella: c.umbrella, data: buckets.get(c.id)! }));
}
```

- [ ] **Step 8: Run test → PASS**
Run: `cd app && node --import tsx --test src/words/groupByCategory.test.ts`
Expected: PASS

- [ ] **Step 9: Register tests & commit**
`app/package.json` の `test` 末尾に ` src/data/categories.test.ts src/words/groupByCategory.test.ts` を追加。
```bash
cd app && git add src/data/categories.ts src/words/groupByCategory.ts src/data/categories.test.ts src/words/groupByCategory.test.ts package.json && git commit -m "feat(category): タクソノミー定義とセクション化純関数"
```

---

### Task 2: 漢字割当 `kanjiCategory.json`（612字→傘8）

**Files:**
- Create: `app/src/data/kanjiCategory.json`
- Create: `問題/tools/gen_categories.py`（一次生成・git外）
- Test: `app/src/data/kanjiCategory.test.ts`

**Interfaces:**
- Consumes: `CATS`(kind:'kanji') / Produces: `kanjiCategory.json = { [char:string]: umbrellaId }`

- [ ] **Step 1: 一次生成スクリプト**（`gen_categories.py`・意味キーワード規則で char→傘）。`kanji.json` の `meaning` 英語を規則マッチ（例: sun/moon/water/fire/mountain/river/rain→nature; up/down/left/right/north→position; person/man/woman/child/eye/hand/body→body; one..ten/year/time/now→numtime; go/come/see/eat/write/read→action; big/small/new/old/high/color→state; school/company/money/road→society; 残りは meaning から近い傘、判定不能は mind）。出力 `kanjiCategory.json`。
Run: `python 問題/tools/gen_categories.py kanji`

- [ ] **Step 2: 全件レビュー・手修正**（612字。生成JSONを開き、誤分類を直接修正。特に数字漢字→numtime、体の部位→body、色→state 等を確認）。

- [ ] **Step 3: Write coverage test** (`kanjiCategory.test.ts`)
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KANJI } from './index.ts';
import { CAT_BY_ID } from './categories.ts';
import map from './kanjiCategory.json' assert { type: 'json' };
test('全漢字がちょうど1傘に属す・傘は漢字kind', () => {
  const m = map as Record<string, string>;
  for (const k of KANJI) {
    const cid = m[k.char];
    assert.ok(cid, `未割当: ${k.char}`);
    assert.equal(CAT_BY_ID[cid]?.kind, 'kanji', `無効傘: ${k.char}=${cid}`);
  }
});
```

- [ ] **Step 4: Run → PASS**（未割当0まで手修正を繰り返す）
Run: `cd app && node --import tsx --test src/data/kanjiCategory.test.ts`
Expected: PASS

- [ ] **Step 5: Register & commit**
`package.json` test に ` src/data/kanjiCategory.test.ts` 追加。
```bash
cd app && git add src/data/kanjiCategory.json src/data/kanjiCategory.test.ts package.json && git commit -m "feat(category): 漢字612字を8傘へ割当"
```

---

### Task 3: 語彙割当 `vocabCategory.json`（小テーマ・文法移管24除外）

**Files:**
- Create: `app/src/data/vocabCategory.json`
- Modify: `問題/tools/gen_categories.py`
- Test: `app/src/data/vocabCategory.test.ts`

**Interfaces:**
- Consumes: `CATS`(kind:'vocab') / Produces: `vocabCategory.json = { [vocabId]: subId }`（文法にある非自立24語は含めない）

- [ ] **Step 1: 移管24語リスト確定**（`～`付きで grammar.json の point に芯が含まれる語）。`gen_categories.py vocab` 内で判定し `EXCLUDE` セットに（お～/～がる/～くらい/～ころ/～中/～すぎ/～ずつ/～だけ/では/～など/～前/何～/～ございます/～しまう/～ばかり/～やすい/～まま/～よると/～ついて/～にくい/～代/～おき/～度）。助数詞（文法に無い～）は `counter` に割当。

- [ ] **Step 2: 一次生成**（規則: `meaning`英語＋`reading`＋`tags` で小テーマ推定。例: family/mother/father→family; eat/drink/food語→food; go/come/walk→move; big/small/color→size|color; happy/sad→emotion; 副詞tags→adverb; 助数詞(～)→counter）。曖昧語は暫定 `abstract`。
Run: `python 問題/tools/gen_categories.py vocab`

- [ ] **Step 3: 曖昧語の確定（束ねたSonnetエージェント少数）**。暫定`abstract`＋規則低信頼の語だけ抽出し、**数個の大きめエージェント**にバッチ（1エージェント数百語・`args`で語リスト＋小テーマ定義を渡し、id→subId のJSONを返させる。read専用エージェント禁止・自己検証）。返却をマージ。

- [ ] **Step 4: Write coverage test** (`vocabCategory.test.ts`)
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VOCAB } from './index.ts';
import { CAT_BY_ID } from './categories.ts';
import map from './vocabCategory.json' assert { type: 'json' };
const EXCLUDE = new Set(['n5-v-96','n5-v-181','n5-v-227','n5-v-269','n5-v-315','n5-v-332','n5-v-337','n5-v-380','n5-v-433','n5-v-486','n5-v-622','n5-v-495','n4-v-43','n4-v-188','n4-v-249','n4-v-387','n4-v-441','n4-v-444','n4-v-588','n4-v-643','n4-v-514','n4-v-528','n5-v-409','n5-v-443']);
test('移管24除く全語がちょうど1小テーマ(kind vocab)に属す', () => {
  const m = map as Record<string, string>;
  for (const v of VOCAB) {
    if (EXCLUDE.has(v.id)) { assert.ok(!m[v.id], `移管語が割当済: ${v.id}`); continue; }
    const cid = m[v.id];
    assert.ok(cid, `未割当: ${v.id} ${v.word}`);
    assert.equal(CAT_BY_ID[cid]?.kind, 'vocab', `無効小テーマ: ${v.id}=${cid}`);
  }
});
```

- [ ] **Step 5: Run → PASS**（未割当0・移管語は未割当のまま＝表示から除外）
Run: `cd app && node --import tsx --test src/data/vocabCategory.test.ts`
Expected: PASS

- [ ] **Step 6: Register & commit**
```bash
cd app && git add src/data/vocabCategory.json src/data/vocabCategory.test.ts package.json && git commit -m "feat(category): 語彙を小テーマ割当・非自立24語は文法移管"
```

---

### Task 4: 文法割当 `grammarCategory.json`（機能11）

**Files:**
- Create: `app/src/data/grammarCategory.json`
- Test: `app/src/data/grammarCategory.test.ts`

**Interfaces:**
- Produces: `grammarCategory.json = { [grammarId]: funcId }` 全点

- [ ] **Step 1: 一次生成＋全件レビュー**（393点。`point`/`romaji`/`meaning` の規則で機能推定→手修正。て形/た形/可能/受身/使役→verbform; 助詞→particle; から/ので/ために→reason; ば/たら/なら→condition; てください/てもいい→request; より/ほど/すぎる→degree; そうだ/ようだ/らしい→evidential; お/ご/ございます→keigo; ～中/～がる等の接尾→suffix; 残り→pattern）。移管24語の～はここ suffix/該当機能へ。
Run: `python 問題/tools/gen_categories.py grammar`

- [ ] **Step 2: Write coverage test** (`grammarCategory.test.ts`)
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR } from './index.ts';
import { CAT_BY_ID } from './categories.ts';
import map from './grammarCategory.json' assert { type: 'json' };
test('全文法点がちょうど1機能(kind grammar)に属す', () => {
  const m = map as Record<string, string>;
  for (const g of GRAMMAR) {
    const cid = m[g.id];
    assert.ok(cid, `未割当: ${g.id}`);
    assert.equal(CAT_BY_ID[cid]?.kind, 'grammar', `無効機能: ${g.id}=${cid}`);
  }
});
```

- [ ] **Step 3: Run → PASS**
Run: `cd app && node --import tsx --test src/data/grammarCategory.test.ts`
Expected: PASS

- [ ] **Step 4: Register & commit**
```bash
cd app && git add src/data/grammarCategory.json src/data/grammarCategory.test.ts package.json && git commit -m "feat(category): 文法393点を機能別へ割当"
```

---

### Task 5: 単語タブ SectionList 化（study時）

**Files:**
- Modify: `app/src/screens/BrowseScreen.tsx`
- Create: `app/src/words/sections.ts`（区分→(items→CatSection[])の橋渡し）
- Test: `app/src/words/sections.test.ts`

**Interfaces:**
- Consumes: `groupByCategory`, `kanjiCategory.json`, `vocabCategory.json`, `grammarCategory.json`
- Produces: `function studySections(kubun: Kubun, items: StudyItem[]): CatSection<StudyItem>[]`

- [ ] **Step 1: Write failing test** (`sections.test.ts`)
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studySections } from './sections.ts';
import { levelListFor } from './levelList.ts';
test('kanji N5: セクションが返り全itemが含まれ順序はtaxonomy', () => {
  const items = levelListFor('kanji', 'N5');
  const secs = studySections('kanji', items);
  assert.ok(secs.length > 0);
  const flat = secs.flatMap((s) => s.data);
  assert.equal(flat.length, items.length); // 漏れなし
});
```

- [ ] **Step 2: Run → FAIL**
Run: `cd app && node --import tsx --test src/words/sections.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `sections.ts`**
```ts
import { groupByCategory, type CatSection } from './groupByCategory';
import type { StudyItem } from '../data';
import type { Kubun } from './levelList';
import kanjiCat from '../data/kanjiCategory.json';
import vocabCat from '../data/vocabCategory.json';
import grammarCat from '../data/grammarCategory.json';
export function studySections(kubun: Kubun, items: StudyItem[]): CatSection<StudyItem>[] {
  if (kubun === 'kanji')
    return groupByCategory(items, kanjiCat as Record<string,string>, (i) => (i as { char: string }).char, 'kanji');
  if (kubun === 'grammar')
    return groupByCategory(items, grammarCat as Record<string,string>, (i) => i.id, 'grammar');
  return groupByCategory(items, vocabCat as Record<string,string>, (i) => i.id, 'vocab');
}
```

- [ ] **Step 4: Run → PASS**
Run: `cd app && node --import tsx --test src/words/sections.test.ts`
Expected: PASS

- [ ] **Step 5: BrowseScreen を study時 SectionList に**。`import { SectionList } from 'react-native'` 追加。study時は `studySections(kubun, results)` を `sections={...}` に渡し、`renderItem`は既存流用、`renderSectionHeader={({section}) => <Text style={s.catHeader}>{section.label}</Text>}`。語彙は umbrella 副見出しも出す（`section.umbrella` があれば `CAT_BY_ID[section.umbrella].label` を小さく上に）。非study(dict/検索)時は既存 `FlatList` を維持（分岐）。`catHeader` スタイルを `StyleSheet` に追加。
```tsx
// results/study 分岐内
{study ? (
  <SectionList
    sections={studySections(kubun, results).map((s) => ({ ...s, key: s.catId }))}
    keyExtractor={(item) => item.id}
    renderItem={renderItem}
    renderSectionHeader={({ section }) => (
      <View style={s.catHeaderWrap}>
        {section.umbrella ? <Text style={s.catUmbrella}>{CAT_BY_ID[section.umbrella!].label}</Text> : null}
        <Text style={s.catHeader}>{section.label}</Text>
      </View>
    )}
    stickySectionHeadersEnabled={false}
  />
) : (
  <FlatList /* 既存のまま */ />
)}
```

- [ ] **Step 6: tsc＋全テスト**
Run: `cd app && npx tsc --noEmit && npm test`
Expected: tsc緑・全テストPASS

- [ ] **Step 7: Register & commit**
```bash
cd app && git add src/words/sections.ts src/words/sections.test.ts src/screens/BrowseScreen.tsx package.json && git commit -m "feat(category): 単語タブをカテゴリ別SectionList表示に"
```

---

### Task 6: 漢数字の数え方 例単語＋音声

**Files:**
- Modify: `app/src/data/kanjiCardReadings.json`
- Create: `問題/tools/build_number_audio.py`（git外）
- Modify: `app/src/data/kanjiDrillReps.json`（数字は「数」読み）

**Interfaces:**
- Consumes: 既存 `kanjiCardReadings`（char→例語配列）/ `vocabAudio.playKanjiRep`, `vocabAudioUrl`

- [ ] **Step 1: 数え方データ定義**（Python辞書）。各数字漢字に例語追加:
```
一: [(一,いち),(一つ,ひとつ),(一日,ついたち),(一個,いっこ)]
二: [(二,に),(二つ,ふたつ),(二日,ふつか),(二個,にこ)] … 十まで。
四=よん, 七=なな, 九=きゅう。日: よっか/ようか/むいか等。個: いっこ/ろっこ/はっこ/じゅっこ。
特殊日: 十四=じゅうよっか(十の例), 二十=はつか(十/二の例), 二十四=にじゅうよっか。
```
`kanjiCardReadings.json` の該当charへ、重複しない例語を追記（既存例は残す）。

- [ ] **Step 2: 未生成読みの音声生成**（`build_number_audio.py`）。各例語 `word|reading` が vocab に無い/mp3無い読みのみ、かな送信で `app/assets/audio/kanji/<char or key>.mp3` 生成（`build_kanji_audio.py`同方式・-20dBFS）。詳細カードは `vocabIdForWord`→mp3／無ければ `playKanjiRep`／TTSフォールバックの既存経路で鳴る。
Run: `python 問題/tools/build_number_audio.py`（生成本数・カバレッジを出力）

- [ ] **Step 3: `kanjiDrillReps.json` の数字を「数」読みに**（一→(一,いち)…五→(五,ご)…十→(十,じゅう)、四=よん維持）。ドリル代表音が数の読みになるよう該当charを修正。

- [ ] **Step 4: 実行時検証**（`node`でkanjiCardReadingsを走査しnullガード・重複無しを確認）。
```bash
cd app && node --input-type=module -e "import fs from 'fs'; const d=JSON.parse(fs.readFileSync('src/data/kanjiCardReadings.json')); for(const c of ['一','二','三','四','五','六','七','八','九','十']){ const ex=d[c]||[]; if(!ex.length) throw new Error('例なし '+c); } console.log('OK number examples');"
```
Expected: `OK number examples`

- [ ] **Step 5: tsc＋テスト＋commit**（音声mp3も同梱・Pages配信）
Run: `cd app && npx tsc --noEmit && npm test`
```bash
cd app && git add src/data/kanjiCardReadings.json src/data/kanjiDrillReps.json assets/audio/kanji && git commit -m "feat(kanji): 漢数字に数え方(数/日/つ/個)の例と音声"
```

---

## Self-Review
- **Spec coverage**: §1漢字=Task2 / §2語彙小テーマ=Task3 / §3文法機能=Task4 / §4データモデル=Task1-4 / §5割当方法=Task2-4 / §6数え方=Task6 / §7UI=Task5 / §8テスト=各Taskのcoverageテスト。網羅。
- **Placeholder**: なし（各Taskに実コード・実コマンド）。
- **Type一貫**: `Cat`/`CatSection`/`groupByCategory`/`studySections` はTask1定義をTask5が参照、型名一致。割当JSONの値域は全て `CAT_BY_ID[...].kind` で検証。
- 語彙割当(Task3)はエージェント使用＝CLAUDE.md#9準拠（束ねた少数・read専用禁止・自己検証）。
