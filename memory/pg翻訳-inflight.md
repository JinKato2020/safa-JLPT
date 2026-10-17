# 文章の文法(passage_grammar) 全210セット en/ne 翻訳 — inflight（/clear耐性）

## 目的（ユーザー確定 2026-08-23）
文章の文法は現状**全210セット翻訳ゼロ**。**本文＋選択肢**を en/ne 両方へ翻訳（設問文は存在しない＝空所【n】が設問）。範囲＝全210（N5 80/N4 60/N3 70）。見積り約¥300〜400（Gemini2.5Flash・thinkingBudget0・実費はD2で最後に報告）。

## 実行物（scratchpad/pgtrans/）
- `gen.mjs` … 生成。`node gen.mjs`(全)/`--lang en|ne`/`--batches N`(先頭N)/`--batch 8`(1コールのセット数)。out/<lang>/batchNN.json に保存・**済バッチは飛ばす(再開可)**。usage→`_usage.json`。
- `apply.mjs` … 反映。`node apply.mjs`(検査のみ)/`--apply`(本体へ書込)。set.i18n.{lang}.body=[本文訳]・question.i18n.{lang}.choices=[4](元順)。インデント(N5=1/N4=2/N3=1)・CRLF保持。欠け/構造不良を集計表示。

## 仕組み側の変更（コード・済）
- `src/data/content/rehydrate.ts` PASSAGE_GRAMMAR: **en.body→PASSAGE_TRANS_EN 結線追加**＋各questionの i18n.{ne,en}.choices→**Q_TRANS_{NE,EN}**(q=''でstem無し)。描画は既存 PassageSetPlayer が qtr[q.id].choices を選択肢下に表示済(改修不要)。

## ✅完了（2026-08-23）
- 全210セットの本文＋選択肢を en/ne へ翻訳・反映済み。
- gen(全53コール$0.51)＋body reshape(1本文の改行分割を\n結合)＋repair(ne欠け/不良13件を1セット単位で再生成$0.02)。**実費 合計 約$0.54 ≒ ¥82**(Gemini2.5Flash・thinkingBudget0)。
- apply.mjs --apply で set.i18n.{ne,en}.body・question.i18n.{ne,en}.choices を格納(CRLF/indent保持・欠け0/構造不良0)。
- rehydrate.ts に en.body＋pg選択肢訳(Q_TRANS)結線済。manifest再生成済(bundledは不変=既存ファイル内追加のみ)。
- テスト `passageTransNe.test.ts` KNOWN_PG_UNTRANSLATED=210→0・コメント更新。**tsc0・passageTransNe/rehydrate/passageGrammar/Wire 全14緑**。

## 残（ユーザー判断）
- コミット指示待ち。反映は次ビルド(区切りで)。UI/描画は既存対応済ゆえ表示はビルド後に確認可。
- scratchpad/pgtrans は用済み(コミット後クリーン可)。
