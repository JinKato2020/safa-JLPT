# 問題コンテンツ ファイル整理(計画1: 新フォーマット生成＋検証) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の問題バンク(複数大問同居・neのみ・全バンドル)を、大問×レベルで分割し1問に全言語をinlineした新フォーマットへ変換する移行・検証ツールを作り、検証済みの `app/content/` ツリー＋manifest＋READMEを生成する。アプリ実行時コードは変更しない。

**Architecture:** `tools/content/` に純関数のスキーマ定数・manifest計算・検証・移行を実装。移行は既存JSONを読んで新スキーマ(1問=言語非依存フィールド＋`i18n.<lang>`)へ変換し、大問×レベルの英数字名ファイルへ書き出す。既存neの訳(`explainNe`/`reasonNe`/`meaningL10n`/`passageTransNe`)は `i18n.ne`/`i18n.ja` へ移設(作り直さない)。全処理をnodeで実行しテストで件数・整合を実証する。

**Tech Stack:** TypeScript(tsx で node 実行)、node:test、node:crypto(sha256)、node:fs。RN/expo は触らない。

## Global Constraints

- **言語コード**: `ja` と `ne` のみ実データあり。他8言語は空(箱だけ)。想定言語 ≈ 10。言語リストの正: `['ja','ne','vi','en','zh','ko','th','id','bn','my']`(= i18n の既存11ロケールから `ja` 以外UI専用を除いた実運用順。実装時に `src/i18n` のロケール一覧と突き合わせる)。
- **ファイル名は英数字のみ**(日本語をパス/URLに載せない)。日本語の大問名は manifest の `daimonLabels` と各フォルダ `README.md` にのみ置く。
- **既存idを維持**(`kr:`/`cx:`/`sy:`/`og:`/`kb-`/読解聴解のscript id)。訳はidで紐づく。
- **既存neを流用**(再翻訳しない)。移行は情報を失わない(件数・フィールドが往復一致)。
- **出力先**: `app/content/`(計画2でPages公開・ローダ切替に使用)。
- **検証は node で実データ実行**([verify-runtime-not-just-build] — 型/ビルド緑だけで満足しない)。
- テスト実行: `cd app && node --import tsx --test <file>`。`package.json` の `test` スクリプト末尾に新テストを追記する。
- 翻訳の実生成(ja/ne 以外を埋める)は**本計画のスコープ外**(別途・有料・要見積り承認)。

---

## 大問→ファイル/フィールド対応(実装の基礎データ)

移行はこの表を単一の定義(`DAIMON_SPEC`)にして駆動する。

| daimon | 出力ファイル接頭辞 | フォルダ | 元ファイル | 言語非依存フィールド | i18n化(訳)するフィールド | 既存ne由来 |
|---|---|---|---|---|---|---|
| kanji_read | `kanji_read` | moji_goi | exam/kanjiReadingBank.json | sentence,underline,answer,choices | (explain 無し・空i18n) | なし |
| orthography | `orthography` | moji_goi | exam/orthographyBank.json | sentence,underline,answer,choices | explain | explainNe→ne |
| context | `context` | moji_goi | exam/contextBank.json | prompt,question,answer,choices | explain | explainNe→ne |
| synonym | `synonym` | moji_goi | exam/synonymBank.json | sentence,underline,word,answer,choices | explain(元reason) | reasonNe→ne |
| usage | `usage` | moji_goi | exam/knowledgeBank.json(daimon=usage) | stem,question,answer,choices | explain(将来) | なし |
| grammar_form | `grammar_form` | bunpou | exam/knowledgeBank.json(grammar_form) | stem,question,answer,choices | explain(将来) | なし |
| order | `order` | bunpou | exam/knowledgeBank.json(order・ambiguous除外) | stem,question,answer,choices | explain(将来) | なし |
| passage_grammar | `passage_grammar` | bunpou | exam/passageGrammar.json | passages,questions | (item)explain 将来 | なし |
| naiyou_tan/chu/cho・joho | subtypeごと | dokkai | exam/reading.json(subtype×level) | title,body,questions(q,choices,answerIndex) | (item)body・(question)explain | passageTransNe→ne.body |
| kadai/point/gaiyou/hatsuwa/sokuji | subtypeごと | choukai | exam/listening.json(subtype×level) | title,audio,audioChoices,script,questions | (item)script・(question)explain | なし |

- JA解説も言語であり `i18n.ja.explain` に入れる(トップレベルには置かない)。
- 読解subtypeファイル名: `naiyou_tan` / `naiyou_chu` / `naiyou_cho` / `joho`。聴解: `kadai` / `point` / `gaiyou` / `hatsuwa` / `sokuji`。
- lexicon: `meaning`(meaningL10n)・`example`(exampleL10n)を id の級(id接頭辞 n5/n4/n3)で分割。

---

## Task 1: スキーマ定数モジュール

**Files:**
- Create: `app/tools/content/schema.ts`

