# knowledgeBank 多言語解説アーキテクチャ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** knowledgeBank(5727問)の解説(explain)を不変IDで言語別ファイルに分離し、日本語同梱・非日本語はPages配信＋端末キャッシュ＋jaフォールバックで表示できる基盤を作る。

**Architecture:** 各問題に永続の連番id `kb-NNNNNN` を焼き込み（状態キーは旧`bk:…`→新idを起動時に冪等remap）、解説をcoreから外して `explain.ja.json`(同梱)と `l10n/explain.<lang>.json`(非ja・Pages配信)に分ける。coreは問題本体＋idのみ。解説解決はnode安全な純アクセサ(`explainJa`/`resolveExplain`)と、UI専用のランタイムローダー(`explainL10n.ts`・FS/fetch)に分離する。

**Tech Stack:** TypeScript / Expo React Native / node --import tsx --test / expo-file-system/legacy / GitHub Pages配信。

## Global Constraints

- 作業リポジトリのgitルートは `app/`（`c:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ\app`）。すべてのgit/npmコマンドはこのディレクトリで実行。
- テスト実行 = `node --import tsx --test <ファイル>`。**新規 `*.test.ts` は必ず `app/package.json` の `test` スクリプト末尾に追記**（追記しないとCI/一括実行で走らない）。
- 型チェック = `npm run tsc`（`tsc --noEmit`）。エラーゼロを維持。
- `daimon.ts` は node テスト（`passRate.test.ts`/`readiness.test.ts`）から import されるため、**daimon.ts が辿る依存に native モジュール（`expo-file-system` 等）を混ぜない**。解説の ja アクセサは JSON import のみの純モジュールにする。
- 生成データ走査は null ガード必須（真っ白クラッシュ回避）。取得失敗・欠落は例外を握りつぶし **ja フォールバック**、絶対にクラッシュさせない。
- Pages URL 構造 `https://jinkato2020.github.io/safa-JLPT/assets/...` を壊さない。解説は `assets/l10n/explain.<lang>.json`。
- 不変ID採番は**現在の配列順で一度だけ**。既存idは永久に変えない（並べ替え・分割・追加で不変）。
- 対象非日本語9言語コード: `en zh ko vi th id my bn ne`（`ja`は同梱基準）。
- 翻訳生成そのもの・大問分割は**本計画の対象外**。

---

### Task 1: 不変ID採番ツール＋データへ id 付与＋型＋移行マップ

**Files:**
- Create: `app/tools/assign_kb_ids.mjs`
- Modify: `app/src/data/index.ts:95`（`KnowledgeBankItem` に `id` 追加）
- Modify（ツール実行で書換）: `app/src/data/exam/knowledgeBank.json`
- Create（ツール生成）: `app/src/data/exam/kbIdMigration.json`
- Test: `app/src/data/exam/kbIds.test.ts`

**Interfaces:**
- Produces: `KnowledgeBankItem.id: string`（値は `kb-NNNNNN`）／ `kbIdMigration.json`（`Record<oldBkId, newKbId>`・全単射・全件）。

- [ ] **Step 1: 採番ツールを書く**

`app/tools/assign_kb_ids.mjs`:
```js
// knowledgeBank 各エントリへ永続の連番 id(kb-NNNNNN) を配列順で付与し、旧 bk:<lv>:<daimon>:<idx> → 新 id の
// 移行マップを出力する。冪等: 既に id があるエントリはその id を保持し、新規のみ採番。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const bankPath = join(here, '../src/data/exam/knowledgeBank.json');
const migPath = join(here, '../src/data/exam/kbIdMigration.json');

const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
let maxN = 0;
for (const b of bank) {
  if (typeof b.id === 'string' && /^kb-\d{6}$/.test(b.id)) maxN = Math.max(maxN, Number(b.id.slice(3)));
}
const migration = {};
for (let i = 0; i < bank.length; i++) {
  const b = bank[i];
  if (!(typeof b.id === 'string' && /^kb-\d{6}$/.test(b.id))) {
    b.id = `kb-${String(++maxN).padStart(6, '0')}`;
  }
  migration[`bk:${b.level}:${b.daimon}:${i}`] = b.id;
}
// id を先頭キーに（読みやすさ）: 各エントリを id 起点で再構築
const reordered = bank.map((b) => {
  const { id, ...rest } = b;
  return { id, ...rest };
});
writeFileSync(bankPath, JSON.stringify(reordered));
writeFileSync(migPath, JSON.stringify(migration));
console.log(`assigned ids to ${bank.length} entries; migration keys=${Object.keys(migration).length}`);
```

