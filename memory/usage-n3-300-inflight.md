---
name: usage-n3-300-inflight
description: N3用法 新300問 本走行(生成のみ・独立反証と修理なし)。ユーザー承認済。/clear後はこの1本で実行できる完全レシピ。
metadata:
  type: project
---

# N3用法 新300問 本走行（生成のみ・検証/修理なし）

**状態: 完了・配信済み（2026-09-12）。翻訳10言語＋Push済み。**
- 配信commit: `c35d5df8`(問題+訳・OTA) → `81f6e945`(★対訳ズレ修正) → `01f3be21`(タグsidecar+ツール改修)。全origin/main。
- ★事故と対処: c35d5df8で**既存890問の対訳が1つズレて前問の訳**になった(原因=採番ズレ後の陳腐化した`scratchpad/pg/trans_usage*_cache.json`を--writeが既存itemへid単位上書き)。81f6e945で既存1200をズレ前(HEAD~1)へ復元・新300は正しい訳を維持。汚染キャッシュは削除済。教訓=**trans_daimon --write はid絞り込みされず全cache適用ゆえ、既存翻訳済みへの再write前は必ずcacheの鮮度確認orクリア**。
- 翻訳: en/ne=trans_daimon.py usage、他7=trans_daimon_lang.py --lang、zh2=OpenCC(s2twp)。**TRANS_ONLY_IDS_FILEで新300に限定**(--applyのみ絞り込み効く)。実費 Gemini 2.5 Flash 約¥30。
- 別件(対応済 2026-09-12): usage_N3の既存未翻訳300問(id 901-1200)も全10言語翻訳し配信(commit `a179689d`)。**usage大問全2171問=未翻訳0**。今回は**キャッシュ削除→id限定apply→write**の安全手順でズレ再発なし(既存1871問 差分0を検証)。zh/bn/myは初回API失敗→--apply再実行で復旧(resumable)。
- 生成360→採用可327→**先頭300問を採用**（id `N3-V-Y-1201`〜1500）。usage_N3.json **1200→1500問**。
- runId=`wf_313a108c-fe7`（agent12・654kトークン・実費¥0）。
- 番人: usageDistractor(P1/P2/type/カバー) 4件パス・usageCoverage 3件パス。N3用法 breadth **70%**(1495/2145)。
- タグ: `usageDistractorTags.json` に300登録。mono良問49をmonoTypeAllowへ。
- uniqRisk: high6(verified:false=出題保留)/mid151/none143。一意性Excel `一意性チェック_通常_N3.xlsx`(🔴16/🟡262・新分= high6+mid151)でユーザーレビュー。
- 索引=`tools/usage_n3_new300_index.json`。在庫台帳/⑤カバー/在庫Excel 更新済。

## 未実行（ユーザー指示待ち・ここから）
1. **i18n 10言語対訳**（新300の正解文訳）＝翻訳フローで埋める（build `--fill`/`trans_daimon_lang.py`）。ビルド前に必要。
2. **OTA `_manifest.json` 再生成**（content編集後・publish時）。
3. **commit/publish/build**＝明示指示まで実行しない（[[never-build-without-explicit-order]]）。
4. 一意性Excelレビュー反映（highの6問・midの弱いもの＝例: 単なる「単なる可能性」等の第2正解疑い）。
5. 後始末(F3): `tools/usage_n3_candidates.json`・`tools/wf_usage_n3_gen.js` は用済み→commit前に削除（索引は記録として残す判断可）。

## 決定事項（ユーザー承認 2026-09-12）
- パイロット6問（離れる/貧しい/しかも/刺激/至急/騒ぎ）を生成→独立反証 → **6問全て unique**（第2の正解なし）。作り方OK。
- ユーザー指示＝**/clear後に「独立反証(検証)と修理」をなしで本走行を実行**。CLAUDE.md B3（独立verifyはトークン倍増ゆえ必要時のみ・自己検証を基本に）と一致。
- 一意性の最終判断は**生成時の自己申告(uniqRisk)＋一意性Excel**でユーザーがレビュー（§1自己申告フロー・`[[uniqueness-self-declaration-in-generation]]`）。
- モード＝**標準**（トークン最小・バッチ30）。品質＝**Opus high**（`[[quality-critical-gen-use-opus]]`）。
- 対象語＝**用法向きの語だけに絞る**（具体名詞は除外）。

## 現状（実測）
- N3用法 在庫 **1200問**（`content/problems/moji_goi/usage_N3.json`・全verified:true）→ 目標 **1500問**。
- id＝`N3-V-Y-0001`〜`N3-V-Y-1200`（連番）。**新id＝`N3-V-Y-1201`〜`N3-V-Y-1500`**。
- 未カバーN3語950・用法向き優先で候補420語を確定済。

## 対象語（確定・保存済）
- **`tools/usage_n3_candidates.json`**（420語=300目標+予備・全プール864）。未カバー・重複ゼロ・用法向き優先（動詞4/形容詞3/副詞42→名詞・あいさつ/明白な具体名詞は除外済）。**名詞寄りの構成**（動詞・形容詞はほぼ使い切り済＝残り約49語のみ）。
- 各語 `{vocabId, word, reading, meaning}`。ランク順に処理し、**非dropの先頭300問を採用**。