**Interfaces:**
- Produces:
  - `const LANGS: string[]`(全言語順)
  - `const DAIMON_SPEC: DaimonSpec[]` 各要素 `{ daimon, prefix, folder, source, neutral: string[], translate: string[], neField?: string }`
  - `type ContentItem = { id: string; [k: string]: unknown; i18n: Record<string, Record<string, string>> }`
  - `type ContentFile = { schema: 1; daimon: string; level: string; languages: string[]; items: ContentItem[] }`
  - `type LexiconFile = { schema: 1; kind: 'meaning'|'example'; level: string; languages: string[]; items: Record<string, Record<string,string>> }`
  - `type Manifest = { schema: 1; contentVersion: string; languages: string[]; daimonLabels: Record<string,string>; files: Record<string, { sha256: string; bytes: number; count: number }> }`
  - `const DAIMON_LABELS: Record<string,string>`(daimon→日本語大問名)

- [ ] **Step 1: 定数とtypeを書く**

```ts
// app/tools/content/schema.ts — 新コンテンツ形式のスキーマ定数(移行/検証/manifestで共有)。
export const LANGS = ['ja', 'ne', 'vi', 'en', 'zh', 'ko', 'th', 'id', 'bn', 'my'] as const;
export type Lang = (typeof LANGS)[number];

export type ContentItem = { id: string; i18n: Record<string, Record<string, string>>; [k: string]: unknown };
export type ContentFile = { schema: 1; daimon: string; level: string; languages: string[]; items: ContentItem[] };
export type LexiconFile = { schema: 1; kind: 'meaning' | 'example'; level: string; languages: string[]; items: Record<string, Record<string, string>> };
export type ManifestEntry = { sha256: string; bytes: number; count: number };
export type Manifest = { schema: 1; contentVersion: string; languages: string[]; daimonLabels: Record<string, string>; files: Record<string, ManifestEntry> };

export const DAIMON_LABELS: Record<string, string> = {
  kanji_read: '大問1 漢字読み', orthography: '大問2 表記', context: '大問3 文脈規定', synonym: '大問4 言い換え類義', usage: '大問5 用法',
  grammar_form: '文法・大問1 文法形式判断', order: '文法・大問2 文の組み立て', passage_grammar: '文法・大問3 文章の文法',
  naiyou_tan: '読解 内容理解(短)', naiyou_chu: '読解 内容理解(中)', naiyou_cho: '読解 内容理解(長)', joho: '読解 情報検索',
  kadai: '聴解 課題理解', point: '聴解 ポイント理解', gaiyou: '聴解 概要理解', hatsuwa: '聴解 発話表現', sokuji: '聴解 即時応答',
};

export type DaimonSpec = { daimon: string; prefix: string; folder: 'moji_goi' | 'bunpou'; neutral: string[]; translate: string[]; neField?: string };
// 文字語彙・文法(単票バンク系)。読解/聴解/文章の文法はネスト構造のため個別処理(migrate側)。
export const DAIMON_SPEC: DaimonSpec[] = [
  { daimon: 'kanji_read', prefix: 'kanji_read', folder: 'moji_goi', neutral: ['sentence', 'underline', 'answer', 'choices'], translate: [] },
  { daimon: 'orthography', prefix: 'orthography', folder: 'moji_goi', neutral: ['sentence', 'underline', 'answer', 'choices'], translate: ['explain'], neField: 'explainNe' },
  { daimon: 'context', prefix: 'context', folder: 'moji_goi', neutral: ['prompt', 'question', 'answer', 'choices'], translate: ['explain'], neField: 'explainNe' },
  { daimon: 'synonym', prefix: 'synonym', folder: 'moji_goi', neutral: ['sentence', 'underline', 'word', 'answer', 'choices'], translate: ['explain'], neField: 'reasonNe' },
  { daimon: 'usage', prefix: 'usage', folder: 'moji_goi', neutral: ['stem', 'question', 'answer', 'choices'], translate: ['explain'] },
  { daimon: 'grammar_form', prefix: 'grammar_form', folder: 'bunpou', neutral: ['stem', 'question', 'answer', 'choices'], translate: ['explain'] },
  { daimon: 'order', prefix: 'order', folder: 'bunpou', neutral: ['stem', 'question', 'answer', 'choices'], translate: ['explain'] },
];
```

- [ ] **Step 2: 構文確認(tsx で import できる)**

Run: `cd app && node --import tsx -e "import('./tools/content/schema.ts').then(m=>console.log(m.LANGS.length, m.DAIMON_SPEC.length))"`
Expected: `10 7`

- [ ] **Step 3: Commit**

```bash
cd app && git add tools/content/schema.ts && git commit -m "feat(content): 新コンテンツ形式のスキーマ定数"
```

---

## Task 2: manifest ビルダー(sha256)

**Files:**
- Create: `app/tools/content/manifest.ts`
- Test: `app/tools/content/manifest.test.ts`

**Interfaces:**
- Consumes: `Manifest`, `ManifestEntry`, `DAIMON_LABELS`, `LANGS` from `schema.ts`
- Produces:
  - `fileEntry(text: string, count: number): ManifestEntry` — sha256/bytes/count を計算
  - `buildManifest(files: Record<string, { text: string; count: number }>, contentVersion: string): Manifest`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// app/tools/content/manifest.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileEntry, buildManifest } from './manifest.ts';