- [ ] **Step 2: 型に id を追加**

`app/src/data/index.ts:95` を次に変更:
```ts
export interface KnowledgeBankItem { id: string; level: string; daimon: string; stem: string; question: string; choices: string[]; answer: string; explain: string; ambiguous?: boolean; }
```

- [ ] **Step 3: 失敗するテストを書く**

`app/src/data/exam/kbIds.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import bank from './knowledgeBank.json';
import migration from './kbIdMigration.json';

const B = bank as { id: string }[];
const M = migration as Record<string, string>;

test('全エントリに一意な kb-NNNNNN id が付く', () => {
  assert.equal(B.length, 5727);
  for (const b of B) assert.match(b.id, /^kb-\d{6}$/);
  const ids = new Set(B.map((b) => b.id));
  assert.equal(ids.size, B.length);
});

test('移行マップは全件かつ全単射(旧bkId→新kbId)', () => {
  const keys = Object.keys(M);
  assert.equal(keys.length, B.length);
  const idSet = new Set(B.map((b) => b.id));
  const vals = Object.values(M);
  for (const v of vals) assert.ok(idSet.has(v), `未知の新id: ${v}`);
  assert.equal(new Set(vals).size, vals.length); // 値も一意=全単射
});
```

- [ ] **Step 4: テストを走らせ、失敗を確認**

Run: `cd app && node --import tsx --test src/data/exam/kbIds.test.ts`
Expected: FAIL（`kbIdMigration.json` 不在 or id 未付与でエラー）

- [ ] **Step 5: ツールを実行して id 付与＋移行マップ生成**

Run: `cd app && node tools/assign_kb_ids.mjs`
Expected: `assigned ids to 5727 entries; migration keys=5727`

- [ ] **Step 6: テストを走らせ、成功を確認＋tsc**

Run: `cd app && node --import tsx --test src/data/exam/kbIds.test.ts && npm run tsc`
Expected: PASS（2 tests）／ tsc エラーなし

- [ ] **Step 7: package.json にテストを追加**

`app/package.json` の `test` スクリプト末尾（最後のファイルの後ろ）に ` src/data/exam/kbIds.test.ts` を追記。

- [ ] **Step 8: コミット**

```bash
cd app && git add tools/assign_kb_ids.mjs src/data/index.ts src/data/exam/knowledgeBank.json src/data/exam/kbIdMigration.json src/data/exam/kbIds.test.ts package.json
git commit -m "feat(kb): 不変id(kb-NNNNNN)採番＋旧bkId移行マップ生成"
```

---

### Task 2: 状態キー移行（旧 bk: → 新 kb-）を loadState に冪等追加

**Files:**
- Modify: `app/src/store/storage.ts`
- Test: `app/src/store/kbIdMigration.test.ts`

**Interfaces:**
- Consumes: `kbIdMigration.json`（Task 1）。
- Produces: `export function migrateBankIds<T>(items: Record<string, T>): Record<string, T>`（`bk:`接頭キーを移行マップで新idへ改名・冪等）。

**設計根拠:** `storage.ts` は既に `migrateDaimonKeys` で `items` キーを冪等remapする前例がある（`loadState` 内で適用）。同型で `migrateBankIds` を足す。`STATE_VERSION` は変えない（変えると `loadState` が `null` を返し進捗全消去になるため）。

- [ ] **Step 1: 失敗するテストを書く**

