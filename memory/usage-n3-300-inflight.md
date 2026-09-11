# INFLIGHT: N3 用法 300問 新規作成（/clear をまたぐ・2026-09-11）

目的＝**N3「用法(⑤文字・語彙)」を300問 新規作成**。ユーザー指示＝「検証と修正は不要／それ以外の品質はすべて満たす／既出単語は除外」。
モデル＝Opus（品質重視・[[quality-critical-gen-use-opus]]）。**外部有料APIは不使用＝全てClaudeクォータ内**（円の外部課金¥0）。規模＝生成Opus15体＋ふりがなOpus約12体。

## ✅完了（2026-09-11・全ステップ済）
- 生成WF `wf_e7bbdd52-12b`＝300問/重複0/targets完全一致/空バッチ0（uniqRisk high10/mid62）。ふりがなWF `wf_72bd9689-e50`＝1435文/検算不一致0。
- 適用済＝**usage_N3 900→1200問**・P1違反0・内容不一致0・mono10。※2026-09-11 欠番掃除で全体を `N3-V-Y-0001..1200` に連番化（handoff「欠番掃除」参照）。
- **取りこぼし修正**：apply が uniqRisk/uniqNote を本番へ持ち込んでいなかった→(a)新300問へ後付けパッチ済(high10/mid62)、(b)`tools/apply_usage_n3_300.py` に保持ロジック追加(今後分)。
- カバー率：N3用法 breadth 56%(1195/2145)・1語1問。一意性Excel `一意性チェック_通常_N3.xlsx`＝赤10/黄111（自己申告反映済・最終判断はユーザー）。
- 在庫チェーン更新済（総20407・N3フル模試25回分）。OTA `_manifest.json`＋barrel 再生成済。番人20/20緑。
- **未コミット・ビルド/publishはしていない**（指示待ち）。Sep5残骸は `_sep5_done/`。

## 済み（このinflight作成前に完了）
- ✅ 対象語選定：`python tools/pick_usage_targets_n3.py 300` 実行済み → **既出除外済み300語**（`content/problems/moji_goi/usage_{N4,N3}.json` の使用vocabIdを除外）。POS=verb72/noun150/擬態54/adj24・RED24/YELLOW49/clean227・backlog総数1250。
  - 出力：`scratchpad/usage_n3_300/targets.json`（正本）／`用法N3_作問対象300_確認用.xlsx`（リスク色付きレビュー）
- ✅ 生成WF生成：`python tools/gen_usage_workflow.py 20` 実行済み → `scratchpad/usage_n3_300/wf_usage_N3.mjs`（15体・各20語・Opus high・検証なし・自己検算＋uniqRisk自己申告＋P1/P2ダミー多様性＋名前/ルビ禁止＋上級漢字は同音異字ダミー禁止）。

## /clear後にやること（この順・スクリプトは既存・新規に書かない）
1. **生成WF起動**：Workflowツールで `scriptPath = scratchpad/usage_n3_300/wf_usage_N3.mjs`（run_in_background 既定）。完了通知を待つ（ポーリングしない＝A4）。
   - 戻り値 `{ level, good, emptyBatches }`。**`good`（配列）を `scratchpad/usage_n3_300/all300.json` に Write**（apply の入力。形＝`[{vocabId,word,correct,distractors[{sentence,repl,type}], (uniqRisk?,uniqNote?)}]`）。`emptyBatches>0` なら該当バッチだけ再生成。
2. **ふりがなWF生成→起動**：`python tools/gen_usage_furigana_wf.py` → `wf_usage_furi.mjs`（100文×約12体・MeCab下書きをOpus校正）。Workflowで起動→戻り値を **`python tools/build_usage_furout.py`** で `furout_300.json` に組み立て（I/Oは各スクリプト冒頭のdocstringで確認）。
3. **適用（DRY→書込）**：`python tools/apply_usage_n3_300.py`（DRY・P1違反0/内容不一致0を確認）→ 問題なければ `python tools/apply_usage_n3_300.py --write`。
   - `content/problems/moji_goi/usage_N3.json` に `N3-V-Y-NNNN` で追加＋`src/data/shared/usageDistractorTags.json` 更新＋mono型登録。**P1(repl全別)違反があれば自動中止**＝番人。
4. **カバー率更新**：`python tools/update_usage_coverage.py` → `python tools/usage_coverage_report.py`。
5. **一意性レビューExcel**：`python tools/quality_excel.py` → `一意性チェック_通常_N3.xlsx`（🔴high/🟡mid色付け）。**一意性の最終判断はユーザー**（[[uniqueness-self-declaration-in-generation]]）。
6. **在庫再生成チェーン**（[[stock-record-to-excel-not-txt]]）：stock_report → mock_stock → stock_excel → daimon --xlsx。
7. **OTA配信の目録**：content編集後は `_manifest.json` 再生成が要る（[[ota-manifest-regen-or-stale]]）。ビルド/publishはユーザー指示時のみ。
8. 報告：新規問数・id範囲・空バッチ・P1/mono件数・一意性Excel絶対パス。**ビルドはしない**（[[never-build-without-explicit-order]]）。

## 注意
- 番人テスト＝`usageDistractor.test.ts`(P1/P2)・`usageCoverage.test.ts`・`grammarExclude`系。applyがP1で自動中止するので手戻り最小。
- scratchpad は**リポジトリ直下**（`JLPTアプリ/scratchpad/usage_n3_300/`）＝/clear後も残る。
- 検証WF(`build_usage_verify_wf.py`)は**使わない**（ユーザー指示＝検証不要）。
