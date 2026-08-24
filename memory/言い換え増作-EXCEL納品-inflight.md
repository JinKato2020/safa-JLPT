# 言い換え類義 増作（EXCEL納品方式）in-flight — 正本 2026-08-23

## 方式（このセッション固有・重要）
ユーザー依頼＝「**問題の生成だけ**。反証チェック・修正はユーザーが手元で行う。作ったら**このセッション直下にEXCELで出力**」。
→ **JSON(content/…)へはマージしない**。Excelを渡してユーザーがQA→青セルで削除指定→こちらが色を読んで削除、を繰り返す。

## 生成のやり方（再現手順）
1. 候補＝**未使用vocab**（既存 synonym_{LV}.json の vocabId を除外）。`src/data/shared/vocab.json`（N5 723/N4 673/N3 2145）＋ヒント`src/data/dict/vocabSynonyms.json`（**汚染あり＝ヒント扱い**。外来語/丁寧形/上位下位/同音/級外が混入）。
2. Pythonで候補をバッチ化 → `scratchpad/syn_gen/batches/{LV}_b{n}.json`（1件＝{vocabId,word,reading,meaning,synHint}）。round-robinで良質語を各バッチに分散。
3. **Opusサブエージェント**（general-purpose・並列）に各バッチを渡す。1体=1バッチを Read → 生成 → `scratchpad/syn_gen/out/{LV}_b{n}.json` に Write → `count=N` だけ返す（本体に本文を載せない）。指示は日本語で（ユーザー要望）。
4. 集約：out/*.json → vocabId重複除去＋既存除外 → 連番ID付与 → openpyxlでExcel（2シート N5/N4、列＝level,id,vocabId,word,pattern,sentence,stem,answer,choice1..3,explain_ja）。

## 形式（公式）
- **N5・N4＝文レベル**（提示文→ほぼ同義の4文。誤答ちょうど3・正解1）。N3＝**語レベル**（下線語→意味が最も近い4語）※N3はここが違う！
- ふりがな＝全漢字に `漢字(かな)`。**N5＝文節に半角スペースあり**／**N4＝スペースなし**。`sentence`はふりがな無し、`stem/answer/choices`はふりがな有り。
- 品質規律（md/04_言い換え類義.md）：正解と等価な選択肢はちょうど1つ／正解の近縁語を誤答にしない（第2の正解防止）／同一意味フィールド・同一品詞／級内標準表記。negation_cross=中間語のない排他的反対語のみ（温度は禁止）。perspective_cross=貸借/売買/授受のみ。**作れない語は水増しせず飛ばす**。

## 進捗
- **N4＝199→159問（2026-08-24 青セル40削除済）**。削除元＝`言い換え類義_新規問題_N5-131_N4-199 - コピー.xlsx` の N4シート FFCCFFFF塗り40行（`scratchpad/syn_gen/n4_delete_marks.json`）。final_N4.json は159件・ID N4-V-I-0286〜0444 に詰め直し済。
- **N3＝300問 完成（2026-08-24）**。ID N3-V-I-1100〜1399。final_N3.json=300。生成313→dedup→先頭300。全valid（誤答3・answer∉choices）。
- **納品Excel（最新・3シート）＝`言い換え類義_新規問題_N5-100_N4-159_N3-300.xlsx`**（N5=100/N4=159/N3=300・語レベル列）。旧`…N5-100_N4-199.xlsx`は上書きせず併存（N4削除前）。
- **カバー率シート更新済（2026-08-24）**＝`単語×大問カバー率`の言い換え類義行にEXCEL新規分を合算。全ID N5 48/N4 66/N3 65%・真 N5 76/N4 83/N3 77%。注記に「未マージ」明記。tools/update_synonym_coverage.pyはcontentのみ読むため、EXCEL分を足す一発scriptで更新（iikaePossibleは未改変＝真の分子は保守値）。
- **★青セル削除語を真の母数から除外（2026-08-24 ユーザー依頼）**＝記録正本=`memory/言い換え_青セル削除_記録.md`＋全71語=`memory/言い換え_青セル削除語_除外リスト.json`。iikaePossible.jsonの該当語を`p=0/excluded_blue=1`化（元p=1のみ実減算＝N5 5/N4 16）。**真の母数 N5 392→387・N4 484→468・N3 1776据置／真カバー率 N4 83→86%(N5/N3不変)**。カバー率シート I/J 列更新済。番人`iikaePossible.test.ts`緑。N3は削除なし。

## 次の一手2＝498語に漢字読み/表記を追加生成（2026-08-24 ユーザー依頼・スコープ確認中）
- N3語彙2145のうち漢字あり1896・漢字読み/表記の未カバー=498語（酸素/刺激/収穫/需要/障害/奨学金…）。うち19語のみ他語で漢字練習可＝本物の穴。
- 素材：`dict/ja-examples.json`（word|reading キー）に496/498の例文あり。ただし語をそのまま含むのは422のみ（活用形・誤例あり＝要フィルタ/整形）。`tools/gen_kanjiread_distractors.py`＝漢字読み誤答を辞書機械生成（パスがapp/前提＝現行dict/へ要修正）。**表記(似た漢字)誤答の生成ツールは無し**。
- **決定（2026-08-24）**：①Opus一括生成 ②content本体へマージ ③解説なし(i18n:{})。
- **走行中**＝Opus 10体（aa5f1e8a39aab7ce6 / a9ac105c6478a6f14 / a13e9ff6ecaa1f8e5 / a8e054ba1deaa2348 / a061aec132677a885 / a17237fb3d95debaa / a89f7ecf467479631 / a3f5e4b80cbbdfaf5 / a2e18a2bc6f2fd4bc / a568fabd19d201b9d）。入力`scratchpad/kanji_gen/batches/K3_b{1..10}.json`（各~50語）→out/K3_b{n}.json。1語=kr(漢字読み)+hy(表記)。
- **完了後の集約（本体）**：out/K3_b*.json 読込→検証(誤読3・似漢字3・answer∉choices・一意)→ID採番 kr=**N3-V-K-1399〜**・hy=**N3-V-H-1528〜**→i18n:{}付与→`content/problems/moji_goi/{kanji_read,orthography}_N3.json`のitemsへ**append**→rebuild.ts→カバー率再計算(update_vocab_daimon_coverage.py)→番人テスト。反証チェックは無し（機械品質・ユーザー了承）。
- 素材メモ：kr例文はja-examples流用可(422語)だが活用形/誤例あり＝agentが判断。max既存ID＝K1398/H1527。

## ✅ 完了（2026-08-24）498語 漢字読み/表記 content マージ
- 生成484語pair採用（10体・skip計14＝多義/読み曖昧/～接辞）。検証＝誤答3・answer∉choices・underline∈sentence。
- content append：kanji_read_N3 1398→**1882(+484)**・orthography_N3 1400→**1882(+482)**（表記は既存2語 n3-v-178/1882 を除外）。i18n:{}（解説なし・指示どおり）。ID kr=N3-V-K-1399〜・hy=N3-V-H-1528〜。
- rebuild.ts済（barrel+_manifest再生成・52files）。カバー率再計算＝**N3漢字読み/表記 74→99%**(1882/1896・残14=skip語)。番人18/18緑(validate/manifest/daimon4choices/rehydrate)。
- **未コミット・未ビルド**（build指示待ち＝OTA配信は publish-content.ps1、UIビルド不要）。反証チェックは無し（ユーザー了承）。

## ✅ 完了（2026-08-24）在庫Excelに新シート「レベル別 知識点数」
- 語彙点=語数(N5 723/N4 673/N3 2145)・漢字点=字数(79/166/367)・文法点=項目数(91/131/186・n5-g-92除外)。selectors.ts coverageBars準拠。
- 概念：1語=1点。大問5+ドリル2の"7"は点数でなく面/大問。同大問に複数問題があっても点は増えない（同じ点の練習が増えるだけ）。効くのは面(read/write/mean/listen)の充足＝深さ。
- **N5＝131生成→青セル31削除→100問確定**（ID N5-V-I-0246〜0345 連番振り直し済）。削除語＝こそあど/数助数詞/バナナ牛肉レモン鶏肉/今週立つこんな閉める外渡す夏休み赤私無くす 等。
- 納品Excel（最新）＝`c:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ\言い換え類義_新規問題_N5-100_N4-199.xlsx`
- 記録JSON＝`scratchpad/syn_gen/final_{N5,N4}.json`（final_N5は削除後100件）。

## 次の一手
1. **N3を生成【LIVE 2026-08-24＝目標300問・ユーザー指定】**。★**N3は語レベル**（下線語→近い意味の語を4択）。反証/修正は不要（ユーザー厳命）＝生成のみ→Excel。
   - **走行中**＝Opus general-purpose 10体（agentId: ab85d3b10dd161001 / acd2b674972524380 / a2d1a7298b1662e3f / adda2028a60523c26 / a7953c2280787a73b / a4443e011d1c30efe / a897f36f91727f7a0 / a3ed49d201f5fd885 / a4a3f7ea0f5d5965c / ac65b5f1a3090eb4a）。各batch70語→out/N3_b{1..10}.json に Write→count返す。
   - 候補プール＝未使用N3 vocab 700語（withhint 589全＋nohint 111）。round-robinでbatch分散。既存synonym_N3 1099のvocabIdは除外済。
   - **完了後の集約**（本体でやる）：out/N3_b*.json 読込→vocabId重複除去→**ID採番 N3-V-I-1100〜**（既存content 0001-1099と衝突回避）→openpyxlでExcel。列＝level,id,vocabId,word,sentence,underline,answer,choice1,choice2,choice3,explain_ja。N3シートを既存納品Excelへ追加 or 単独ファイル。final_N3.json も記録。
   - 300超なら先頭300で確定（品質順不問＝生成順）。300未満なら追加batch（nohint残346から）で補充。
2. **N4の削除**：ユーザーから青セル付きExcel（コピー）or 語リストが来たら、コピーの**セル塗り(fgColor)を openpyxl で読む**（画像を目視しない＝取りこぼし防止）。前回の色＝`FFCCFFFF`(水色)。該当vocabId/idを final_N4 から除去→ID詰め直し→Excel再出力。

## 色読み取りの手順（前回実証）
ユーザーは元Excelの**コピー**にExcelで色付け→保存する（`… - コピー.xlsx`＋ロック`~$…`が出る）。ロック回避のため `shutil.copy2` で一時コピーしてから `openpyxl.load_workbook` で `cell.fill.patternType=='solid' and cell.fill.fgColor.rgb=='FFCCFFFF'` を拾う。**画像より確実**。

## 掃除
scratchpad/syn_gen/ は作業用。納品Excelはセッション直下。用済み一時ファイルはF3で掃除。