`app/src/store/kbIdMigration.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateBankIds } from './storage';
import migration from '../data/exam/kbIdMigration.json';

const M = migration as Record<string, string>;
const [oldKey, newId] = Object.entries(M)[0];

test('bk:キーを新idへ改名し、他キーは保持', () => {
  const items = { [oldKey]: 1, 'n5-v-1#context': 2, 'kb-000001': 3 } as Record<string, number>;
  const out = migrateBankIds(items);
  assert.equal(out[newId], 1);
  assert.equal(out[oldKey], undefined);
  assert.equal(out['n5-v-1#context'], 2);
  assert.equal(out['kb-000001'], 3);
});

test('冪等: 2回適用しても同じ', () => {
  const items = { [oldKey]: 1 } as Record<string, number>;
  const once = migrateBankIds(items);
  const twice = migrateBankIds(once);
  assert.deepEqual(twice, once);
});
```

- [ ] **Step 2: テストを走らせ、失敗を確認**

Run: `cd app && node --import tsx --test src/store/kbIdMigration.test.ts`
Expected: FAIL（`migrateBankIds` が export されていない）

- [ ] **Step 3: migrateBankIds を実装し loadState に配線**

`app/src/store/storage.ts` の import 群に追記:
```ts
import KB_ID_MIGRATION from '../data/exam/kbIdMigration.json';
```
`migrateDaimonKeys` 関数の直後に追加:
```ts
// 不変id移行: 旧 bk:<lv>:<daimon>:<idx> 状態キーを新 kb-NNNNNN へ改名。冪等(既に kb- 等は保持)。
const KB_ID_MAP = KB_ID_MIGRATION as Record<string, string>;
export function migrateBankIds<T>(items: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key in items) {
    if (key.startsWith('bk:') && KB_ID_MAP[key]) { out[KB_ID_MAP[key]] = items[key]; continue; }
    out[key] = items[key];
  }
  return out;
}
```
`loadState` の `parsed.items = migrateDaimonKeys(parsed.items);` の**次の行**に追加:
```ts
    if (parsed.items) parsed.items = migrateBankIds(parsed.items);
```

- [ ] **Step 4: テストを走らせ、成功を確認＋tsc**

Run: `cd app && node --import tsx --test src/store/kbIdMigration.test.ts && npm run tsc`
Expected: PASS（2 tests）／ tsc エラーなし

- [ ] **Step 5: package.json にテストを追加**

`app/package.json` の `test` スクリプト末尾に ` src/store/kbIdMigration.test.ts` を追記。

- [ ] **Step 6: コミット**

```bash
cd app && git add src/store/storage.ts src/store/kbIdMigration.test.ts package.json
git commit -m "feat(store): bk:→kb- 状態キー移行を loadState に冪等追加"
```

---

### Task 3: daimon.ts の BANK を data由来 id に切替（index依存を廃止）

**Files:**
- Modify: `app/src/data/daimon.ts:28-30`
- Test: `app/src/data/bankId.test.ts`

**Interfaces:**
- Consumes: `KnowledgeBankItem.id`（Task 1）。
- Produces: `BANK[i].id` が `kb-NNNNNN`（index由来の `bk:` を廃止）。

**注意:** 本タスク時点では core にまだ `explain`/`explainNe` が残っている（除去は Task 4）。よって `BankUnit` の `explain` フィールドは維持。

- [ ] **Step 1: 失敗するテストを書く**

`app/src/data/bankId.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANK } from './daimon';
import KB from './exam/knowledgeBank.json';

test('BANK の id は data 由来 kb-NNNNNN', () => {
  assert.ok(BANK.length > 0);
  for (const b of BANK) assert.match(b.id, /^kb-\d{6}$/);
});

test('BANK は ambiguous な order を除外した件数', () => {
  const expected = (KB as { daimon: string; ambiguous?: boolean }[])
    .filter((b) => !(b.daimon === 'order' && b.ambiguous)).length;
  assert.equal(BANK.length, expected);
});
```

- [ ] **Step 2: テストを走らせ、失敗を確認**

Run: `cd app && node --import tsx --test src/data/bankId.test.ts`
Expected: FAIL（`b.id` が `bk:…` 形式でマッチ失敗）

- [ ] **Step 3: BANK を data id に切替**

`app/src/data/daimon.ts:28-30` を次に置換:
```ts
export const BANK: BankUnit[] = (KNOWLEDGE_BANK as BankUnit[])
  .filter((b) => !(b.daimon === 'order' && b.ambiguous));
```

- [ ] **Step 4: テストを走らせ、成功を確認＋既存テスト＋tsc**