test('fileEntry: sha256/bytes/count', () => {
  const e = fileEntry('abc', 2);
  assert.equal(e.bytes, 3);
  assert.equal(e.count, 2);
  assert.equal(e.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); // sha256("abc")
});
test('buildManifest: files と daimonLabels を含む', () => {
  const m = buildManifest({ 'problems/moji_goi/context_N4.json': { text: 'abc', count: 5 } }, '2026-07-14T00:00:00Z');
  assert.equal(m.schema, 1);
  assert.equal(m.files['problems/moji_goi/context_N4.json'].count, 5);
  assert.equal(m.daimonLabels.context, '大問3 文脈規定');
  assert.ok(m.languages.includes('ne'));
});
```

- [ ] **Step 2: 失敗を確認**

Run: `cd app && node --import tsx --test tools/content/manifest.test.ts`
Expected: FAIL(`Cannot find module './manifest.ts'`)

- [ ] **Step 3: 実装**

```ts
// app/tools/content/manifest.ts — manifest(各ファイルのsha256/件数・大問ラベル)を組み立てる純関数。
import { createHash } from 'node:crypto';
import { DAIMON_LABELS, LANGS, type Manifest, type ManifestEntry } from './schema.ts';

export function fileEntry(text: string, count: number): ManifestEntry {
  return { sha256: createHash('sha256').update(text, 'utf8').digest('hex'), bytes: Buffer.byteLength(text, 'utf8'), count };
}
export function buildManifest(files: Record<string, { text: string; count: number }>, contentVersion: string): Manifest {
  const out: Manifest['files'] = {};
  for (const [path, { text, count }] of Object.entries(files)) out[path] = fileEntry(text, count);
  return { schema: 1, contentVersion, languages: [...LANGS], daimonLabels: DAIMON_LABELS, files: out };
}
```

- [ ] **Step 4: パス確認**

Run: `cd app && node --import tsx --test tools/content/manifest.test.ts`
Expected: PASS(2 tests)

- [ ] **Step 5: Commit**

```bash
cd app && git add tools/content/manifest.ts tools/content/manifest.test.ts && git commit -m "feat(content): manifestビルダー(sha256)"
```

---

## Task 3: 検証関数

**Files:**
- Create: `app/tools/content/validate.ts`
- Test: `app/tools/content/validate.test.ts`

**Interfaces:**
- Consumes: `ContentFile`, `LexiconFile`, `Manifest` from `schema.ts`; `fileEntry` from `manifest.ts`
- Produces:
  - `checkIdsUnique(files: ContentFile[]): string[]` — 重複idを返す(空=OK)
  - `checkLangCompleteness(file: ContentFile, requiredLangs: string[]): string[]` — 訳が欠けた `id#lang#field` を返す。`translate` が空の大問はスキップ。
  - `checkManifest(manifest: Manifest, actual: Record<string, { text: string; count: number }>): string[]` — sha256/count不一致を返す
  - `checkOrphanLexicon(lex: LexiconFile, validIds: Set<string>): string[]` — 対応idなしのlexiconキーを返す

- [ ] **Step 1: 失敗するテストを書く**

```ts
// app/tools/content/validate.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkIdsUnique, checkLangCompleteness, checkManifest, checkOrphanLexicon } from './validate.ts';
import type { ContentFile, LexiconFile, Manifest } from './schema.ts';

const f = (daimon: string, level: string, items: any[]): ContentFile => ({ schema: 1, daimon, level, languages: ['ja', 'ne'], items });

test('checkIdsUnique: 重複を検出', () => {
  const a = f('context', 'N4', [{ id: 'x', i18n: {} }]);
  const b = f('context', 'N5', [{ id: 'x', i18n: {} }]);
  assert.deepEqual(checkIdsUnique([a, b]), ['x']);
  assert.deepEqual(checkIdsUnique([a]), []);
});
test('checkLangCompleteness: 欠けた訳を列挙', () => {
  const file = { ...f('context', 'N4', [{ id: 'x', i18n: { ja: { explain: 'a' } } }]), languages: ['ja', 'ne'] } as ContentFile;
  const miss = checkLangCompleteness(file, ['ja', 'ne']);
  assert.deepEqual(miss, ['x#ne#explain']);
});
test('checkLangCompleteness: translate空の大問はスキップ', () => {
  const file = f('kanji_read', 'N5', [{ id: 'k', i18n: {} }]);
  assert.deepEqual(checkLangCompleteness(file, ['ja', 'ne']), []);
});
test('checkManifest: sha256不一致を検出', () => {
  const m: Manifest = { schema: 1, contentVersion: 't', languages: [], daimonLabels: {}, files: { 'a.json': { sha256: 'bad', bytes: 3, count: 1 } } };
  const errs = checkManifest(m, { 'a.json': { text: 'abc', count: 1 } });
  assert.equal(errs.length, 1);
});
test('checkOrphanLexicon: 対応idなしを検出', () => {
  const lex: LexiconFile = { schema: 1, kind: 'meaning', level: 'N4', languages: ['ne'], items: { 'n4-v-1': { ne: 'x' }, 'n4-v-999': { ne: 'y' } } };
  assert.deepEqual(checkOrphanLexicon(lex, new Set(['n4-v-1'])), ['n4-v-999']);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `cd app && node --import tsx --test tools/content/validate.test.ts`
Expected: FAIL(module not found)

- [ ] **Step 3: 実装**

```ts
// app/tools/content/validate.ts — 新コンテンツの整合チェック(id一意・訳完全性・manifest一致・孤児lexicon)。
import { DAIMON_SPEC, type ContentFile, type LexiconFile, type Manifest } from './schema.ts';
import { fileEntry } from './manifest.ts';

