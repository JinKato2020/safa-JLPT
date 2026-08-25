# 走行中: 用法N4 残りカバー作問(中バッチ120語)

## 目的(2026-08-25)
N4用法カバー 223/673(33%)。未カバー450→候補371(katakana/接尾/代名詞除外)。
今回は先頭120語を作問(良問のみ採用・弱い語はskip)。ユーザー中バッチ指定。

## 制約(ユーザー厳命)
- 級内(N4以下)語彙・漢字のみで作文。全漢字にふりがな・文節分かち書き。
- 同音異字は誤答にしない(ルビで読み一致=非一意/複数正解化を禁止)。
- 誤答多様性=番人P1(repl3つユニーク)+P2(type2種以上)。type語彙8種=近接/選択/コロケ/別義/自他/対義/授受/呼応。
- 一意性あやしい誤答はcertainty=borderline→Excelで着色(ユーザー目視)。

## パイプライン
- 入力: scratchpad/usage_new_batch_{1..4}.json(各30語 vocabId/word/reading/meaning)。
- 4 Opusサブエージェントが各batchを作問→scratchpad/usage_new_result_{1..4}.json へWrite・本体には1行サマリのみ。
- 適用: (未作成)tools/apply_usage_new.py で id連番=N4-V-Y-0224〜 を採番しusage_N4.jsonへ追加＋sidecar tags追記＋番人(usageDistractor/usageCoverage)＋確認用Excel(borderline着色)。
- 次id起点=N4-V-Y-0224。

## 状態(2026-08-25) — 中バッチ完了・ユーザー目視待ち
- 4体完了(採用91)。apply_usage_new.pyで適用=90問追加(N4-V-Y-0224〜0313)。n4-v-141「別」はN3既カバーで除外(needs_manual1)。
- 番人green(usageDistractor/usageCoverage 7/7)。N4カバー breadth 225→315/673(33→47%)・backlog358。
- 確認用Excel=用法N4_新規作問_確認用.xlsx(borderline12セル橙)。**ユーザー目視中**。未コミット。
- apply_usage_new.pyは他用法ファイル(N3/N5)のvocabIdも除外するよう修正済(全大問通算の番人対応)。

## 次の一手
ユーザー目視フィードバック反映→(必要なら差替)→未コミット分をコミット/Push(ユーザー指示時)。
残りN4 backlog358・N3未着手。配信はOTA manifest再生成(ユーザー指示待ち・勝手にbuild/publishしない)。

## 関連
- 番人=src/data/usageDistractor.test.ts / usageCoverage.test.ts、sidecar=src/data/shared/usageDistractorTags.json
- 旧型4択化の別inflight=memory/usage-reduce-inflight.md