Run: `cd app && node --import tsx --test src/data/bankId.test.ts src/ladder/passRate.test.ts src/ladder/readiness.test.ts && npm run tsc`
Expected: すべて PASS／ tsc エラーなし

- [ ] **Step 5: package.json にテストを追加**

`app/package.json` の `test` スクリプト末尾に ` src/data/bankId.test.ts` を追記。

- [ ] **Step 6: コミット**

```bash
cd app && git add src/data/daimon.ts src/data/bankId.test.ts package.json
git commit -m "feat(daimon): BANK を data由来kb-idに切替(index依存廃止)"
```

---

### Task 4: 解説を core から分離（explain.ja同梱・explain.ne移送・純アクセサ・questionForUnit更新）

**Files:**
- Create: `app/tools/split_explain.mjs`
- Create（ツール生成）: `app/src/data/exam/explain.ja.json`
- Create（ツール生成）: `app/src/data/exam/l10n/explain.ne.json` ＋ 他8言語の空 `explain.<lang>.json`
- Modify（ツール書換）: `app/src/data/exam/knowledgeBank.json`（`explain`/`explainNe` 除去）
- Create: `app/src/data/exam/explainJa.ts`
- Modify: `app/src/data/index.ts:95`（`KnowledgeBankItem` から `explain` 除去）
- Modify: `app/src/data/daimon.ts:25,124`（`BankUnit` から explain/explainNe 除去・questionForUnit で explainJa 使用）
- Test: `app/src/data/exam/explainJa.test.ts`

**Interfaces:**
- Produces:
  - `explainJa(id: string): string | undefined`
  - `resolveExplain(id: string, langMap: Record<string, string> | undefined): string | undefined`（`langMap[id]` があればそれ、無ければ ja へフォールバック）

- [ ] **Step 1: 分離ツールを書く**

`app/tools/split_explain.mjs`:
```js
// knowledgeBank から explain→explain.ja.json / explainNe→l10n/explain.ne.json を抽出し、
// core から両フィールドを除去。他8言語の空ファイルも雛形生成。冪等(再実行しても同じ結果)。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const examDir = join(here, '../src/data/exam');
const l10nDir = join(examDir, 'l10n');
if (!existsSync(l10nDir)) mkdirSync(l10nDir, { recursive: true });

const bank = JSON.parse(readFileSync(join(examDir, 'knowledgeBank.json'), 'utf8'));
const ja = {}, ne = {};
for (const b of bank) {
  if (typeof b.explain === 'string' && b.explain) ja[b.id] = b.explain;
  if (typeof b.explainNe === 'string' && b.explainNe) ne[b.id] = b.explainNe;
  delete b.explain; delete b.explainNe;
}
writeFileSync(join(examDir, 'explain.ja.json'), JSON.stringify(ja));
writeFileSync(join(l10nDir, 'explain.ne.json'), JSON.stringify(ne));
for (const lang of ['en', 'zh', 'ko', 'vi', 'th', 'id', 'my', 'bn']) {
  const p = join(l10nDir, `explain.${lang}.json`);
  if (!existsSync(p)) writeFileSync(p, JSON.stringify({}));
}
writeFileSync(join(examDir, 'knowledgeBank.json'), JSON.stringify(bank));
console.log(`ja=${Object.keys(ja).length} ne=${Object.keys(ne).length}; core stripped`);
```

- [ ] **Step 2: ツールを実行**

Run: `cd app && node tools/split_explain.mjs`
Expected: `ja=5727 ne=983; core stripped`

- [ ] **Step 3: 純アクセサを実装**

`app/src/data/exam/explainJa.ts`:
```ts
// 解説の日本語(同梱)アクセサ＋言語フォールバック解決。JSON import のみ＝node安全(FS/native非依存)。
import jaMap from './explain.ja.json';

const JA = jaMap as Record<string, string>;

/** 問題id(kb-NNNNNN)の日本語解説。無ければ undefined。 */
export function explainJa(id: string): string | undefined {
  return JA[id];
}

/** 要求言語のマップがあればその訳、無ければ ja へフォールバック。 */
export function resolveExplain(id: string, langMap: Record<string, string> | undefined): string | undefined {
  return (langMap && langMap[id]) || JA[id];
}
```