const translateFieldsOf = (daimon: string): string[] =>
  DAIMON_SPEC.find((d) => d.daimon === daimon)?.translate
  ?? (['naiyou_tan', 'naiyou_chu', 'naiyou_cho', 'joho', 'kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji', 'passage_grammar'].includes(daimon) ? ['explain'] : []);

export function checkIdsUnique(files: ContentFile[]): string[] {
  const seen = new Set<string>(); const dup = new Set<string>();
  for (const f of files) for (const it of f.items) { if (seen.has(it.id)) dup.add(it.id); seen.add(it.id); }
  return [...dup];
}
export function checkLangCompleteness(file: ContentFile, requiredLangs: string[]): string[] {
  const fields = translateFieldsOf(file.daimon);
  if (!fields.length) return [];
  const miss: string[] = [];
  for (const it of file.items) for (const lang of requiredLangs) for (const fld of fields) {
    if (!it.i18n?.[lang]?.[fld]) miss.push(`${it.id}#${lang}#${fld}`);
  }
  return miss;
}
export function checkManifest(manifest: Manifest, actual: Record<string, { text: string; count: number }>): string[] {
  const errs: string[] = [];
  for (const [path, { text, count }] of Object.entries(actual)) {
    const want = manifest.files[path];
    const got = fileEntry(text, count);
    if (!want) { errs.push(`missing:${path}`); continue; }
    if (want.sha256 !== got.sha256) errs.push(`sha:${path}`);
    if (want.count !== got.count) errs.push(`count:${path}`);
  }
  return errs;
}
export function checkOrphanLexicon(lex: LexiconFile, validIds: Set<string>): string[] {
  return Object.keys(lex.items).filter((k) => !validIds.has(k));
}
```

- [ ] **Step 4: パス確認**

Run: `cd app && node --import tsx --test tools/content/validate.test.ts`
Expected: PASS(5 tests)

- [ ] **Step 5: Commit**

```bash
cd app && git add tools/content/validate.ts tools/content/validate.test.ts && git commit -m "feat(content): 検証関数(id/訳/manifest/孤児)"
```

---

## Task 4: 問題の変換(文字語彙・文法の単票バンク)

**Files:**
- Create: `app/tools/content/migrate_problems.ts`
- Test: `app/tools/content/migrate_problems.test.ts`

**Interfaces:**
- Consumes: `DAIMON_SPEC`, `ContentItem`, `ContentFile` from `schema.ts`
- Produces:
  - `toItem(raw: Record<string, unknown>, spec: DaimonSpec): ContentItem` — 1問を新形式へ。neutralをコピー、`i18n.ja[field]=raw[field]`、`neField` があれば `i18n.ne[field]=raw[neField]`(空/欠けは入れない)。
  - `groupToFiles(raw: Record<string,unknown>[], spec: DaimonSpec): ContentFile[]` — level別に分けて ContentFile 配列。synonymは元 `reason`→`explain` に読み替え。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// app/tools/content/migrate_problems.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toItem, groupToFiles } from './migrate_problems.ts';
import { DAIMON_SPEC } from './schema.ts';

const ctxSpec = DAIMON_SPEC.find((d) => d.daimon === 'context')!;
const synSpec = DAIMON_SPEC.find((d) => d.daimon === 'synonym')!;

test('toItem: neutralコピー＋ja/ne explain', () => {
  const it = toItem({ id: 'cx:n4-v-1', level: 'N4', prompt: 'p', question: 'q', answer: 'a', choices: ['a', 'b', 'c'], explain: 'J', explainNe: 'N' }, ctxSpec);
  assert.equal(it.id, 'cx:n4-v-1');
  assert.equal(it.prompt, 'p');
  assert.equal(it.i18n.ja.explain, 'J');
  assert.equal(it.i18n.ne.explain, 'N');
  assert.equal((it as any).explain, undefined); // トップにexplainを残さない
});
test('toItem: synonym は reason→explain', () => {
  const it = toItem({ id: 'sy:n5-v-1', level: 'N5', sentence: 's', underline: 'u', word: 'w', answer: 'a', choices: ['a', 'b'], reason: 'J', reasonNe: 'N' }, synSpec);
  assert.equal(it.i18n.ja.explain, 'J');
  assert.equal(it.i18n.ne.explain, 'N');
});
test('groupToFiles: level別に分割・件数保持', () => {
  const raw = [{ id: 'cx:n4-v-1', level: 'N4', prompt: 'p', question: 'q', answer: 'a', choices: ['a'], explain: 'x', explainNe: 'y' },
    { id: 'cx:n5-v-1', level: 'N5', prompt: 'p', question: 'q', answer: 'a', choices: ['a'], explain: 'x', explainNe: 'y' }];
  const files = groupToFiles(raw, ctxSpec);
  assert.equal(files.length, 2);
  assert.deepEqual(files.map((f) => f.level).sort(), ['N4', 'N5']);
  assert.equal(files.find((f) => f.level === 'N4')!.items.length, 1);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `cd app && node --import tsx --test tools/content/migrate_problems.test.ts`
Expected: FAIL(module not found)

- [ ] **Step 3: 実装**

```ts
// app/tools/content/migrate_problems.ts — 単票バンク(文字語彙・文法)を新形式(言語非依存＋i18n)へ変換。
import { type ContentFile, type ContentItem, type DaimonSpec } from './schema.ts';

