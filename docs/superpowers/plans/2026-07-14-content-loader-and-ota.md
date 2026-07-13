# 問題コンテンツ ローダ切替＋Pages逐次OTA配信(計画2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アプリの問題データを、計画1で作った新フォーマット(`content/`・大問×レベル・i18n inline)から供給するよう切り替え、さらに GitHub Pages から変更/追加ファイルを逐次ダウンロードして端末キャッシュで上書きする「簡易リリース(データOTA)」を実装する。

**Architecture:** 二段。**Phase A(ローダ切替)**: 新フォーマット全ファイルを Metro でバンドル(baseline)し、純関数で旧shape(`CONTEXT_BANK` 等)へ再構成(rehydrate)して `data/index.ts` に供給。既存の出題ロジックは無変更・同期起動を維持。旧バンクJSONを削除。**Phase B(Pages逐次OTA)**: 起動時に Pages の `_manifest.json` を見て、sha256 が変わった/新規のファイルだけ逐次ダウンロードして端末キャッシュへ保存。読み取りは「キャッシュ優先→無ければbundled」。オフライン/失敗時は bundled で継続。音声は対象外(既存パイプライン)。

**Tech Stack:** TypeScript / React Native(Expo SDK54)/ `expo-file-system/legacy`(DL・キャッシュ)/ node:test(tsx)。

## Global Constraints

- **同期起動を壊さない**: 200+モジュールが `VOCAB`/`BANK` 等を同期importしている。baselineはバンドルし、起動時同期を維持する(初回オフライン可)。
- **既存の出題ロジック・型は無変更**: rehydrate は旧shape(`KanjiReadBankItem`/`ContextBankItem`/`SynonymBankItem`/`OrthographyBankItem`/`KnowledgeBankItem`/`ReadingItem`/`ListeningItem`/`PassageSet`)を**厳密に**再現する。等価ゲート=**既存223テスト＋tsc 0** がグリーンのまま。
- **旧ne訳の互換**: `CONTEXT_BANK.explainNe` 等を `i18n.ne.explain` から復元(consumerを変えない)。
- **Pages base**: `https://jinkato2020.github.io/safa-JLPT/`。content は `/content/…`。
- **キャッシュ**: `expo-file-system/legacy`([expo-fs-legacy-sdk54] — default import の新APIは無反応の罠。必ず legacy)。
- **失敗/オフライン安全**: OTA取得失敗・未接続でもアプリは bundled baseline で完全動作。取得は非同期・描画をブロックしない。
- **音声は対象外**(既存 assets/audio Pages 配信のまま)。
- 検証は node で実データ実行([verify-runtime-not-just-build])。テスト実行 `cd app && node --import tsx --test <file>`。

## 対象の旧export(rehydrate が再現するもの・`src/data/index.ts`)

