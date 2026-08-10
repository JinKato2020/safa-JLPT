# 進行中: 問題IDの命名統一（読解＋文字語彙＋文法）

ユーザー要望: 全問題IDを `Level-Section-Daimon-NNNN` の一貫スキームに。今のIDは乱れ・記号が意味不明。

## 確定スキーマ
| 区分 | 区分記号 | 大問→記号 |
|---|---|---|
| 読解 | D | 短文S / 中文M / 長文L / 情報J |
| 文字語彙 | V | 漢字読みK / 表記H / 文脈規定B / 言い換えI / 用法Y |
| 文法 | G | 文法形式G / 組み立てK / 文章の文法S |
例: N3-D-S-001, N4-V-K-0001, N3-G-K-0001（文法形式はG-G）。連番は level×section×daimon ごと。

## 現状調査（実測）
- 読解: 重複なし(670本/889問ユニーク)。設問IDは既に `Lv-D-{L/C/T}-NNN`＋情報は `Lv-joho-bNNN-qK`。文章IDが乱れ(`r-N3-cho-1` と `r-N3-cho-N3-D-L-001` 混在)。設問記号は 短=T/中=C/長=L(希望S/M/L)。
- 文字語彙/文法: 内部unit idは **構造付き**（`vocabId#daimon` / bank id `kb-NNNNNN` / pointId）。

## 重要: 影響範囲（ここが肝）
- 読解の設問IDは**ただの状態キー**→付け替えやすい（ただし進捗migration要・PASSAGE_TRANS_NEは文章IDキー→要更新）。
- 文字語彙/文法のIDは**構造依存**が多数: facetMap(`unit.slice(0,#)`で語ID抽出)・saveRef・coverage・daimon索引(KR/OG/CTX/SY_BANK_INDEX)・SENTENCE_FURI(bank idキー)。
  → **平坦IDに実置換すると全部壊れる**。安全案=内部IDは維持し「表示IDだけ」きれいにする。

## 確定方式（ユーザー決定 2026-08-10）
- **読解(D)= 実データ置換 ＋ 進捗移行**（文章ID・設問IDともJSONを書き換え）。→ **✅完了 2026-08-10**。
- **文字語彙(V)・文法(G)= 表示IDのみ**（内部データ/状態/仕組みは不変・画面表示だけ整形）。→ **未着手**。
- 文法形式は G-G（区分G＋大問G）で確定。

## ✅ 読解(D) 実装済み（2026-08-10・コミット済/未ビルド）
- 文章id=`Lv-D-{S/M/L/J}-NNN`（S=短文/M=中文/L=長文/J=情報検索・ファイル配列順で連番）、設問id=`<文章ID>-qK`（K=1..）。670文章/889問・衝突0・新旧id重複0。
- 書換=Pythonスクリプト(json.dumps indent=1 ensure_ascii=Falseで元整形維持=id行だけdiff)。→ `node --import tsx tools/content/rebuild.ts` で bundled.generated.ts と content/_manifest.json 再生成。
- PASSAGE_TRANS_NE は rehydrate が `it.id`(文章id)から実行時生成＝**自動追従**（手修正・キー更新は不要だった）。
- 状態移行: `src/data/exam/readingIdMigration.json`（旧設問id→新設問id）＋ `src/store/storage.ts` の `migrateReadingIds`（loadStateでmigrateBankIdsの次に適用・冪等）。回帰テスト `src/store/readingIdMigration.test.ts`（package.jsonのtestに登録済）。
- 読解idはアプリ全体で **状態キーのみ**（idsRingPct/coverPct等が `state.items[qid]` 参照・passage idは状態キーでない）。src他所からの参照なし＝低リスク。
- **要ビルド**で実機反映（migrateReadingIdsはアプリコード）。content-OTA単独だと旧バイナリで一時的に読解進捗が合わない可能性→ビルドと同時配信が安全。

## 実行手順（次セッションで）
### 読解（実データ置換＋移行）
1. 旧ID→新ID対応表を生成: 文章 `Lv-D-{S/M/L/J}-NNN`（level×subtype昇順で連番）/ 設問 `<文章ID>-qK`。
   subtype→記号: naiyou_tan=S, naiyou_chu=M, choubun=L, joho=J。
2. content/problems/dokkai/*.json を新IDで書き換え（passage id・questions[].id）。
3. PASSAGE_TRANS_NE のキー（文章ID）を新IDへ更新（データ源を特定して同時に）。
4. 状態移行: src/store に旧設問ID→新設問IDのmap migrationを追加（hydrate時にstate.items/masteryのキーを付替）。既存のkbIdMigration方式を踏襲。回帰テスト追加。
5. `node --import tsx tools/content/rebuild.ts` で _manifest.json 再生成（OTA）。
6. tsc＋テスト（passageSet/passageGrammarWire/sync/migration）→ コミット。OTA配信。

### 文字語彙・文法（表示IDのみ）
1. 表示ID生成: content から level×section×daimon ごとに内部id安定ソート→連番→ `displayId` map を build時生成（src/data配下の生成ファイル or 実行時memo）。
   - V: 漢字読みK/表記H/文脈規定B/言い換えI/用法Y。内部源=KANJI_READ/ORTHOGRAPHY/CONTEXT/SYNONYM_BANK＋KNOWLEDGE_BANK(usage)。
   - G: 文法形式G/組み立てK/文章の文法S。内部源=KNOWLEDGE_BANK(grammar_form/order)＋passageGrammar設問。
2. ヘッダー差し替え: QuizScreen `sub={question.itemId ?? answerId}` → 表示ID。PassageGrammarScreen も。ReadingScreenは読解の新実IDをそのまま表示。
3. データ・状態・facet・saveRefはノータッチ＝無リスク。アプリコードなので反映は次ビルド。

## 反映経路
- 読解=OTA（content）。表示ID(語彙文法)=アプリコード=次ビルド。

## 表示ID方式の実装メモ（(a)採用時）
- 生成: content から level×section×daimon ごとに内部idを安定ソート→連番→ `displayId` map を build時生成(src/data配下)。
- 表示差し替え: ReadingScreen `sub={set.id}` → 表示ID。QuizScreen `sub={question.itemId ?? answerId}` → 表示ID。ListeningScreenも同様に整理可。
- データ・状態・facet・OTicはノータッチ＝無リスク。

## 実行の方針
大改修＋当セッションcontext特大のため、**方式決定後に fresh session(/clear)で実行推奨**。この md に全決定を保存済み。