export function toItem(raw: Record<string, unknown>, spec: DaimonSpec): ContentItem {
  const item: ContentItem = { id: String(raw.id), i18n: {} };
  for (const k of spec.neutral) if (raw[k] !== undefined) item[k] = raw[k];
  // JA解説(synonymは元 reason)。空文字は入れない。
  const jaField = spec.daimon === 'synonym' ? 'reason' : 'explain';
  for (const outField of spec.translate) {
    const ja = raw[jaField];
    if (typeof ja === 'string' && ja) (item.i18n.ja ??= {})[outField] = ja;
    const neKey = spec.neField;
    const ne = neKey ? raw[neKey] : undefined;
    if (typeof ne === 'string' && ne) (item.i18n.ne ??= {})[outField] = ne;
  }
  return item;
}
export function groupToFiles(raw: Record<string, unknown>[], spec: DaimonSpec): ContentFile[] {
  const byLevel = new Map<string, ContentItem[]>();
  for (const r of raw) { const lv = String(r.level); (byLevel.get(lv) ?? byLevel.set(lv, []).get(lv)!).push(toItem(r, spec)); }
  return [...byLevel.entries()].map(([level, items]) => ({ schema: 1, daimon: spec.daimon, level, languages: ['ja', 'ne'], items }));
}
```

- [ ] **Step 4: パス確認**

Run: `cd app && node --import tsx --test tools/content/migrate_problems.test.ts`
Expected: PASS(3 tests)

- [ ] **Step 5: Commit**

```bash
cd app && git add tools/content/migrate_problems.ts tools/content/migrate_problems.test.ts && git commit -m "feat(content): 単票バンクの新形式変換"
```

---

## Task 5: 読解・聴解・knowledgeBank・passageGrammar・lexicon の変換

**Files:**
- Create: `app/tools/content/migrate_nested.ts`
- Test: `app/tools/content/migrate_nested.test.ts`

**Interfaces:**
- Consumes: `ContentFile`, `LexiconFile` from `schema.ts`
- Produces:
  - `splitKnowledgeBank(kb: any[]): ContentFile[]` — daimon(usage/grammar_form/order)×level に分割。order は `ambiguous:true` を除外。passage_grammar は含めない(別ファイル passageGrammar.json 由来)。
  - `readingToFiles(reading: any[], passageTransNe: Record<string,string>): ContentFile[]` — subtype×level。item に `i18n.ne.body`(passageTransNe に訳があれば)、各 question の `explain`(JA)を `question.i18n.ja.explain` へ。
  - `listeningToFiles(listening: any[]): ContentFile[]` — subtype×level。question.explain→`i18n.ja.explain`。
  - `lexiconToFiles(l10n: Record<string,Record<string,string>>, kind: 'meaning'|'example'): LexiconFile[]` — id接頭辞(n5/n4/n3)で級分割。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// app/tools/content/migrate_nested.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitKnowledgeBank, readingToFiles, listeningToFiles, lexiconToFiles } from './migrate_nested.ts';

test('splitKnowledgeBank: daimon×level・order ambiguous除外', () => {
  const kb = [
    { id: 'kb-1', level: 'N4', daimon: 'usage', stem: 's', question: 'q', answer: 'a', choices: ['a'] },
    { id: 'kb-2', level: 'N4', daimon: 'order', stem: 's', question: 'q', answer: 'a', choices: ['a'] },
    { id: 'kb-3', level: 'N4', daimon: 'order', ambiguous: true, stem: 's', question: 'q', answer: 'a', choices: ['a'] },
    { id: 'kb-4', level: 'N4', daimon: 'passage_grammar', stem: 's', question: 'q', answer: 'a', choices: ['a'] },
  ];
  const files = splitKnowledgeBank(kb);
  const usage = files.find((f) => f.daimon === 'usage' && f.level === 'N4')!;
  const order = files.find((f) => f.daimon === 'order' && f.level === 'N4')!;
  assert.equal(usage.items.length, 1);
  assert.equal(order.items.length, 1); // ambiguous除外
  assert.ok(!files.some((f) => f.daimon === 'passage_grammar')); // 含めない
});
test('readingToFiles: body訳＋question explain', () => {
  const reading = [{ id: 'r-N4-tan-1', level: 'N4', subtype: 'naiyou_tan', title: 't', body: 'B', questions: [{ id: 'q1', q: 'Q', choices: ['a', 'b'], answerIndex: 0, explain: 'E' }] }];
  const files = readingToFiles(reading, { 'r-N4-tan-1': 'BODY_NE' });
  const f = files[0];
  assert.equal(f.daimon, 'naiyou_tan');
  assert.equal(f.items[0].i18n.ne.body, 'BODY_NE');
  assert.equal((f.items[0] as any).questions[0].i18n.ja.explain, 'E');
});
test('lexiconToFiles: id接頭辞で級分割', () => {
  const files = lexiconToFiles({ 'n4-v-1': { ne: 'x' }, 'n5-v-2': { ne: 'y' } }, 'meaning');
  assert.equal(files.length, 2);
  assert.ok(files.every((f) => f.kind === 'meaning'));
});
```