| 旧export | 型 | 新ソース | 復元マッピング |
|---|---|---|---|
| `KANJI_READ_BANK` | `KanjiReadBankItem[]` | problems/moji_goi/kanji_read_*.json | item + `level`(file) + `daimon:'kanji_read'` |
| `ORTHOGRAPHY_BANK` | `OrthographyBankItem[]` | orthography_*.json | + `explain=i18n.ja.explain` `explainNe=i18n.ne.explain` `level` |
| `CONTEXT_BANK` | `ContextBankItem[]` | context_*.json | + `explain/explainNe`(i18n) `level` |
| `SYNONYM_BANK` | `SynonymBankItem[]` | synonym_*.json | + `reason=i18n.ja.explain` `reasonNe=i18n.ne.explain` `level` |
| `KNOWLEDGE_BANK` | `KnowledgeBankItem[]` | usage/grammar_form/order_*.json | item + `daimon`(file) `level` |
| `READING` | `ReadingItem[]` | dokkai/*.json | item + `subtype`(daimon) `level`、`questions[].explain=q.i18n.ja.explain` |
| `LISTENING` | `ListeningItem[]` | choukai/*.json | 同上 |
| `PASSAGE_GRAMMAR` | `PassageSet[]` | bunpou/passage_grammar_*.json | item + `level` |
| `MEANING_L10N` | `Record<string,Record<string,string>>` | lexicon/meaning_*.json | 全level merge(items) |
| `EXAMPLE_L10N` | 同上 | lexicon/example_*.json | 全level merge |
| passageTransNe(reading訳) | `Record<string,string>` | dokkai/*.json の `i18n.ne.body` | `{ id: item.i18n.ne.body }` |

> 実装前に `src/data/index.ts` の各 `*BankItem`/`ReadingItem`/`ListeningItem`/`PassageSet` interface を読み、フィールド名を1:1で合わせること。等価ゲート(223テスト)が最終判定。

---

## Phase A: ローダ切替(バンドル・同期・旧バンク削除)

### Task 1: バンドル用バレルの自動生成(build_content 拡張)

**Files:**
- Modify: `app/tools/content/build_content.ts`
- Create(生成物): `app/src/data/content/bundled.generated.ts`

**Interfaces:**
- Produces: `bundled.generated.ts` が `export const BUNDLED: Record<string, unknown>` を持ち、`content/` の全 JSON を静的 import してパス→パース済みオブジェクトで返す。

- [ ] **Step 1: build_content に barrel 生成を追加**

`build_content.ts` の書き出しループの後(`console.log('WROTE', OUT)` の直前)に、`files` のうち `.json`(manifest除く)を静的importするTSを生成する:

```ts
  // Metroバンドル用バレル(全content JSONを静的import→BUNDLEDマップ)。生成先は src/data/content。
  const jsonPaths = Object.keys(files).filter((p) => p.endsWith('.json') && p !== '_manifest.json').sort();
  const importLines = jsonPaths.map((p, i) => `import f${i} from '../../../content/${p}';`).join('\n');
  const mapLines = jsonPaths.map((p, i) => `  '${p}': f${i},`).join('\n');
  const barrel = `// 自動生成(build_content.ts)。手で編集しない。content/ の全JSONを静的importする。\n${importLines}\nexport const BUNDLED: Record<string, unknown> = {\n${mapLines}\n};\n`;
  mkdirSync('src/data/content', { recursive: true });
  writeFileSync('src/data/content/bundled.generated.ts', barrel, 'utf8');
```

- [ ] **Step 2: 再生成して barrel を作る**

Run: `cd app && CONTENT_VERSION="$(git rev-parse --short HEAD)" node --import tsx tools/content/build_content.ts && head -3 src/data/content/bundled.generated.ts`
Expected: `WROTE content` の後、`bundled.generated.ts` の先頭に `import f0 from '../../../content/lexicon/example_N3.json';` 等が出る。

- [ ] **Step 3: バンドルが型解決できるか確認**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`(`resolveJsonModule` 有効なので JSON import は通る)。

- [ ] **Step 4: Commit**

```bash
cd app && git add tools/content/build_content.ts src/data/content/bundled.generated.ts && git commit -m "feat(content): バンドル用バレル自動生成"
```

### Task 2: 再構成(rehydrate)純関数

**Files:**
- Create: `app/src/data/content/rehydrate.ts`
- Test: `app/src/data/content/rehydrate.test.ts`

**Interfaces:**
- Consumes: `BUNDLED`(paths→parsed)。各 `ContentFile`/`LexiconFile`。
- Produces:
  - `rehydrateBanks(files: Record<string, any>): { KANJI_READ_BANK: any[]; ORTHOGRAPHY_BANK: any[]; CONTEXT_BANK: any[]; SYNONYM_BANK: any[]; KNOWLEDGE_BANK: any[]; READING: any[]; LISTENING: any[]; PASSAGE_GRAMMAR: any[]; MEANING_L10N: Record<string,any>; EXAMPLE_L10N: Record<string,any>; PASSAGE_TRANS_NE: Record<string,string> }`
  - 各 daimon の1問復元ヘルパ(内部)。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// app/src/data/content/rehydrate.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rehydrateBanks } from './rehydrate.ts';

const files = {
  'problems/moji_goi/context_N4.json': { schema: 1, daimon: 'context', level: 'N4', languages: ['ja', 'ne'],
    items: [{ id: 'cx:n4-v-1', prompt: 'p', question: 'q', answer: 'a', choices: ['a', 'b'], i18n: { ja: { explain: 'J' }, ne: { explain: 'N' } } }] },
  'problems/moji_goi/synonym_N5.json': { schema: 1, daimon: 'synonym', level: 'N5', languages: ['ja', 'ne'],
    items: [{ id: 'sy:n5-v-1', sentence: 's', underline: 'u', word: 'w', answer: 'a', choices: ['a', 'b'], i18n: { ja: { explain: 'J' }, ne: { explain: 'N' } } }] },
  'problems/dokkai/naiyou_tan_N4.json': { schema: 1, daimon: 'naiyou_tan', level: 'N4', languages: ['ja', 'ne'],
    items: [{ id: 'r-N4-tan-1', title: 't', body: 'B', questions: [{ id: 'q1', q: 'Q', choices: ['a'], answerIndex: 0, i18n: { ja: { explain: 'E' } } }], i18n: { ne: { body: 'BN' } } }] },
  'lexicon/meaning_N4.json': { schema: 1, kind: 'meaning', level: 'N4', languages: ['ne'], items: { 'n4-v-1': { ne: 'M' } } },
};

test('rehydrateBanks: context に level/explain/explainNe を復元', () => {
  const b = rehydrateBanks(files);
  const c = b.CONTEXT_BANK[0];
  assert.equal(c.id, 'cx:n4-v-1'); assert.equal(c.level, 'N4');
  assert.equal(c.prompt, 'p'); assert.equal(c.explain, 'J'); assert.equal(c.explainNe, 'N');
  assert.equal(c.i18n, undefined); // 旧shapeにi18nは残さない
});
test('rehydrateBanks: synonym は reason/reasonNe', () => {
  const b = rehydrateBanks(files);
  const s = b.SYNONYM_BANK[0];
  assert.equal(s.reason, 'J'); assert.equal(s.reasonNe, 'N'); assert.equal(s.level, 'N5');
});
test('rehydrateBanks: reading は subtype/level・question explain・passageTransNe', () => {
  const b = rehydrateBanks(files);
  const r = b.READING[0];
  assert.equal(r.subtype, 'naiyou_tan'); assert.equal(r.level, 'N4');
  assert.equal(r.questions[0].explain, 'E');
  assert.equal(b.PASSAGE_TRANS_NE['r-N4-tan-1'], 'BN');
});
test('rehydrateBanks: lexicon merge', () => {
  const b = rehydrateBanks(files);
  assert.equal(b.MEANING_L10N['n4-v-1'].ne, 'M');
});
```

- [ ] **Step 2: 失敗確認**

Run: `cd app && node --import tsx --test src/data/content/rehydrate.test.ts`
Expected: FAIL(module not found)

- [ ] **Step 3: 実装**

```ts
// app/src/data/content/rehydrate.ts — 新フォーマット(content/)→旧shape(*BANK/READING/...)へ再構成する純関数。
// consumerを変えないため、旧フィールド名(explain/explainNe/reason/reasonNe/subtype/level/daimon)を厳密に復元する。
type Any = Record<string, any>;
const filesByDaimon = (files: Record<string, Any>, daimon: string): Any[] =>
  Object.entries(files).filter(([p, f]) => p.startsWith('problems/') && f.daimon === daimon).map(([, f]) => f);
const stripI18n = (o: Any): Any => { const { i18n, ...rest } = o; return rest; };

function bankItems(files: Record<string, Any>, daimon: string, map: (it: Any, level: string) => Any): Any[] {
  const out: Any[] = [];
  for (const f of filesByDaimon(files, daimon)) for (const it of f.items) out.push(map(it, f.level));
  return out;
}

export function rehydrateBanks(files: Record<string, Any>) {
  const KANJI_READ_BANK = bankItems(files, 'kanji_read', (it, level) => ({ ...stripI18n(it), level, daimon: 'kanji_read' }));
  const ORTHOGRAPHY_BANK = bankItems(files, 'orthography', (it, level) => ({ ...stripI18n(it), level, explain: it.i18n?.ja?.explain, explainNe: it.i18n?.ne?.explain }));
  const CONTEXT_BANK = bankItems(files, 'context', (it, level) => ({ ...stripI18n(it), level, explain: it.i18n?.ja?.explain, explainNe: it.i18n?.ne?.explain }));
  const SYNONYM_BANK = bankItems(files, 'synonym', (it, level) => ({ ...stripI18n(it), level, reason: it.i18n?.ja?.explain, reasonNe: it.i18n?.ne?.explain }));
  const KNOWLEDGE_BANK = ['usage', 'grammar_form', 'order'].flatMap((d) => bankItems(files, d, (it, level) => ({ ...stripI18n(it), level, daimon: d })));

  const READING_SUBTYPES = ['naiyou_tan', 'naiyou_chu', 'choubun', 'joho'];
  const LISTENING_SUBTYPES = ['kadai', 'point', 'gaiyou', 'hatsuwa', 'sokuji'];
  const PASSAGE_TRANS_NE: Record<string, string> = {};
  const readingOne = (it: Any, level: string, subtype: string) => {
    if (it.i18n?.ne?.body) PASSAGE_TRANS_NE[it.id] = it.i18n.ne.body;
    return { ...stripI18n(it), level, subtype, questions: (it.questions ?? []).map((q: Any) => ({ ...stripI18n(q), explain: q.i18n?.ja?.explain })) };
  };
  const READING = READING_SUBTYPES.flatMap((st) => bankItems(files, st, (it, level) => readingOne(it, level, st)));
  const LISTENING = LISTENING_SUBTYPES.flatMap((st) => bankItems(files, st, (it, level) => ({ ...stripI18n(it), level, subtype: st, questions: (it.questions ?? []).map((q: Any) => ({ ...stripI18n(q), explain: q.i18n?.ja?.explain })) })));
  const PASSAGE_GRAMMAR = bankItems(files, 'passage_grammar', (it, level) => ({ ...stripI18n(it), level }));

  const mergeLex = (kind: string): Record<string, Any> => {
    const out: Record<string, Any> = {};
    for (const [p, f] of Object.entries(files)) if (p.startsWith('lexicon/') && f.kind === kind) Object.assign(out, f.items);
    return out;
  };
  return { KANJI_READ_BANK, ORTHOGRAPHY_BANK, CONTEXT_BANK, SYNONYM_BANK, KNOWLEDGE_BANK, READING, LISTENING, PASSAGE_GRAMMAR, MEANING_L10N: mergeLex('meaning'), EXAMPLE_L10N: mergeLex('example'), PASSAGE_TRANS_NE };
}
```

- [ ] **Step 4: パス確認**

Run: `cd app && node --import tsx --test src/data/content/rehydrate.test.ts`
Expected: PASS(4 tests)

- [ ] **Step 5: Commit**

```bash
cd app && git add src/data/content/rehydrate.ts src/data/content/rehydrate.test.ts && git commit -m "feat(content): 新形式→旧shape 再構成(rehydrate)"
```

### Task 3: data/index.ts を rehydrate 供給へ切替＋旧バンク削除

**Files:**
- Modify: `app/src/data/index.ts`(該当バンクの import と export を差し替え)
- Delete: `app/src/data/exam/{kanjiReadingBank,orthographyBank,contextBank,synonymBank,knowledgeBank,reading,listening,passageGrammar}.json`、`app/src/data/dict/{meaningL10n,exampleL10n}.json`
- Test: 既存全223 + rehydrate

**Interfaces:**
- Consumes: `BUNDLED`(barrel)、`rehydrateBanks`
- Produces: `data/index.ts` の `KANJI_READ_BANK`/`CONTEXT_BANK`/`SYNONYM_BANK`/`ORTHOGRAPHY_BANK`/`KNOWLEDGE_BANK`/`READING`/`LISTENING`/`PASSAGE_GRAMMAR`/`MEANING_L10N`/`EXAMPLE_L10N` が rehydrate 由来になる。値の形は不変。

- [ ] **Step 1: index.ts 冒頭で rehydrate を1回実行**

`src/data/index.ts` の旧バンク import 群(`kanjiReadBank`/`contextBank`/`synonymBank`/`orthographyBank`/`knowledgeBankJson`/`reading`/`listening`/`passageGrammar`/`meaningL10n`/`exampleL10n`)の import 行を削除し、代わりに先頭付近へ:

```ts
import { BUNDLED } from './content/bundled.generated';
import { rehydrateBanks } from './content/rehydrate';
const _R = rehydrateBanks(BUNDLED as Record<string, any>);
```

- [ ] **Step 2: 各 export を _R 由来に差し替え**

該当行を次のように変更(型注釈は既存のまま流用):

```ts
export const KANJI_READ_BANK = _R.KANJI_READ_BANK as KanjiReadBankItem[];
export const CONTEXT_BANK = _R.CONTEXT_BANK as ContextBankItem[];
export const SYNONYM_BANK = _R.SYNONYM_BANK as SynonymBankItem[];
export const ORTHOGRAPHY_BANK = _R.ORTHOGRAPHY_BANK as OrthographyBankItem[];
export const KNOWLEDGE_BANK = _R.KNOWLEDGE_BANK as KnowledgeBankItem[];
export const READING = _R.READING as ReadingItem[];
export const LISTENING = _R.LISTENING as ListeningItem[];
export const PASSAGE_GRAMMAR = _R.PASSAGE_GRAMMAR as PassageSet[];
export const MEANING_L10N = _R.MEANING_L10N as Record<string, Record<string, string>>;
export const EXAMPLE_L10N = _R.EXAMPLE_L10N as Record<string, Record<string, string>>;
```

- [ ] **Step 3: passageTransNe consumer を差し替え**

`components/PassageSetPlayer.tsx` が `passageTransNe.json` を直接 import している箇所を、`import { PASSAGE_TRANS_NE } from '../data'` へ変更し、`data/index.ts` に `export const PASSAGE_TRANS_NE = _R.PASSAGE_TRANS_NE as Record<string, string>;` を追加する(実際の参照名は該当ファイルを読んで合わせる)。

- [ ] **Step 4: 等価ゲート(既存全テスト＋型)**

Run: `cd app && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)" && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: 223+ tests・fail 0・`error TS` 0。**失敗したら rehydrate のフィールド名を旧interfaceに合わせて修正**(等価ゲートが真の判定)。

- [ ] **Step 5: 旧バンク JSON を削除して再確認**

```bash
cd app && git rm src/data/exam/kanjiReadingBank.json src/data/exam/orthographyBank.json src/data/exam/contextBank.json src/data/exam/synonymBank.json src/data/exam/knowledgeBank.json src/data/exam/reading.json src/data/exam/listening.json src/data/exam/passageGrammar.json src/data/exam/passageTransNe.json src/data/dict/meaningL10n.json src/data/dict/exampleL10n.json
cd app && npm test 2>&1 | grep -E "^ℹ (pass|fail)" && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Expected: 削除後も pass 全緑・tsc 0(rehydrate が唯一のソース)。もし削除した JSON をまだ import しているテストがあれば、そのテストを新ソースに合わせて更新。

- [ ] **Step 6: Commit**

```bash
cd app && git add -A && git commit -m "refactor(content): data層を新フォーマット(rehydrate)供給へ切替・旧バンク削除"
```

---

## Phase B: Pages 逐次OTA配信

### Task 4: manifest差分＋逐次DL＋キャッシュ

**Files:**
- Create: `app/src/data/content/ota.ts`
- Create: `app/src/data/content/otaDiff.ts`(純関数)
- Test: `app/src/data/content/otaDiff.test.ts`

**Interfaces:**
- Produces:
  - `diffManifest(remote: Manifest, cachedShas: Record<string,string>): string[]`(純・要DLパス列)
  - `syncContent(): Promise<void>`(manifest取得→差分を逐次DL→キャッシュ保存→cachedShas更新。失敗は握って無害)
  - `getContentFile(path: string): unknown`(キャッシュ優先→無ければ BUNDLED)

- [ ] **Step 1: 差分の失敗テスト**

```ts
// app/src/data/content/otaDiff.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffManifest } from './otaDiff.ts';

test('diffManifest: sha変化と新規のみ返す', () => {
  const remote = { schema: 1, contentVersion: 'v', languages: [], daimonLabels: {}, files: {
    'a.json': { sha256: 'X', bytes: 1, count: 1 }, 'b.json': { sha256: 'Y', bytes: 1, count: 1 }, 'c.json': { sha256: 'Z', bytes: 1, count: 1 },
  } } as any;
  const cached = { 'a.json': 'X', 'b.json': 'OLD' }; // a=同一, b=変化, c=新規
  assert.deepEqual(diffManifest(remote, cached).sort(), ['b.json', 'c.json']);
});
```

- [ ] **Step 2: 失敗確認 → 実装**

```ts
// app/src/data/content/otaDiff.ts
import type { Manifest } from '../../../tools/content/schema.ts'; // 型のみ(実行時importなし)
export function diffManifest(remote: Manifest, cachedShas: Record<string, string>): string[] {
  return Object.entries(remote.files).filter(([p, e]) => cachedShas[p] !== e.sha256).map(([p]) => p);
}
```

Run: `cd app && node --import tsx --test src/data/content/otaDiff.test.ts`
Expected: PASS

- [ ] **Step 3: ota.ts(RN実行時・逐次DL＋キャッシュ)を実装**

`data/vocabAudio.ts` の `expo-file-system/legacy` 利用パターンに合わせる。骨子(実装時に legacy API 名を vocabAudio と突き合わせる):

```ts
// app/src/data/content/ota.ts — Pagesから変更/新規ファイルを逐次DLして端末キャッシュへ。読みはキャッシュ優先。
import * as FS from 'expo-file-system/legacy';
import { BUNDLED } from './bundled.generated';
import { diffManifest } from './otaDiff';

const BASE = 'https://jinkato2020.github.io/safa-JLPT/content/';
const DIR = FS.cacheDirectory + 'content/';
const cache = new Map<string, unknown>();      // path→parsed(セッション内メモ)
let cachedShas: Record<string, string> = {};

export async function syncContent(): Promise<void> {
  try {
    await FS.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    const shaPath = DIR + '_shas.json';
    cachedShas = JSON.parse(await FS.readAsStringAsync(shaPath).catch(() => '{}'));
    const remote = JSON.parse(await (await fetch(BASE + '_manifest.json')).text());
    const todo = diffManifest(remote, cachedShas);
    for (const p of todo) { // 逐次(順次)DL=帯域を独占しない
      const res = await fetch(BASE + p);
      if (!res.ok) continue;
      const text = await res.text();
      const local = DIR + p.replace(/\//g, '__');
      await FS.writeAsStringAsync(local, text);
      cache.set(p, JSON.parse(text));
      cachedShas[p] = remote.files[p].sha256;
    }
    await FS.writeAsStringAsync(shaPath, JSON.stringify(cachedShas));
  } catch { /* オフライン/失敗は無害: bundledで継続 */ }
}
export function getContentFile(path: string): unknown {
  if (cache.has(path)) return cache.get(path);
  return (BUNDLED as Record<string, unknown>)[path];
}
```

- [ ] **Step 4: 起動時にキャッシュ済みファイルを先読みして rehydrate に渡す**

`ota.ts` に、起動時 `DIR` のキャッシュ済みJSONを読み込んで `cache` を温める `preloadCache(): Promise<void>` を追加(実装は `FS.readDirectoryAsync(DIR)` → 各ファイル read → `cache.set`)。`rehydrateBanks` に渡す `files` を「BUNDLED を getContentFile で上書きしたマップ」にする合成関数 `currentFiles()` を用意する。

- [ ] **Step 5: Commit**

```bash
cd app && git add src/data/content/ota.ts src/data/content/otaDiff.ts src/data/content/otaDiff.test.ts && git commit -m "feat(content): Pages逐次OTA(manifest差分DL＋キャッシュ)"
```

### Task 5: Pages公開＋起動時sync配線

**Files:**
- Modify: `.github/workflows/ios-build-jlpt.yml`(deploy-pages に content 追加)
- Modify: `App.tsx`(起動後に `syncContent()` を発火。次回起動でキャッシュ反映)

- [ ] **Step 1: deploy-pages に content を publish**

`ios-build-jlpt.yml` の `_site` 構築ステップ(`cp -r assets/audio _site/assets/audio` の並び)に追加:

```bash
          [ -d content ] && cp -r content _site/content || true