- [ ] **Step 4: 失敗するテストを書く**

`app/src/data/exam/explainJa.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainJa, resolveExplain } from './explainJa';
import bank from './knowledgeBank.json';

const firstId = (bank as { id: string }[])[0].id;

test('explainJa は同梱mapから解説を返す', () => {
  assert.equal(typeof explainJa(firstId), 'string');
  assert.ok((explainJa(firstId) as string).length > 0);
});

test('resolveExplain は langMap優先・無ければjaフォールバック', () => {
  assert.equal(resolveExplain(firstId, { [firstId]: 'OVERRIDE' }), 'OVERRIDE');
  assert.equal(resolveExplain(firstId, undefined), explainJa(firstId));
  assert.equal(resolveExplain(firstId, {}), explainJa(firstId)); // 欠落→ja
});

test('core から explain フィールドが除去されている', () => {
  const b = (bank as Record<string, unknown>[])[0];
  assert.equal('explain' in b, false);
  assert.equal('explainNe' in b, false);
});
```

- [ ] **Step 5: テストを走らせ、失敗を確認**

Run: `cd app && node --import tsx --test src/data/exam/explainJa.test.ts`
Expected: この時点では PASS の可能性大（ツールで既にcore除去済）。ただし次Stepの型/参照未更新で **tsc は FAIL** する。

- [ ] **Step 6: 型と questionForUnit を更新**

`app/src/data/index.ts:95`（`explain` を除去）:
```ts
export interface KnowledgeBankItem { id: string; level: string; daimon: string; stem: string; question: string; choices: string[]; answer: string; ambiguous?: boolean; }
```
`app/src/data/daimon.ts:25`（`BankUnit` から explain/explainNe 除去）:
```ts
export interface BankUnit { id: string; level: string; daimon: Daimon; stem: string; question: string; choices: string[]; answer: string; ambiguous?: boolean; }
```
`app/src/data/daimon.ts` の import に追加:
```ts
import { explainJa } from './exam/explainJa';
```
`app/src/data/daimon.ts:124`（BANK_INDEX 分岐の return）を次に変更（explain を explainJa 経由に、explainNe を削除）:
```ts
    return { itemId: unit, prompt: bank.stem, question: bank.question, format: DAIMON_QFORMAT[bank.daimon], choices, answerIndex, explain: explainJa(bank.id) };
```

- [ ] **Step 7: テスト＋tsc で成功を確認**

Run: `cd app && node --import tsx --test src/data/exam/explainJa.test.ts src/data/bankId.test.ts && npm run tsc`
Expected: すべて PASS／ tsc エラーなし

- [ ] **Step 8: package.json にテストを追加**

`app/package.json` の `test` スクリプト末尾に ` src/data/exam/explainJa.test.ts` を追記。

- [ ] **Step 9: コミット**

```bash
cd app && git add tools/split_explain.mjs src/data/exam/explain.ja.json src/data/exam/l10n src/data/exam/knowledgeBank.json src/data/exam/explainJa.ts src/data/index.ts src/data/daimon.ts src/data/exam/explainJa.test.ts package.json
git commit -m "feat(kb): 解説をexplain.ja(同梱)/l10n(非ja)へ分離＋純アクセサ＋core除去"
```

---

### Task 5: Pages 配信URL ヘルパー（L10N_BASE_URL / explainL10nUrl）

**Files:**
- Modify: `app/src/data/audioBase.ts`
- Test: `app/src/data/audioBase.test.ts`（既存に追記）

**Interfaces:**
- Produces: `L10N_BASE_URL: string` ／ `explainL10nUrl(lang: string): string`。

- [ ] **Step 1: 失敗するテストを追記**

`app/src/data/audioBase.test.ts` の末尾に追加:
```ts
import { explainL10nUrl } from './audioBase';
test('explainL10nUrl は assets/l10n の言語別JSON URL', () => {
  assert.equal(explainL10nUrl('en'), 'https://jinkato2020.github.io/safa-JLPT/assets/l10n/explain.en.json');
});
```
（既存ファイル冒頭に `test`/`assert` の import が無ければ追加: `import { test } from 'node:test'; import assert from 'node:assert/strict';`）

