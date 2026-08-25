# 走行中: 用法N4 残り一括作問(全backlog)

## 目的(2026-08-25 更新)
N4用法カバー 315/673(47%)。残り未カバー358→**作問候補277語**(カタカナ49・接尾/文法パターン32・指標除外を除外)。
ユーザー指示「残り一括作成」＝候補277語を一括作問。EXCEL出力＋borderline誤答はセル橙着色(従来どおり)。

## 制約(ユーザー厳命・従来同じ)
- 級内(N4以下)語彙・漢字のみで作文。全漢字にふりがな`漢字（かな）`・文節分かち書き(スペース区切り)。
- 同音異字は誤答にしない(ルビで読み一致=非一意/複数正解化を禁止)。
- 誤答多様性=番人P1(repl3つユニーク)+P2(type2種以上)。type語彙8種=自他/別義/近接/選択/コロケ/対義/呼応/授受。
- 一意性あやしい誤答は certainty=borderline→Excelで橙着色(ユーザー目視)。実バグ回避=誤答を正用文にしない。

## パイプライン(2026-08-25 実行中)
- 入力: scratchpad(session 21dfc579)/usage_new_batch_{1..10}.json(各27-28語 vocabId/word/reading/meaning)。
- 10 Opusサブエージェント(Agentツール)が各batchを作問→scratchpad/usage_new_result_{1..10}.json へWrite・本体には1行サマリのみ。
- 適用: `python tools/apply_usage_new.py --batches 10`(--sp既定=現行scratchpad)。id連番=N4-V-Y-0314〜採番→usage_N4.json追加＋sidecar tags追記＋番人＋確認用Excel(borderline橙)。
- 次id起点=N4-V-Y-0314(現max=0313)。
- 出力Excel=用法N4_新規作問_確認用.xlsx(ユーザー指定パス直下)。

## 状態(2026-08-25) — 一括作問 完了・ユーザー目視待ち
- Opus10体完了(候補277→採用252/agent skip25)。apply_usage_new.py --batches 10 で適用=**252問追加(N4-V-Y-0314〜0565)**。
- P2番人: 具体名詞18問が選択制限型(単一)=正当な良問。apply改修で選択/呼応の単一型を例外化＋monoTypeAllow自動登録。
- 番人 usageDistractor(P1/P2)・usageCoverage 7/7 green。coverage baseline更新済。
- **N4カバー breadth 315→567/673(47→84%)・backlog106**(=カタカナ49+接尾/文法32+dense synonym等skip25。これ以上の増産は実バグ・水増しリスクで非推奨)。
- 確認用Excel=用法N4_新規作問_確認用.xlsx(borderline誤答29セル橙)。**ユーザー目視中**。未コミット。
- apply改修点: --sp引数追加(現行scratchpad既定)、選択/呼応の単一型P2例外+monoTypeAllow自動登録。

## 目視フィードバック反映(2026-08-25)
ユーザー指摘7問の誤答を「明確に不自然」な文へ差替(多くは対象語が自然に使えてしまう非一意=運転が安心/指でつかむ/田舎で泳ぐ 等)。田舎/指のふりがな欠落も補完。
- 差替: 0321ごちそう/0379会場/0380安心/0385翻訳/0429田舎/0440指/0537簡単。全てP1/P2 green・certainty=clear化。
- 確認Excel再生成ツール新設=tools/regen_usage_confirm_xlsx.py(DB直読み・borderline橙)。→252問/borderline22セル。
- 在庫再集計: 用法N4=565問(誤答3:565)。①在庫・模試換算(在庫565/模試換算113)②カバー率(問題数565/カバー数567/85%)更新。⑤用法カバーは567/673=84%(baseline更新済)。
- ※①②のN3用法(150)はstock実値99とズレ(N3側の旧作業由来・今回対象外)。

## 次の一手
未コミット分をコミット/Push(ユーザー指示時)。N3用法は未着手(4%・別途)。配信はOTA manifest再生成(ユーザー指示待ち・勝手にbuild/publishしない)。

## 関連
- 番人=src/data/usageDistractor.test.ts / usageCoverage.test.ts、sidecar=src/data/shared/usageDistractorTags.json
- 作問ルール正本=md/05_用法.md、罠タクソノミー=[[usage-distractor-near-synonym]]
