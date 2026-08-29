# 用法N3 新規300問 追加（進行中・生成のみ＝検証/反証なし）

## 目的（ユーザー指示 2026-08-29）
用法N3をこれまでの方法に沿って新規300問追加。**生成のみでよい（検証・反証エージェント不要）**。

## 現状の起点
- usage_N3.json=300問(N3-V-Y-0001..0351)・baseline covered=295/total2145(14%)・backlog=1819(RED除外後)。
- 対象語=300(RED除外・clean255/YELLOW45・POS verb173/noun96/onoma26/adj5)。

## パイプライン（gen-only）
1. 候補: `NO_RED=1 python tools/pick_usage_targets_n3.py 300`
   → scratchpad/usage_n3_300/targets.json ＋ 用法N3_作問対象300_確認用.xlsx（ROOT）
   （pick_usage_targets_n3.py は N引数対応＋targets.json出力＋NO_RED環境変数を追加済）
2. 作問WF生成: `python tools/gen_usage_workflow.py 20`（新ツール）→ wf_usage_N3.mjs（15体×20語）
3. **作問run: （下に記入）** 出力={vocabId,word,correct,distractors[{sentence,repl,type}]×3}
4. harvest → all300.json（apply入力のcontent側）
5. ふりがなWF（gen_polish系 or 専用）→ furout（word_ruby/answer_ruby/distractors_ruby）
6. apply（apply_usage_n3_200.py を300/新OD対応に一般化）→ usage_N3.json追記＋usageDistractorTags更新
7. 番人: usageDistractor.test / usageCoverage.test（node --test）
8. 確認Excel: build_usage_n3_review_xlsx.py（or regen_usage_confirm_xlsx.py）
9. coverage baseline: `python tools/usage_coverage_report.py --set-baseline` ＋ 在庫Excel更新
10. manifest再生成 → publish-content/build（ユーザー合図）

## run ID
- 作問(gen-only): wf_11062d49-05f（✅完了・15体0err・300問）→ all300.json（P1違反0/重複0/word不一致0/欠け0・P2単一type2件=monoType許容）
- ふりがな: wf_fb1db062-df7（✅完了・15体0err・1459文）→ furout_300.json（検算mismatch0/欠落0）

## ✅DB適用まで完了（未コミット・未配信）
- **apply_usage_n3_300.py --write 実行済**＝usage_N3.json **300→600**（新id N3-V-Y-0352..0651・全distinct vocabId）。usageDistractorTags 更新（tags300追加・monoTypeAllow+2）。
- 番人: usageDistractor/usageCoverage **7/7 pass**。tsc0。manifest再生成済。
- **N3カバー率 295→595（14%→28%）**・backlog1550・重複0。usageCoverage.json baseline更新済（N3 covered595）。⑤用法カバーExcel再生成済。
- 確認Excel（ユーザー目視用）=`用法N3_新規300_確認用.xlsx`（ROOT・300行・YELLOW45=漢字級>N3/mono2）。tools/build_usage_n3_review_300.py。
- 新ツール: gen_usage_workflow.py / gen_usage_furigana_wf.py / apply_usage_n3_300.py / build_usage_n3_review_300.py。pick_usage_targets_n3.py=N引数+targets.json+NO_RED拡張。

## 残（ユーザー判断）
- (a)配信＝commit→push（OTA=ne無し・用法はi18n空ゆえOTAで即反映／端末は次回起動でDL）。「Build」なら tools/build.ps1 -Approved -NoWatch。
- (b)①在庫まとめ/②カバー率シートの用法N3行(旧299/150)を600へ整合（bookkeeping・stock_report系）。⑤は更新済。
- (c)確認Excelのユーザー目視（gen-onlyゆえ第2正解の最終確認は人手）。

## ルール正本
- md/05_用法.md（近接類義置換・罠タクソノミー・P1/P2多様性・★実バグ=第2正解禁止）
- 級内(N5/N4/N3)・同音異字ダミーは漢字>N3で不可・1語彙id=1問(全大問通算重複禁止)