- [ ] **Step 2: テストを走らせ、失敗を確認**

Run: `cd app && node --import tsx --test src/data/audioBase.test.ts`
Expected: FAIL（`explainL10nUrl` 未定義）

- [ ] **Step 3: URLヘルパーを実装**

`app/src/data/audioBase.ts` の末尾に追加:
```ts
/** 解説L10n配信元(GitHub Pages)。非日本語解説を言語別JSONで配信。 */
export const L10N_BASE_URL = 'https://jinkato2020.github.io/safa-JLPT/assets/l10n/';

/** 言語別解説JSONのURL。lang=en/zh/ko/vi/th/id/my/bn/ne 等。 */
export function explainL10nUrl(lang: string): string {
  return `${L10N_BASE_URL}explain.${lang}.json`;
}
```

- [ ] **Step 4: テストを走らせ、成功を確認＋tsc**

Run: `cd app && node --import tsx --test src/data/audioBase.test.ts && npm run tsc`
Expected: PASS／ tsc エラーなし

- [ ] **Step 5: コミット**

```bash
cd app && git add src/data/audioBase.ts src/data/audioBase.test.ts
git commit -m "feat(l10n): 解説配信URLヘルパー(L10N_BASE_URL/explainL10nUrl)"
```

---

### Task 6: ランタイムローダー explainL10n.ts（プリフェッチ・端末キャッシュ・版無効化）

**Files:**
- Create: `app/src/data/exam/explainL10n.ts`

**Interfaces:**
- Consumes: `resolveExplain`（Task 4）／ `explainL10nUrl`（Task 5）。
- Produces:
  - `prefetchExplain(lang: string): Promise<void>`（1言語=1ファイルを取得しメモリ＋端末キャッシュ。失敗は握りつぶす）
  - `getExplain(id: string, lang: string): Promise<string | undefined>`（要求言語→jaフォールバック）

**設計根拠:** `vocabAudio.ts` の FS ガード＋キャッシュ版パターンに準拠（`expo-file-system/legacy`・`documentDirectory`・version marker）。**このファイルは daimon.ts から import しない**（native依存のため）。UI専用。

- [ ] **Step 1: ローダーを実装**

`app/src/data/exam/explainL10n.ts`:
```ts
// 非日本語解説のランタイムローダー。1言語=1ファイルをPagesから取得→端末キャッシュ→メモリ。
// 要求言語→ja フォールバック。取得失敗は握りつぶす(必ずjaで表示可能)。UI専用(nativeFS依存)。
import { Platform } from 'react-native';
import * as FileSystemNS from 'expo-file-system/legacy';
import { resolveExplain } from './explainJa';
import { explainL10nUrl } from '../audioBase';

interface FSLike {
  documentDirectory?: string | null;
  makeDirectoryAsync?: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
  getInfoAsync?: (uri: string) => Promise<{ exists: boolean }>;
  readAsStringAsync?: (uri: string) => Promise<string>;
  writeAsStringAsync?: (uri: string, contents: string) => Promise<void>;
}
const FS = FileSystemNS as unknown as FSLike;

const EXPLAIN_CACHE_VERSION = 1; // 内容更新時に+1で端末l10nキャッシュを破棄
const mem = new Map<string, Record<string, string>>(); // lang → {id: 訳}
const cacheDir = Platform.OS !== 'web' && FS.documentDirectory ? `${FS.documentDirectory}l10n/` : null;
let versionChecked = false;

async function ensureCacheVersion(): Promise<void> {
  if (versionChecked || !cacheDir) return;
  versionChecked = true;
  const marker = `${FS.documentDirectory}l10n_cache.v`;
  try {
    let ver = '';
    const info = await FS.getInfoAsync?.(marker);
    if (info?.exists) { try { ver = (await FS.readAsStringAsync?.(marker)) ?? ''; } catch { /* noop */ } }
    if (ver !== String(EXPLAIN_CACHE_VERSION)) {
      try { await FS.makeDirectoryAsync?.(cacheDir, { intermediates: true }); } catch { /* noop */ }
      try { await FS.writeAsStringAsync?.(marker, String(EXPLAIN_CACHE_VERSION)); } catch { /* noop */ }
    }
  } catch { /* noop */ }
}

/** 1言語ぶんの解説マップを取得してメモリ＋端末キャッシュに載せる。失敗は握りつぶす。 */
export async function prefetchExplain(lang: string): Promise<void> {
  if (lang === 'ja' || mem.has(lang)) return;
  await ensureCacheVersion();
  const file = cacheDir ? `${cacheDir}explain.${lang}.json` : null;
  // 1) 端末キャッシュ
  if (file) {
    try {
      const info = await FS.getInfoAsync?.(file);
      if (info?.exists) {
        const raw = await FS.readAsStringAsync?.(file);
        if (raw) { mem.set(lang, JSON.parse(raw)); return; }
      }
    } catch { /* noop */ }
  }
  // 2) Pages取得→キャッシュ
  try {
    const res = await fetch(explainL10nUrl(lang));
    if (!res.ok) return;
    const map = (await res.json()) as Record<string, string>;
    mem.set(lang, map);
    if (file && cacheDir) {
      try { await FS.makeDirectoryAsync?.(cacheDir, { intermediates: true }); } catch { /* noop */ }
      try { await FS.writeAsStringAsync?.(file, JSON.stringify(map)); } catch { /* noop */ }
    }
  } catch { /* オフライン等→jaフォールバックに委ねる */ }
}

/** 問題idの解説を要求言語で解決(→jaフォールバック)。 */
export async function getExplain(id: string, lang: string): Promise<string | undefined> {
  if (lang !== 'ja' && !mem.has(lang)) await prefetchExplain(lang);
  return resolveExplain(id, mem.get(lang));
}
```

