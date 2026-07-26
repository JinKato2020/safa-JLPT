# knowledgeBank 多言語解説アーキテクチャ 設計書

**日付**: 2026-07-11
**対象**: `app/src/data/exam/knowledgeBank.json`（5727問）に非日本語9言語の解説(explain)を追加できるデータ基盤を作る。
**状態**: 設計承認済み（2026-07-11・ユーザー「進めて」）。本specは器（ID・分離・ローダー・配信・テスト）を作る。翻訳生成そのものは別ジョブ。

---

## 1. 目的とゴール

現状の knowledgeBank エントリで言語依存なのは実質 `explain`（解説・平均79字・ふりがな付き）のみ。問題本体（`stem/question/choices/answer`）は日本語の学習対象であり翻訳しない。

7言語（実際は非日本語9言語に完備）ぶんの解説を追加するにあたり、解説をエントリ内に `explainEn/explainZh/…` と直接足すと:
- ファイルが 4.4MB → 推定8〜20MB に膨張し、RN が起動時に同期パースするためカクつき＋メモリ増。
- 全ユーザーが使わない他言語まで常時アプリバイナリに同梱される。

これを避け、**問題本体と解説翻訳を分離し、日本語だけ同梱・他言語は Pages 配信＋端末キャッシュ**にする。あわせて、分割・翻訳紐付け・将来の大問分割すべての土台となる**不変ID**を各問題に付与する。

### 成功基準
1. knowledgeBank 全5727問に永続の連番id（`kb-000001`）が付き、以後の並べ替え・分割・重複除去で状態キーが壊れない。
2. 解説が id をキーに言語別ファイルへ分離され、日本語は同梱、非日本語は Pages から取得＋キャッシュされる。
3. 解説表示は「要求言語 → 日本語」フォールバックで、取得失敗・部分欠落でもクラッシュしない。
4. 既存テスター の学習履歴（bank問題の進捗）が id 変更で失われない（移行マップで付け替え）。
5. tsc 緑・全テスト pass。実データを読むテストでランタイム解決も実証。

---

## 2. スコープ

### 本specでやる（実装計画の対象）
- 不変ID `kb-000001` の付与と、状態キー移行（旧 `bk:<level>:<daimon>:<index>` → 新 id）。
- 解説の L10n 分離: `explain.ja.json`（同梱）・`explain.<lang>.json`（非ja・Pages配信）・core からの `explain`/`explainNe` 除去。
- フォールバック付きローダー `explainL10n.ts`（ja同梱同期＋非jaランタイム取得＋端末キャッシュ＋バージョン無効化）。
- Pages 配信配線（`assets/l10n/explain.<lang>.json`）。
- ツール（id付与・explain抽出）とテスト一式。

### 本specでやらない（別ジョブ・依存関係のみ記載）
- **9言語の翻訳生成そのもの**: CLAUDE.md 規定どおり `../多言語教材/` に委譲。有料一括（Sonnet 概算 ¥8,000〜12,000）＝**別途、円見積り提示→承認**してから実行。本specはローダーとファイル形式（空/部分でも動く）を用意し、翻訳が入り次第そのまま反映される状態にする。
- **大問分割（③）**: 安定ID導入後はいつでも安全に可能。今回は見送り。core を daimon 別ファイルにする作業は別spec。

---

## 3. データモデル

### 3.1 不変ID
- knowledgeBank 全エントリに `id: "kb-000001"` を付与（`kb-` ＋ 6桁ゼロ埋め連番）。
- **現在の配列順**で一度だけ採番し、以後**永久固定**（並べ替え・追加・削除・分割で既存idは変えない。新規追加は最大値+1）。
- 採番は `tools/assign_kb_ids.mjs` で一度だけ実行し、結果を knowledgeBank.json に書き戻す。

### 3.2 core（knowledgeBank.json）
採番後、`explain` と `explainNe` を**削除**。core の各エントリは:
```json
{ "id": "kb-000123", "level": "N4", "daimon": "usage",
  "stem": "…", "question": "…", "choices": ["…"], "answer": "…" }
```
core サイズは 4.4MB から約3.9MB（explain除去分）に縮小。

