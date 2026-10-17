# 用法N3 新規300問 作問 — inflight（2026-09-05）

## 進捗（2026-09-05・作問〜ルビ〜マージ〜Excel まで完了。翻訳のみ次セッション保留）
- ✅ **生成WF `wf_fc93af98-40b` 完了**（300問・空バッチ0・15体・uniqRisk high=0/mid=49）→ `scratchpad\usage_n3_300\all300.json`。機械チェック全緑（P1/P2違反0・欠落0・語不一致0）
- ✅ **ふりがなWF `wf_3d400e49-4a0` 完了**（1480文・15体）→ `build_usage_furout.py --write` で `furout_300.json` 再組立（検算=括弧除去後が元文と1文字も違わず一致・欠落0/不一致0）
- ✅ **apply 済**（`apply_usage_n3_300.py --write`）: content `usage_N3.json` **600→900**（新id **N3-V-Y-0652..0951**・全4択・verified=true・**i18n={}（翻訳は未）**）。誤答タグ `usageDistractorTags.json` に300件追加（不正0）
- ✅ **番人4テスト緑**（usageDistractor/parity/metricExclude/transStaleness = 12 pass 0 fail）※ルビ未付与0も確認
- ✅ **レビューExcel生成済** = `C:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ\用法N3_新規300_確認用.xlsx`（.gitignore）。**一意性があやしい問題だけ行を色付け**（赤=uniqRisk high 0 / 桃=mid 49 / 薄橙=感情語(申告なし) 9 = 計58行）。他82の級上漢字・monoは一意性と別軸ゆえ色なし・値のみ。「採用」列に×で除外。**最終一意性判断はユーザー**
- ✅**OTA配信 完了（2026-09-05）**＝`publish-content.ps1 -Message "feat(用法N3): 新規300問追加…"`→commit `ecb2ccb6`（content/usage_N3.json のみ）→push→Pages run 33951720284。ユーザー「とりあえず配信・後で必要なら修正」。_manifest.json は新sha保持済（罠回避）。残りの未コミット（tools/・usageDistractorTags.json＝番人用・memory/）は配信無関係で据置。
- 【別件メモ】辞書訳コスト（id ¥78実測／他6言語は概算・通算≈¥405）を `memory\在庫・模試ストックまとめ.xlsx` の「⑥ 翻訳状況」③辞書セクション(旧37/38の間・現38=字数/39=実費・参考色)に記入済。正確額は Gemini 課金ダッシュボードのみ（実測欠落）。