- [ ] **Step 2: tsc で型を確認**

Run: `cd app && npm run tsc`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
cd app && git add src/data/exam/explainL10n.ts
git commit -m "feat(l10n): 非ja解説のランタイムローダー(prefetch/getExplain/キャッシュ版)"
```

---

### Task 7: 解説表示の配線（ExplainL10n コンポーネント＋QuizScreen/MockScreen）

**Files:**
- Create: `app/src/components/ExplainL10n.tsx`
- Modify: `app/src/screens/QuizScreen.tsx:248`
- Modify: `app/src/screens/MockScreen.tsx:98,442`

**Interfaces:**
- Consumes: `getExplain`（Task 6）／ `explainJa`（Task 4）。
- Produces: `<ExplainL10n id l1 />`（`l1!=='ja'` かつ ja と異なる訳が取れた時だけ母語解説を表示。取れなければ何も描画しない＝jaは既存 `question.explain` が表示）。

- [ ] **Step 1: コンポーネントを実装**

`app/src/components/ExplainL10n.tsx`:
```tsx
// 母語(l1)の解説を非同期取得して表示。l1=ja/未取得/ja同一なら非表示。既存のja解説は呼び出し側が表示済み。
import { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors, type as ty } from '../theme';
import { getExplain } from '../data/exam/explainL10n';
import { explainJa } from '../data/exam/explainJa';

export default function ExplainL10n({ id, l1 }: { id: string; l1: string }) {
  const c = useColors();
  const s = makeStyles(c);
  const [txt, setTxt] = useState('');
  useEffect(() => {
    let alive = true;
    if (!id || l1 === 'ja') { setTxt(''); return; }
    getExplain(id, l1).then((t) => {
      if (!alive) return;
      setTxt(t && t !== explainJa(id) ? t : '');
    }).catch(() => { if (alive) setTxt(''); });
    return () => { alive = false; };
  }, [id, l1]);
  if (!txt) return null;
  return <Text style={s.txt}>{txt}</Text>;
}

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  txt: { fontSize: ty.small, color: c.blue, lineHeight: 20, marginTop: 4 },
});
```

- [ ] **Step 2: QuizScreen を配線**

`app/src/screens/QuizScreen.tsx` の import 群に追加:
```ts
import ExplainL10n from '../components/ExplainL10n';
```
`QuizScreen.tsx:248`（`settings.l1 === 'ne' && question.explainNe` の行）を次に置換:
```tsx
                {question.itemId ? <ExplainL10n id={question.itemId} l1={settings.l1} /> : null}