### 3.3 解説ファイル（id→訳文の平坦マップ）
```
app/src/data/exam/explain.ja.json      … {"kb-000001":"…日本語解説(ふりがな付)…", …}  ← 同梱
app/src/data/exam/l10n/explain.ne.json … {"kb-000001":"… नेपाली …", …}                ← 非ja・Pages配信
app/src/data/exam/l10n/explain.en.json … （en/zh/ko/vi/th/id/my/bn/ne の9言語）        ← 非ja・Pages配信
```
- `explain.ja.json`: 現 `explain` から全5727件を抽出。**同梱**（バンドル）。
- `explain.ne.json`: 現 `explainNe`(983件) を移送して初期投入（残りは翻訳ジョブで補完）。
- 他8言語: 空 or 部分でよい（翻訳ジョブが後で埋める）。ローダーは欠落を ja フォールバックする。
- 非ja ファイルは `l10n/` サブフォルダに置き、**バンドルには含めず** Pages にのみ publish。

### 3.4 状態キー移行
- 現状の進捗/習得度は `bk:<level>:<daimon>:<arrayIndex>` をキーに保存。
- id を新 `kb-000001` に一本化するため、旧→新の**移行マップ** `exam/kbIdMigration.json`（`{"bk:N4:usage:12":"kb-000123", …}`）を id採番時に自動生成。
- アプリ起動時に一度だけ、state 内の bank由来キー（`bk:` 接頭）を移行マップで新idに付け替え。移行済みフラグ（`state.migrations.kbIdV1 = true`）で二重実行を防ぐ。
- 旧idは現配列順から決定的に再現できるため、移行マップは網羅的かつ全単射。

---

## 4. `daimon.ts` の変更

現状:
```ts
export const BANK: BankUnit[] = (KNOWLEDGE_BANK as Omit<BankUnit,'id'>[])
  .map((b, i) => ({ ...b, id: `bk:${b.level}:${b.daimon}:${i}` }))
  .filter((b) => !(b.daimon === 'order' && b.ambiguous));
```
変更後:
```ts
export const BANK: BankUnit[] = (KNOWLEDGE_BANK as BankUnit[])   // id は data に焼込済
  .filter((b) => !(b.daimon === 'order' && b.ambiguous));
```
- `BankUnit.id` は data 由来（`kb-…`）。index 依存を廃止。
- `explain`/`explainNe` はもう core に無いので、`questionForUnit()` は解説を **ローダー経由**で解決する（下記）。

---

## 5. ローダー `app/src/data/exam/explainL10n.ts`

### API
```ts
// 同期: ja のみ即返し（同梱map）。UI初期表示はまず ja、非jaは非同期差し替え。
export function explainJa(id: string): string | undefined;

// 非同期: 要求言語→ja フォールバック。
export async function getExplain(id: string, lang: string): Promise<string>;

// 言語ファイルを一括プリフェッチ（言語切替時/試験開始時に1回）。失敗は握りつぶす。
export async function prefetchExplain(lang: string): Promise<void>;
```

### 取得・キャッシュ戦略
- ja: `explain.ja.json` を同梱 import。`explainJa(id)` は同期。
- 非ja `<lang>`:
  1. メモリキャッシュ（`Map<lang, Record<id,string>>`）にあれば即返し。
  2. なければ端末キャッシュ `documentDirectory/l10n/explain.<lang>.json` を読む。
  3. なければ Pages `${PAGES_BASE}/assets/l10n/explain.<lang>.json` を1ファイル取得→端末キャッシュ→メモリ。
  4. いずれも無ければ、その id は `explainJa(id)` にフォールバック。
- **項目ごとフェッチはしない**（1言語＝1ファイルを丸ごと取得）。
- `EXPLAIN_CACHE_VERSION` 定数。内容更新時に+1すると端末の `l10n/` キャッシュを破棄（`vocabAudio.ts` の `AUDIO_CACHE_VERSION` と同型）。
- FS API は `expo-file-system/legacy`（SDK54の罠回避・既存メモ [[expo-fs-legacy-sdk54]] 準拠）。

### 表示への配線
- `questionForUnit()` は解説文字列を持たず、`itemId`(=id) を返すだけにするか、`explainJa(id)` を即時にセット。
- 解説を表示する画面（Quiz/Mock の解答後解説）で、現在の `settings.language` に対し `getExplain(id, lang)` を呼び、返り次第テキストを差し替え（初期は ja、非同期で母語へ）。
- `explainNe` を直接参照している既存箇所があれば `getExplain(id,'ne')` に置換。