## 目的・前提（一次情報で確認済）
- 入力 = Sep5選定 `tools\out\usage_n3_selection_300.json`（300語・content に 0/300 = 全て新規）→ `scratchpad\usage_n3_300\targets.json` に変換済（pos推定/kanjiMax算出/emotion=risk RED 13語）
- 既存 `content\problems\moji_goi\usage_N3.json` = 600問（id 1〜651・8/29バッチ id352〜651 はマージ済）→ **新規は id 652〜951**
- 8/29の旧生成物は `scratchpad\usage_n3_300\_aug29_done\` に退避済（幽霊ファイル対策・apply の誤読防止）
- ユーザー決定（2026-09-05）: **300語を一気に全実行**／**感情語13は作問してExcelで一意性判定**（最終判断はユーザー）
- gen_usage_workflow.py に uniqRisk/uniqNote 自己申告を追加済（[[uniqueness-self-declaration-in-generation]]）

## ✅ 翻訳 完了（2026-09-05）
- `trans_daimon.py usage --apply`（cache seed済1271のおかげで**新規300件だけ**訳=N3-V-Y-0652..0951・fail0・cache 1271→1571）→ `--write`（未訳スキップ0）。usage_N3の en.answer 欠落 **300→0**。番人 parity/transStaleness = **7 pass 0 fail**。実費 **Gemini 2.5 Flash ¥7**（in6,194/out17,298 tok・$0.045）。
- ※dry-runの「未訳=1571」は表示バグ（裸id判定 vs cacheキー`id␁answer`）。applyは正しく300のみ。全1571訳は不要だった。
- 残り＝Excel一意性判定→（除外あれば反映）→在庫チェーン→OTA配信（ユーザー明示OK後）。

## ⚠ 2026-09-05 途中で割込み対応（この用法作業とは別件・完了済）
- **iOS起動即クラッシュを修正しビルド起動**：原因=App.tsxのSNS撮影ハーネスが native に無い `window.location.search` をトップレベル無防備参照→TypeError→expo-updates errorRecoveryでabort（ビルド2905/v1.1.36で発症）。修正=`typeof window.location`存在確認で短絡。**v1.1.37(2906) dispatch済 run 33951720119**（-NoCommitで修正+UI8言語i18nのみpush・用法300問は未pushで据置）。
- **UI翻訳完了**：新規18キー×8言語(bn/id/ko/my/th/vi/zh)＋幽霊coach.vol_title掃除＋ne漢字残り修正。→ commit ce397a6e で push済。

## ★次セッションの一手（残り＝Excel判定＋配信・翻訳は済）
- **✅Excel正本化 完了（2026-09-05・[[consolidate-same-category-into-canonical-file]]）**：用法300問レビューを正本 `一意性チェック_通常_N3.xlsx` の「用法」シートへ統合（900行=600+新300・黄49=自己申告mid色付き）。手順=(1)自己申告 uniqRisk/uniqNote を scratchpad all300.json から content usage_N3 の49問へ**恒久化**（applyで落ちていた・quality_excel.pyがcontentのuniqRiskを読む）(2)`quality_excel.py` に**採用(×で除外)列を汎用追加**(3)再生成。**stray `tools/build_usage_n3_review_300.py`(git rm済) と `用法N3_新規300_確認用.xlsx`(削除済) は駆除**。
  - 次=ユーザーが `一意性チェック_通常_N3.xlsx` の用法シートを目視→採用列×で除外指示→（除外反映）→在庫チェーン→OTA配信（明示OK後）。
0. ユーザーがExcelで「採用」列に×を入れた問題があれば**先に除外**（content usage_N3.json から該当id削除＋タグ削除→番人再実行→id詰めは不要）。
1. **翻訳(en/ne・正解文のみ)**＝`python tools\trans_daimon.py usage --dry-run` → `--apply` → `--write`。
   - ⚠既知の注意: dry-runが未訳=1571と出る（cacheキー不整合の疑い＝`load_items`のid生成とcacheキー`{id}\x01answer`のSEP/整形がズレている可能性）。**まず新規300だけ訳したい**（content上、en.answer欠落は N3の652..951=ちょうど300件のみ・他1271は既訳）。
   - 対策案: (a) do_apply は `i not in cache` 判定なので、既訳1271を content i18n から cache に seed 済（seed=`scratchpad\pg\trans_usage_cache.json`・1271件）にしても未訳が減らないなら、cacheキーと`load_items`のキーが不一致→ `load_items('usage')` が返す id/field を print して合わせる。(b) 直せないなら全1571訳(¥51)でも実害小（既存は同一原文→等価訳で上書き）。**D2: 実費を円で報告**。
2. 翻訳後に番人 `transStaleness`／`parity` 再実行。
   （＝旧・完了後の一手 ↓ は達成済。参考に残置）
   - ~~journal→all300~~ / ~~ふりがなWF→furout~~ / ~~apply --write~~ 全て完了。
4. en/ne 翻訳 = `python tools\trans_daimon.py usage --dry-run` → `--apply` → `--write`（Gemini 2.5 Flash・**正解文のみ**訳す=ユーザー確定2026-09-02・キャッシュ scratchpad\pg\trans_usage_cache.json で再開可・既訳idはスキップ）。300短文ゆえ概算¥数十=D1閾値(¥1000)未満だが **D2: 完了時にモデル名＋実費(円)を報告**。GEMINI_API_KEY は環境に設定済(確認済)
5. レビューExcel: `python tools\build_usage_n3_review_300.py`（**引数化済・既定 652..951**・category/uniqRisk/uniqNote/採用列を追加・赤=感情語RED/自己申告high・桃=mid）→ 出力 `用法N3_新規300_確認用.xlsx`（セッション直下・.gitignore）→ **ユーザーが一意性を判定**（採用列に×で除外）
6. 番人・指標: `python tools\build_usage_distractor_tags.py`・`update_usage_coverage.py`・テスト（usageDistractor/parity/transStaleness/metricExclude）
7. 在庫再生成チェーン（stock_report→mock_stock→stock_excel→update_vocab_daimon_coverage）
8. **OTA配信 = `tools\publish-content.ps1 -Message "..."`** ＝ manifest再生成→検証→content/だけcommit→**git push origin main（公開repo・Pages OTA自動配信＝外向き・不可逆）**。ネイティブビルドはdispatchしない。**ユーザーのExcel判定と明示OKが出るまで実行しない**（[[never-build-without-explicit-order]]）。検証だけなら `-DryRun`（pushしない）が安全。
- 補助ツール(今回作成): `tools\extract_usage_journal.py <journal.jsonl> [--write]`（journal→all300.json・寛容パーサ・P1/P2/欠落/uniqRisk集計）

## テストのベースライン（apply前・2026-09-05 確認済）
- 番人4本 = `node --import tsx --test src/data/usageDistractor.test.ts src/i18n/parity.test.ts src/data/metricExclude.test.ts src/data/exam/transStaleness.test.ts` → **12 tests / pass 12 / fail 0**（apply後に赤が出たら今回の変更が原因）
- 要約行は `ℹ pass N / ℹ fail N`（`# pass` ではない）。`npm test -- <files>` は**全スイートに追加される**ので単体実行には使わない
- **⚠発見（ユーザー判断待ち・未修正）**: `usageDistractor.test.ts` と `metricExclude.test.ts` は `package.json` の `scripts.test` に**配線されていない**＝`npm test`/CI では走らない番人。parity/transStaleness は配線済。直すなら scripts.test に2ファイル追記（勝手に編集しない）