- [ ] **Step 2: 失敗を確認**

Run: `cd app && node --import tsx --test tools/content/migrate_nested.test.ts`
Expected: FAIL(module not found)

- [ ] **Step 3: 実装**

```ts
// app/tools/content/migrate_nested.ts — ネスト構造(読解/聴解/knowledgeBank/lexicon)の新形式変換。
import { type ContentFile, type ContentItem, type LexiconFile } from './schema.ts';

const groupBy = <T>(rows: T[], key: (r: T) => string): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = key(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
  return m;
};
const levelOfId = (id: string): string => (id.match(/n([345])-/)?.[1] ? 'N' + id.match(/n([345])-/)![1] : 'N?');

export function splitKnowledgeBank(kb: any[]): ContentFile[] {
  const rows = kb.filter((x) => x.daimon !== 'passage_grammar').filter((x) => !(x.daimon === 'order' && x.ambiguous));
  const out: ContentFile[] = [];
  for (const [daimon, drows] of groupBy(rows, (r) => r.daimon)) {
    for (const [level, lrows] of groupBy(drows, (r) => r.level)) {
      const items: ContentItem[] = lrows.map((r) => ({ id: r.id, stem: r.stem, question: r.question, answer: r.answer, choices: r.choices, i18n: {} }));
      out.push({ schema: 1, daimon, level, languages: ['ja', 'ne'], items });
    }
  }
  return out;
}
export function readingToFiles(reading: any[], passageTransNe: Record<string, string>): ContentFile[] {
  const out: ContentFile[] = [];
  for (const [subtype, srows] of groupBy(reading, (r) => r.subtype)) {
    for (const [level, lrows] of groupBy(srows, (r) => r.level)) {
      const items: ContentItem[] = lrows.map((r) => {
        const i18n: ContentItem['i18n'] = {};
        if (passageTransNe[r.id]) i18n.ne = { body: passageTransNe[r.id] };
        const questions = (r.questions ?? []).map((q: any) => ({
          id: q.id, q: q.q, choices: q.choices, answerIndex: q.answerIndex,
          i18n: q.explain ? { ja: { explain: q.explain } } : {},
        }));
        return { id: r.id, title: r.title, body: r.body, questions, i18n };
      });
      out.push({ schema: 1, daimon: subtype, level, languages: ['ja', 'ne'], items });
    }
  }
  return out;
}
export function listeningToFiles(listening: any[]): ContentFile[] {
  const out: ContentFile[] = [];
  for (const [subtype, srows] of groupBy(listening, (r) => r.subtype)) {
    for (const [level, lrows] of groupBy(srows, (r) => r.level)) {
      const items: ContentItem[] = lrows.map((r) => ({
        id: r.id, title: r.title, script: r.script, audio: r.audio, audioChoices: r.audioChoices,
        questions: (r.questions ?? []).map((q: any) => ({ id: q.id, q: q.q, choices: q.choices, answerIndex: q.answerIndex, i18n: q.explain ? { ja: { explain: q.explain } } : {} })),
        i18n: {},
      }));
      out.push({ schema: 1, daimon: subtype, level, languages: ['ja', 'ne'], items });
    }
  }
  return out;
}
export function lexiconToFiles(l10n: Record<string, Record<string, string>>, kind: 'meaning' | 'example'): LexiconFile[] {
  const byLevel = groupBy(Object.entries(l10n), ([id]) => levelOfId(id));
  return [...byLevel.entries()].filter(([lv]) => lv !== 'N?').map(([level, entries]) => ({
    schema: 1, kind, level, languages: ['ne'], items: Object.fromEntries(entries),
  }));
}
```

- [ ] **Step 4: パス確認**

Run: `cd app && node --import tsx --test tools/content/migrate_nested.test.ts`
Expected: PASS(3 tests)

- [ ] **Step 5: Commit**

```bash
cd app && git add tools/content/migrate_nested.ts tools/content/migrate_nested.test.ts && git commit -m "feat(content): ネスト構造の新形式変換"
```

