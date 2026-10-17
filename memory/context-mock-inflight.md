# 文脈規定(context)模試 inflight ＝ /clear耐性の詳細（2026-08-30・生成待ち）

## 目標
文脈規定の模試専用プール（初見・pool='mock'）を新設。**目標 N5:100 / N4:100 / N3:110**（公式 N5:10 / N4:10 / N3:11 × 10回。1語=1問）。
LLM(Opus)生成・**反証/修正エージェントなし・機械検証のみ**（ユーザー厳命）。エラーが出たら**修正の前に問題文をユーザーに見せる**（過剰反応の可能性あり）。

## ✅ここまで完了（未コミット）
- **語選定 確定 v2**＝`tools/select_context_mock.py`→`scratchpad/context_mock/select_{N5,N4,N3}.json`（各100/100/110語・他大問模試プール[kanji_read274+orthography200]と重複0・除外=接辞/単漢字/数字/指標除外/あいさつ等）。**頻出半分＋中頻度半分**（ユーザー選択）＝freq帯 N5 76/24・N4 69/20/9/2・N3 77/19/10/4。各itemは`{vocabId,word,reading,meaning,freq,cat,fromAvoid}`。レビュー用=`scratchpad/context_mock/選定語リスト.txt`。
- **CLAUDE.md §1 に「模試プールの語 重複禁止」ルール記録済**＋メモリ [[mock-cross-daimon-no-word-reuse]]。
- **Excel（別件）完了**＝シート削除(①大問別まとめ/④習得の仕組み/学習ドリル×カバー率/⑤用法カバー×バランス/参考)・大問別まとめのI列(未検証)削除・DEF最新化・stock_excel.py MOCK dict に表記80/60/60追加済（`tools/stock_excel.py`）。**文脈規定100/100/110の追加は生成後**。
- **番人テスト 426/426 pass**（この時点）。

## 🟢 2026-08-30 進捗（/clear後はここを確認・上が最新）
- **✅生成完了＝310問**（N5:100/N4:100/N3:110）→ `content/problems/moji_goi/mock/context_{N5,N4,N3}.json`（merge_context_mock.py・id=N{lv}-V-CM-####）。
- **✅機械検証 形エラー0**（validate_context_mock.py・警告345=choicesが自社vocab.json外の実在語＝許容）。品質＝公式同等を確認（サンプル REVIEW_SAMPLE.txt）。uniqRisk mid=N5:2/N4:7/N3:7・high=0。
- **✅結線完了・tsc0・番人426/426**：rehydrate(CONTEXT_MOCK)・index(export)・daimon(import+HAS_MOCK_POOL+='context'+CTX_MOCK_MULTI+mockUnitIds+questionForUnit useMock分岐)。rebuild済(76files・manifest更新)。ランタイム実測OK(mockは初見文・学習と別文)。
- **✅大問横断ユニーク化 実装**＝MockScreen buildExam に `usedWords:Set` 追加→knowledgeForDaimon/jftKnowledgeItems へ共有。語キー=`saveRef.type:id`(無ければunitのvid部)。同一模試で同語は先着1大問のみ。tsc0・番人緑。**※番人テスト(1模試内語重複0)は未追加**。
- **🔴furigana 3体 起動中**＝ルビ必要 N5:14/N4:56/N3:103=173問。入力 furi_in_{F1(N5+N4=70),F2(N3=51),F3(N3=52)}.json。出力 gen_furi_{F1,F2,F3}.json。完了後 merge_furi.py で sentenceFuri.json へ反映(検証=（）除去で原文一致)。
- **★残**＝(1)furi merge (2)quality_excel.py→一意性チェック_模試_{N5,N4,N3}.xlsx (3)stock_excel.py MOCK dict に('文脈規定',lv)=100/100/110追加 (4)番人テスト(横断語重複0)追加 (5)コミット/push(ユーザー合図)。**コード変更(daimon/rehydrate/index/MockScreen)は次ビルドで実機反映**。

## 🔴 2026-08-30 生成 起動中（旧・参考）
- ユーザー承認「ダミー設計が公式同等ならこのまま進めて」→ 進行。
- 分割済＝`scratchpad/context_mock/batch_{N5,N4,N3}_{1..3}.json`（34/33/33・34/33/33・37/37/36）。
- 仕様書＝`scratchpad/context_mock/GEN_SPEC.md`（md/03の核心を凝縮・級別ルール入り）。
- **9体のOpusサブエージェント起動**（general-purpose・各: GEN_SPEC.md＋batch読む→`gen_{lv}_{i}.json`にWrite）。返りは件数1行のみ（生成JSONは本体に載せない=A1）。
- 完了後＝merge→`content/problems/moji_goi/mock/context_{lv}.json`→機械検証→結線→quality_excel。merge/validateスクリプトは未作成（完了通知後に作る）。