---

## 6. Pages 配信

- `ios-build-jlpt.yml` の `deploy-pages` ジョブで、`app/src/data/exam/l10n/explain.*.json`（非ja）を Pages 出力の `assets/l10n/` にコピーして publish。
- ja は同梱のみ（Pages にも置いてよいが必須ではない）。
- URL 構造: `https://jinkato2020.github.io/safa-JLPT/assets/l10n/explain.<lang>.json`。既存の音声URL構造（`assets/audio/…`）を壊さない（メモ [[merge-pages-into-build-workflow]] 準拠）。

---

## 7. ツール（`app/tools/` ・一度きり実行）

- `assign_kb_ids.mjs`: knowledgeBank.json を読み、現配列順で `id: kb-NNNNNN` を付与して書き戻し、`exam/kbIdMigration.json`（旧`bk:…`→新id）を出力。
- `split_explain.mjs`: knowledgeBank から `explain`→`explain.ja.json`、`explainNe`→`l10n/explain.ne.json` を抽出し、core から両フィールドを削除。空の `l10n/explain.<lang>.json`（他8言語）を雛形生成。
- これらは再現可能なワンショット変換。実行後、生成物（id付きcore・explain.*.json・migration）を commit。

---

## 8. エラーハンドリング

- 非ja ファイルの取得失敗（ネット無し/404）→ 例外を握りつぶし ja フォールバック。オフラインでも ja で必ず表示。
- 言語ファイルはあるが当該 id が欠落（翻訳未完）→ その id だけ ja フォールバック。
- 生成データ走査は null ガード＋ node 実行で検証（真っ白クラッシュ回避・メモ [[verify-runtime-not-just-build]] 準拠）。

---

## 9. テスト

- **id**: 全件に一意な `kb-NNNNNN` が付く／件数5727／採番が配列順で安定（再実行で不変）。
- **移行マップ**: 旧idの集合＝新idの集合が全単射。BANK の全ユニットが移行後 id で解決できる。
- **core**: `explain`/`explainNe` フィールドが core から消えている。
- **ローダー**: `explainJa(id)` が同梱で同期取得できる／非ja が欠落時に ja へフォールバック／`EXPLAIN_CACHE_VERSION` bump で端末キャッシュ破棄。
- **BANK**: 新idで再構築され、`order` の `ambiguous` 除外が従来どおり効く（件数一致）。
- **状態移行**: 旧キーを持つダミー state を移行すると新idキーに付け替わり、`migrations.kbIdV1` が立つ／二重実行しても冪等。
- 新規 `*.test.ts` は `app/package.json` の `test` スクリプトに追加。

---

## 10. リスクと対策

| リスク | 対策 |
|---|---|
| id変更で既存テスターの進捗喪失 | 移行マップ＋起動時一度の付け替え（§3.4）。旧idは決定的再現可＝全件移行。 |
| 非ja解説の初回オフライン | ja フォールバックで常に表示。プリフェッチは言語切替時に先行実行。 |
| 翻訳未完で解説が空 | 部分ファイルでも id 単位に ja フォールバック。翻訳は後から差分投入で反映。 |
| Pagesキャッシュが古い | `EXPLAIN_CACHE_VERSION` bump で端末破棄（音声と同型の既知手法）。 |
| 翻訳ジョブの無断課金 | 本spec対象外。別途 円見積り→承認（CLAUDE.md #2）。多言語教材へ委譲。 |

---

## 11. 実装順序（依存）

1. `assign_kb_ids.mjs` 実行 → core に id 付与＋移行マップ生成。
2. 状態移行ロジック（起動時・冪等）。
3. `split_explain.mjs` 実行 → explain.ja/ne 抽出＋他8言語雛形＋core から explain 除去。
4. `daimon.ts` を data由来 id に切替。
5. `explainL10n.ts` ローダー実装＋解説表示画面の配線。
6. Pages 配信に `l10n/explain.*.json` を追加。
7. テスト一式。
8. （別ジョブ）多言語教材で9言語翻訳を生成し `explain.<lang>.json` を充填 → 承認後に実行。