---

## Task 6: オーケストレータ(全変換→書き出し→manifest/README→検証)＋実行

**Files:**
- Create: `app/tools/content/build_content.ts`
- Create(生成物・実行で作られる): `app/content/**`(problems/lexicon/_manifest.json/README)
- Modify: `app/package.json`(testスクリプトに新テスト4本を追記)

**Interfaces:**
- Consumes: 全 Task の関数、`buildManifest`、`checkIdsUnique`/`checkLangCompleteness`/`checkManifest`/`checkOrphanLexicon`
- Produces: 実行可能スクリプト(引数 `--check` で書き出さず検証のみ)。標準出力に件数サマリ＋検証結果。

- [ ] **Step 1: オーケストレータを書く**

```ts
// app/tools/content/build_content.ts — 既存バンクを読み新content/ツリー＋manifest＋READMEを生成し検証する。
// 実行: cd app && node --import tsx tools/content/build_content.ts        (書き出し)
//       cd app && node --import tsx tools/content/build_content.ts --check (検証のみ)
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DAIMON_SPEC, DAIMON_LABELS, LANGS, type ContentFile, type LexiconFile } from './schema.ts';
import { groupToFiles } from './migrate_problems.ts';
import { splitKnowledgeBank, readingToFiles, listeningToFiles, lexiconToFiles } from './migrate_nested.ts';
import { buildManifest } from './manifest.ts';
import { checkIdsUnique, checkLangCompleteness, checkManifest, checkOrphanLexicon } from './validate.ts';

const R = (p: string) => JSON.parse(readFileSync(join('src/data', p), 'utf8'));
const OUT = 'content';
const write = (rel: string, obj: unknown, files: Record<string, { text: string; count: number }>, count: number) => {
  const text = JSON.stringify(obj);
  files[rel] = { text, count };
};

function main() {
  const checkOnly = process.argv.includes('--check');
  const files: Record<string, { text: string; count: number }> = {};
  const problemFiles: ContentFile[] = [];
  const lexFiles: LexiconFile[] = [];

  // 単票バンク(文字語彙・文法)
  const SRC: Record<string, string> = { kanji_read: 'exam/kanjiReadingBank.json', orthography: 'exam/orthographyBank.json', context: 'exam/contextBank.json', synonym: 'exam/synonymBank.json' };
  for (const spec of DAIMON_SPEC) {
    if (spec.daimon === 'usage' || spec.daimon === 'grammar_form' || spec.daimon === 'order') continue; // knowledgeBank由来は別処理
    for (const f of groupToFiles(R(SRC[spec.daimon]), spec)) problemFiles.push(f);
  }
  // knowledgeBank(usage/grammar_form/order)
  for (const f of splitKnowledgeBank(R('exam/knowledgeBank.json'))) problemFiles.push(f);
  // 読解・聴解
  for (const f of readingToFiles(R('exam/reading.json'), R('exam/passageTransNe.json'))) problemFiles.push(f);
  for (const f of listeningToFiles(R('exam/listening.json'))) problemFiles.push(f);
  // lexicon
  for (const f of lexiconToFiles(R('dict/meaningL10n.json'), 'meaning')) lexFiles.push(f);
  for (const f of lexiconToFiles(R('dict/exampleL10n.json'), 'example')) lexFiles.push(f);

  // ファイルパス割付
  const FOLDER: Record<string, string> = {};
  for (const s of DAIMON_SPEC) FOLDER[s.daimon] = s.folder;
  for (const d of ['usage']) FOLDER[d] = 'moji_goi';
  for (const d of ['grammar_form', 'order', 'passage_grammar']) FOLDER[d] = 'bunpou';
  for (const d of ['naiyou_tan', 'naiyou_chu', 'naiyou_cho', 'joho']) FOLDER[d] = 'dokkai';
  for (const d of ['kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji']) FOLDER[d] = 'choukai';

  for (const f of problemFiles) {
    const rel = `problems/${FOLDER[f.daimon]}/${f.daimon}_${f.level}.json`;
    write(rel, f, files, f.items.length);
  }
  for (const f of lexFiles) {
    const rel = `lexicon/${f.kind}_${f.level}.json`;
    write(rel, f, files, Object.keys(f.items).length);
  }

  // README(日本語対応表)
  const readme = ['# コンテンツ ファイル対応表', '', '| ファイル接頭辞 | 大問(日本語) |', '|---|---|',
    ...Object.entries(DAIMON_LABELS).map(([k, v]) => `| \`${k}\` | ${v} |`)].join('\n');
  files['README.md'] = { text: readme, count: 0 };

  // manifest(固定タイムスタンプは引数で。ここでは env か固定文字列)
  const contentVersion = process.env.CONTENT_VERSION ?? 'unset';
  const manifest = buildManifest(files, contentVersion);
  files['_manifest.json'] = { text: JSON.stringify(manifest), count: 0 };

  // 検証
  const errs: string[] = [];
  errs.push(...checkIdsUnique(problemFiles).map((x) => `dupId:${x}`));
  // ja/ne のみ必須(他8言語は箱だけ=未生成)。ja必須, ne は既存分のみなので completeness は ja だけ課す。
  for (const f of problemFiles) errs.push(...checkLangCompleteness(f, ['ja']));
  const validIds = new Set(problemFiles.flatMap((f) => f.items.map((i) => i.id.replace(/^[a-z]+:/, ''))));
  for (const f of lexFiles) errs.push(...checkOrphanLexicon(f, validIds).map((x) => `orphan:${f.kind}:${x}`));

  // 件数サマリ
  const summary = problemFiles.map((f) => `${f.daimon}_${f.level}=${f.items.length}`).join(' ');
  console.log('FILES', Object.keys(files).length, '| PROBLEMS', problemFiles.length, '| LEX', lexFiles.length);
  console.log(summary);
  if (errs.length) { console.error('VALIDATION ERRORS', errs.length); console.error(errs.slice(0, 40).join('\n')); process.exit(1); }
  console.log('VALIDATION OK');

  if (checkOnly) return;
  for (const [rel, { text }] of Object.entries(files)) {
    const path = join(OUT, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf8');
  }
  console.log('WROTE', OUT);
}
main();
```

- [ ] **Step 2: 検証のみ実行(書き出さず件数・整合を確認)**

Run: `cd app && node --import tsx tools/content/build_content.ts --check`
Expected: `VALIDATION OK` と、件数サマリが第1回答の表と一致(例: `kanji_read_N5=303 ... context_N3=2085 ...`)。`dupId`/`orphan`/`ja欠け` が出たら原因(元データの欠損 or 変換漏れ)を特定して修正してから次へ。

- [ ] **Step 3: 書き出し実行**

Run: `cd app && CONTENT_VERSION="$(git rev-parse --short HEAD)" node --import tsx tools/content/build_content.ts`
Expected: `WROTE content` 。`app/content/problems/…`・`app/content/lexicon/…`・`_manifest.json`・`README.md` が生成される。

- [ ] **Step 4: 生成物をnodeで抜き取り検証(実行時安全)**

Run: `cd app && node --import tsx -e "import fs from 'node:fs'; const f=JSON.parse(fs.readFileSync('content/problems/moji_goi/context_N4.json','utf8')); console.log(f.daimon, f.level, f.items.length, JSON.stringify(f.items[0]).slice(0,120));"`
Expected: `context N4 646 {...i18n...}` のように、daimon/level/件数が正しく、items[0] に `i18n.ja.explain` が入っている。

- [ ] **Step 5: package.json のテストに追記**

`app/package.json` の `"test"` スクリプト末尾(最後の `.test.ts` の直後、閉じ引用符の前)に以下を追加する:

```
 tools/content/manifest.test.ts tools/content/validate.test.ts tools/content/migrate_problems.test.ts tools/content/migrate_nested.test.ts