```

- [ ] **Step 2: 起動時に sync 発火(描画をブロックしない)**

`App.tsx` の hydrated 後の `useEffect`(テレメトリ初期化の隣)に:

```ts
    void import('./src/data/content/ota').then((m) => m.syncContent());
```

(取得は非同期・失敗無害。反映は次回起動=rehydrate が currentFiles を読む。)

- [ ] **Step 3: 型・テスト・push**

Run: `cd app && npm test 2>&1 | grep -E "^ℹ (pass|fail)" && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: pass 全緑・tsc 0。

```bash
cd app && git add -A && git commit -m "feat(content): content をPages公開・起動時に逐次sync" && git push origin main
```

- [ ] **Step 4: 簡易リリースの手順を README 化**

`app/content/README.md` 末尾に運用手順を追記: 「①該当 `content/**.json` を編集 → ②`node --import tsx tools/content/build_content.ts`(manifest再計算＋barrel再生成)→ ③`git push`(deploy-pages がPages更新)→ ④各端末が次回起動で差分DL」。

---

## Self-Review(spec/計画1 対応)

- 設計書§5(取得・キャッシュ・読込) → Task 4/5。
- §2「baselineは同梱・同期起動維持」 → Phase A(bundled barrel + rehydrate)。
- §連動(旧shape互換で consumer 無変更) → Task 2/3 + 223テスト等価ゲート。
- §簡易リリース(manifest差分・逐次DL) → Task 4/5 + README手順。
- 旧バンク削除 → Task 3 Step 5。
- 音声は対象外 → 記載済み。

**Placeholder scan**: 実装コードは各stepに提示。RN実行時(ota.ts Step4/preloadCache)は骨子＋具体API(`expo-file-system/legacy`)を指定し、正確なlegacy API名は vocabAudio.ts と突き合わせる指示を明記(唯一の外部依存確認点)。

**Type consistency**: `rehydrateBanks` の返却キーは Task 2 定義と Task 3 の export で一致。`diffManifest`/`getContentFile`/`syncContent` は Interfaces と実装で一致。旧 `*BankItem`/`ReadingItem` 等は `data/index.ts` の既存interfaceを流用(名称不変)。