## item出力スキーマ（既存usage_N3.jsonに一致）
`{id, stem, question, answer, choices[4], i18n{10言語}, verified, vocabId}`
- gen agentが返すのは core＝`{vocabId, word, stem, question, answer, choices, distractorTags, uniqRisk?, uniqNote?, needsDrop?}`。
- `question` は既存に合わせ `"最もよいものはどれですか。"`（stemと同一で可）。`answer`=choices[0]。
- **i18nは後処理**（gen不要・トークン節約）＝用法対訳は「正解文(=choices[0])の10言語訳」。誤答文・文法パーツは訳さない（commit 80856c0d方針）。ツール＝翻訳フロー（`trans_daimon_lang.py`／build `--fill`）で埋める。
- **verified**: uniqRisk無し/mid → `true`（出題される）。uniqRisk="high" → `false`（Excelレビューまで出題保留）。

## 本走行の作法（Workflow・生成のみ）
1. Pythonでworkflowスクリプト生成: 候補420語をバッチ**30〜35**でJSリテラル埋め込み（**argsは使わない**＝undefined事故回避／CRLF禁止・`newline='\n'`＋`assert b'\r' not in`）。
2. `pipeline(BATCHES, gen)` の**gen 1段のみ**（独立反証・修理の段は作らない）。各agent=Opus high。
3. gen agentプロンプト＝下記「gen prompt」を各バッチの語を差し込んで使用。**自己検証を厳格化**（★実バグ代入チェックをプロンプト内で必須化）。
4. journal.jsonl自動追記で救済（`harvest_workflow.py <runId>`）。**起動したらrunIdを即このファイルに追記して報告**（A2/A3）。
5. 集約: 非dropを ranked順に採用 → 先頭300問に `N3-V-Y-1201`〜連番。distractorTags保持。

## gen prompt（本走行・生成のみ／各バッチに語を差し込む）
> パイロットで使ったものと同一の核。独立反証が無いので**自己検証を必須化**。
- 用法＝対象語1つを正しく使う文を4択。choices[0]=正解(正用文)、他3=誤答。
- **誤答＝近接類義語ダミー**（同一意味フィールドの近接類義語が各文で最適・対象語だけ不自然）。無関係/対義語ダミー禁止（当てずっぽうで消せる＝欠陥）。
- 殺し方の型を混ぜる。**(P1)** 置換語は全別語 / **(P2)** 殺し方2種以上（選択制限で全固めは公式良問例外）。
- **★実バグ回避（必須自己検証）**: 各誤答文に対象語を代入し「少しでも自然に成立するなら作り直す」。近縁すぎる語を置換語にしない。実例=探す「川で石を探した/安い店を探した」両方正用/刷る↔コピー/活気↔熱気。
- 個人名なし（役割ベース・「係」→「係の人/スタッフ」）。解説なし（explain欄なし）。ルビ=N3以上の漢字に`漢字（かな）`。
- 誤答は原則3個。一意な3個が無理な語・用法ダミーが作れない具体名詞(動物/物質/道具/身体部位等)は `needsDrop:true`+理由。
- **uniqRisk自己申告**: 自信あり→欄なし / やや不安→`uniqRisk:"mid"`+`uniqNote` / 危ない→`uniqRisk:"high"`+`uniqNote`。
- distractorTags=choices[1..3]に順対応 `{repl:置換語, type:殺し方}`。
- 出力JSONのみ: `{"items":[{vocabId,word,stem,question,answer,choices,distractorTags,uniqRisk?,uniqNote?,needsDrop?}]}`。

## 投入・番人・後処理（生成後）
1. **差分追記**でusage_N3.jsonにitemsを足す（**全文Write禁止**＝64k超で失敗・スクリプトで該当欄だけ／`[[large-write-64k-patch-not-rewrite]]`）。
2. `python tools/build_usage_distractor_tags.py`（distractorTags→`src/data/shared/usageDistractorTags.json`再生成）。**新4択は全てタグ必須**（未タグ=番人失敗）。
3. 番人: `usageDistractor.test.ts`(P1/P2) / `usageCoverage.test.ts` / `parity.test.ts`。カバー率=`src/data/shared/usageCoverage.json`+②シート更新。
4. **一意性Excel**: `python tools/quality_excel.py` → `一意性チェック_通常_N3.xlsx`（uniqRisk 🔴high/🟡mid色付け）でユーザーがレビュー。
5. **在庫再生成チェーン**（`[[stock-record-to-excel-not-txt]]`）: stock_report.py → mock_stock → stock_excel → daimon --xlsx。
6. **OTA**: content編集後は`_manifest.json`再生成必須（`[[ota-manifest-regen-or-stale]]`）。
7. **i18n対訳**: 正解文の10言語訳を翻訳フローで埋める。

## 厳守
- **commit / publish / build は明示指示まで実行しない**（`[[never-build-without-explicit-order]]`）。生成→番人→Excelまでで一旦報告。
- 実費¥0だが判断軸はクォータ。runId記録・agent最小（バッチ30・読むだけagent禁止）。
- 完了時: daimon-question-build SKILL §11 記録へマージ＋在庫更新＋このinflightを更新/削除。
- 後始末: `tools/usage_n3_candidates.json` は用済み後に確認して削除（F3）。

## 次の一手
本走行を実行（上記Workflow・生成のみ）→ 番人通過 → 一意性Excel提示 → ユーザーのレビュー反映 → 指示があればcommit/配信。