## ★次の一手＝生成（/clear後はここから）
### (2) Opus生成 → mock/書出し
- 入力＝`scratchpad/context_mock/select_{lv}.json`。各語に1問。
- **生成仕様の正本＝`md/03_文脈規定.md`（実読必須）**。核心：**①4択を軸で揃える（品詞/語形/意味フィールド/同漢字漢語）＋②鍵を1つだけ置く（コロケーション/因果/時間の向き/恒常↔一時）**。誤答は必ず1つ near-miss、荒唐無稽な分野違い禁止、誤答3つが同じ向きで一括消去される形は禁止。
  - **N5**＝4択とも同じ品詞・同じ活用形（助数詞/て形動詞/い形/な形/カタカナ名詞/漢語サ変）。鍵の約40%は「〜から/ですから」の因果、残りコロケーション。**分かち書きあり・ルビ無し**。指示文「（　）に なにが はいりますか。」
  - **N4**＝語形40%/意味フィールド/同漢字漢語20%で揃える＋near-miss1つ。**分かち書きあり・漢字ルビ無し**。会話形式も可。指示文「（　）に なにを いれますか。」
  - **N3**＝**分かち書き無し・漢字＋ルビ**。漢語名詞主力・受身・擬態語・カタカナ・複合動詞。鍵1語で抽象的に切る。指示文「（　）に入れるのに最もよいものを…」
  - 役割ベース（個人名なし）・国際ボーダーレス（[[content-borderless-no-names]]）。範囲外の語で難しくしない。
- **出力ファイル**＝`content/problems/moji_goi/mock/context_{N5,N4,N3}.json`。トップレベル＝`{schema, daimon:"context", level, pool:"mock", note, languages, items}`。
  **item構造**（既存context_N5.json＋orthography mockに準拠）＝`{"id":"N{lv}-V-CM-####","vocabId":"<vid>","i18n":{"ja":{"explain":"…任意"}},"prompt":"…〔　〕…","question":"〔　〕に入る言葉は？","answer":"正解語","choices":["誤答1","誤答2","誤答3"]}`。**空所は全角〔　〕（〔＋全角空白＋〕）**。choices=誤答**3つ**（answerは含めない）。
  - **＋一意性自己申告（全模試フロー共通・`md/一意性自己申告ルール.md`）**：選択肢に別解の恐れがあれば `"uniqRisk":"high"|"mid"` と `"uniqNote":"理由1文"` を足す（自信あれば欄なし）。schemaはこの2欄を任意で受ける。
- **生成方式**＝workflow(Opusエージェント)でバッチ分割（B2=束ねる・目安 級ごと2-3体＝全体6-8体）。agentはselect語配列をargsで受けてJSON配列を返す（schema検証）→本体で組立てファイルWrite。**B1厳守=agentにローカルファイルを読ませない**。生成プロンプトに**一意性自己申告の指示**（`md/一意性自己申告ルール.md`のコピペ用ブロック）を必ず入れる。

### (3) 機械検証＝"形"のみ（★一意性の最終判断はユーザー＝私は意味検証エージェントを走らせない・ユーザー確定 2026-08-30）
- **一意性（第2正解の有無・分野違いダミー等の意味判断）は別工程で検査しない**。ユーザーが最終レビューする。私の役目＝生成品質を上げる＋形の機械検証＋レビュー一覧の書出し＋**生成エージェントの自己申告（uniqRisk/uniqNote）を色付きで束ねる**。
- 機械検査＝(a)answer∈choicesの重複なし・choices間重複なし (b)answer語がpromptに現れない (c)prompt内に〔　〕が1つ (d)prompt全文の重複0 (e)1ファイル内 vocabId 重複0 (f)出題級（vocabの級一致） (g)choices各語がvocab.jsonに実在（同級以下が望ましい）。
- **重複チェックは mock/context_*.json を除外**（自己衝突回避＝ortho模試の教訓）。検証script＝`scratchpad/context_mock/validate_context_mock.py` 新規（ortho `validate_ortho_mock.py` 流用）。**形のエラーが出た分だけ**直す（一意性起因の直しはしない）。
- **生成後にユーザー用レビュー一覧を書き出す**＝`python tools/quality_excel.py`（レベル毎ファイル・大問毎シート・🔴high/🟡mid色付け・プロジェクト直下`一意性チェック_模試_{N5,N4,N3}.xlsx`）→ ユーザーが色付き優先で一意性チェック。