```

- [ ] **Step 6: 全テスト＋型チェック**

Run: `cd app && npm test 2>&1 | tail -5 && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 全テスト pass(既存208＋新テスト)・`error TS` は `0`。

- [ ] **Step 7: Commit**

```bash
cd app && git add tools/content/build_content.ts content package.json && git commit -m "feat(content): 移行オーケストレータ＋生成ツリー(検証済み)"
```

---

## Self-Review(spec 対応表)

- 3章 ディレクトリ構成 → Task 6(FOLDER割付・パス生成)。
- 4.1 問題スキーマ(i18n inline・neutral) → Task 1(type)・Task 4/5(変換)。
- 4.2 lexicon → Task 5(lexiconToFiles)・Task 6。
- 4.3 manifest → Task 2・Task 6。
- 6章 連動(id一意・訳完全性・孤児・manifest一致) → Task 3・Task 6の検証段。
- 7章 移行(knowledgeBank3分割・reading/listening分割・explainNe→i18n.ne・reason→explain・passageTransNe→i18n.ne.body) → Task 4/5/6。
- 8.1 スコープ外(9言語生成) → 本計画では ja のみ必須、ne は既存分のみ。languages配列は将来拡張。
- 命名(英数字＋READMEに日本語) → Task 1(DAIMON_LABELS)・Task 6(README生成)。

**未カバーで意図的に計画2送り**: アプリのローダ差し替え、Pages公開(`_site/content`)、実行時fetch＋キャッシュ＋オフライン、旧バンク削除。→ 計画2で扱う(本計画は旧バンクを残し、アプリ挙動を変えない)。

**Placeholder scan**: TODO/TBD無し。全step にコードまたは実行コマンド＋期待値あり。

**Type consistency**: `ContentFile`/`ContentItem`/`LexiconFile`/`Manifest` は schema.ts で定義し全タスクで同一名を使用。関数名(`toItem`/`groupToFiles`/`splitKnowledgeBank`/`readingToFiles`/`listeningToFiles`/`lexiconToFiles`/`buildManifest`/`fileEntry`/`checkIdsUnique`/`checkLangCompleteness`/`checkManifest`/`checkOrphanLexicon`)は Interfaces と実装で一致。