```

- [ ] **Step 3: MockScreen を配線**

`app/src/screens/MockScreen.tsx` の import 群に追加:
```ts
import ExplainL10n from '../components/ExplainL10n';
```
`MockScreen.tsx:36` の `interface MockItem {` ブロックに `itemId?: string;` を1行追加（word問題のkb-id保持用）。
`MockScreen.tsx:98`（word問題を組み立てる return。`explain: q.explain,` を含む行）に `itemId` を追加:
```ts
      prompt: q.prompt || undefined, reading: q.reading, example: q.example, furi: q.furi, furiTarget: q.furiTarget, noTargetRuby: q.noTargetRuby, explain: q.explain, itemId: q.itemId,
```
`MockScreen.tsx:442`（`{cur.explain ? …}` の行）の**直後**に追加（MockScreen は `state` 参照＝`state.settings.l1`）:
```tsx
            {cur.itemId ? <ExplainL10n id={cur.itemId} l1={state.settings.l1} /> : null}
```

- [ ] **Step 4: tsc で確認**

Run: `cd app && npm run tsc`
Expected: エラーなし（型不足があれば `itemId?: string;` を該当question型へ追加して解消）

- [ ] **Step 5: 既存テスト一括で退行なしを確認**

Run: `cd app && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"`
Expected: `fail 0`

- [ ] **Step 6: コミット**

```bash
cd app && git add src/components/ExplainL10n.tsx src/screens/QuizScreen.tsx src/screens/MockScreen.tsx
git commit -m "feat(ui): 母語解説表示ExplainL10nをQuiz/Mockに配線(9言語対応・jaフォールバック)"
```

---

### Task 8: Pages 配信に l10n/explain.*.json を追加

**Files:**
- Modify: `app/.github/workflows/ios-build-jlpt.yml`（`deploy-pages` ジョブ）

**Interfaces:**
- Produces: `https://jinkato2020.github.io/safa-JLPT/assets/l10n/explain.<lang>.json` が配信される。

- [ ] **Step 1: 「Build _site」ステップに l10n コピーを追記**

対象は `deploy-pages` ジョブの `Build _site (audio + legal pages・URL構造維持)` ステップ（現状 `mkdir -p _site/assets` と `cp -r assets/audio _site/assets/audio` を含む）。CI のカレントはリポジトリルート（＝`app/` の中身。gitルートが `app/` のため `app/` プレフィックス無し）。

`cp -r assets/audio _site/assets/audio` の**次の行**に追加:
```yaml
          mkdir -p _site/assets/l10n
          cp src/data/exam/l10n/explain.*.json _site/assets/l10n/
```
これで非ja解説が `assets/l10n/explain.<lang>.json` として配信される（jaは同梱のみで配信不要＝`l10n/` には非jaしか無い）。既存の `assets/audio`・`/dict` の配信は変更しない。

- [ ] **Step 3: ワークフロー構文を確認**

Run: `cd app && python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ios-build-jlpt.yml',encoding='utf-8')); print('yaml ok')"`
Expected: `yaml ok`

- [ ] **Step 4: コミット**

```bash
cd app && git add .github/workflows/ios-build-jlpt.yml
git commit -m "feat(pages): 解説l10n(explain.*.json)をPages配信に追加"
```

---

## 完了後の確認（全タスク後・1回）

- [ ] `cd app && npm run tsc` → エラーなし
- [ ] `cd app && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"` → `fail 0`（新規4テスト込み）
- [ ] `cd app && git log --oneline -8` で8コミットが積まれていることを確認
- [ ] 手元確認: `settings.l1='ne'` で Quiz の文法/用法問題を解答 → 解説の下に既存neデータ由来の母語訳が出る（他8言語は翻訳投入後に反映）

## 後続（本計画対象外・別途）

- 多言語教材へ 9言語翻訳を委譲 → `app/src/data/exam/l10n/explain.<lang>.json` を充填（有料一括・円見積り→承認後）。投入後 `EXPLAIN_CACHE_VERSION` を+1して端末キャッシュ更新。
- 大問分割（core を daimon 別ファイルへ）は安定id導入済みのため別specでいつでも可能。