### (4) 結線（既存 orthography 模試と同型・mirrorするのが安全）
- `src/data/content/rehydrate.ts`（L23付近 CONTEXT_BANK の隣）＝`const CONTEXT_MOCK = bankItems(files,'context',(it,level)=>({...stripI18n(it),level,explain:it.i18n?.ja?.explain,explainNe:it.i18n?.ne?.explain}),true);` を追加し **return に CONTEXT_MOCK を足す**（L72）。
- `src/data/index.ts`＝`export const CONTEXT_MOCK`（KANJI_READ_MOCK/ORTHOGRAPHY_MOCK と並べる）。
- `src/data/daimon.ts`＝①import に CONTEXT_MOCK 追加 ②`HAS_MOCK_POOL` に `'context'` 追加（L121）③`CTX_MOCK_MULTI`（OG_MOCK_MULTI L183-184 と同型・key=`<vid>#context`）④`mockUnitIds`（L168-174）の pool 分岐に `daimon==='context'?CTX_MOCK_MULTI` を追加 ⑤`questionForUnit` の context 分岐（L344付近）で `useMock` 時 CTX_MOCK から出題。**注意=context は現状 CTX_BANK_INDEX（1unit1問 L186-188）。模試も1語1問なら MULTI 化は任意だが、mockUnitIds/questionForUnit が useMock を見るよう ortho と揃える**。
- MockScreen は `mockUnitIds` 汎用ゆえ編集不要（ortho時と同じ）。
- **ふりがな**＝`src/data/dict/sentenceFuri.json` に対象外漢字ありの文のみルビ付与（キー=問題id・LLM生成が正本 [[sentence-furigana-needs-llm]]）。N5は分かち書き＆自級漢字中心ゆえルビ少・N3は多い。
- **rebuild**＝`node --import tsx tools/content/rebuild.ts`（manifest+bundled再生成）→ `npm test`（番人・426+）→ `npm run tsc`。

### (5) 大問横断ユニーク化ルール実装（ユーザー厳命・[[mock-cross-daimon-no-word-reuse]]）
- `src/screens/MockScreen.tsx` の `knowledgeForDaimon`/`buildExam`（L175-193, L270）へ大問横断 `usedWords:Set<string>`（vocabId＝語彙/漢字大問・grammar id＝文法大問）を通し、各大問の pickFresh で既使用語をスキップ→採用語を追加。番人テスト新設（1模試内に語重複0）。**現状 seen は unit id（`<vid>#daimon`）キーで大問ごとに別＝同語が別大問に出得る**のを塞ぐ。

### (6) Excel＋push
- `tools/stock_excel.py` の MOCK dict に `('文脈規定','N5'):100,('文脈規定','N4'):100,('文脈規定','N3'):110` を追加（Excelを閉じてから `python tools/stock_excel.py`）。大問名は「文脈規定」（STOCK_TXTのラベル）。
- **push**＝`git add -A && git commit && git push origin main`（OTAでmock content配信）。**注意＝daimon/rehydrate/index/MockScreen等コード変更はOTAでは実機反映されず次ビルドで有効**（それまで旧アプリは文脈規定模試を出さない＝害なし・pool='mock'分離ゆえ学習混入なし）。ビルドはユーザー明示指示のみ。

## 参考・教訓
- 既存context item例＝`{"id":"N5-V-B-0001","vocabId":"n5-v-2","i18n":{"ja":{},"ne":{}},"prompt":"あした ともだちに えきで〔　〕。","question":"〔　〕に入る言葉は？","answer":"会う","choices":["待つ","呼ぶ","帰る","走る","歩く"],"verified":true}`（学習は誤答5だが**模試は誤答3**）。
- orthography mock item例＝`{"id":"N5-V-HM-0001","vocabId":"n5-v-438","i18n":{"ja":{"explain":"…"}},"sentence":"…","underline":"…","answer":"天気","choices":["天元","夫気","夫元"]}`。
- freqデータ＝`src/data/dict/vocabFreq.json`（vid→rank 1..50・低いほど頻出・同順多数の粗ランク）。cat＝`src/data/dict/vocabCategory.json`。
