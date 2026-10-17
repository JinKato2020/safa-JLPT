# 課題理解 増作（各レベル150問へ・+154）inflight 2026-08-18

## 目的（ユーザー指示）
課題理解を N5+54（0045/0047/0059/0099＋0101-0150）・N4+50（0101-0150）・N3+50（0101-0150）＝各150問へ。
①develop偏りを薄める（新規は薄い型へ）②レベル差＝間接性＋モーラ帯＋話速で実装。

## 走行中 run（作問エージェント6体・¥0本体クォータ）
- N5a a9eb054310693b88a：ID 0045,0047,0059,0099,0101-0123（27）／場面 会社仕事,学校学習,店買い物,家家庭／develop まず次11 追加11 上書き5
- N5b aa9120f59b123f765：ID 0124-0150（27）／病院健康,交通旅行,公共手続,地域近所／断って代案11 二者択一10 上書き3 勘違い訂正3
- N4a a6a9b1cb0ed9c3d35：ID 0101-0125（25）／会社仕事,学校学習,店買い物,家家庭／断って代案14 追加7 上書き2 条件順序2
- N4b a592d4ffaf4eb9ce3：ID 0126-0150（25）／病院健康,交通旅行,公共手続,地域近所／勘違い訂正13 二者択一12
- N3a a3d21ff3e8d19c225：ID 0101-0125（25）／会社仕事,学校学習,店買い物,家家庭／まず次10 追加8 上書き7（消去は作らない）
- N3b a6aad980d15e4ae1f：ID 0126-0150（25）／病院健康,交通旅行,公共手続,地域近所／断って代案10 二者択一8 勘違い訂正7

出力＝<scratchpad>/kadai_work/newq/new_kadai_{N5a,N5b,N4a,N4b,N3a,N3b}.json（簡易レコード配列・merge_and_gate入力形式）。
指示書＝<scratchpad>/kadai_work/作問指示書.md。手本＝<scratchpad>/kadai_work/batches/batch_kadai.json。

## ゲート結果（2026-08-18・追記済み）
- 6体で+154問→ merge_and_gate --apply 済＝**kadai N3/N4/N5 各150問**。致命0・帯外0。
- develop最終最大：N5 jouken22%／N4 shoukyo22%／N3 shoukyo31%（消去46%→31%）＝全レベル≤35%（skeleton check✅）。
- 設問型 手順35-37%（目標3-4割内）。場面8カテゴリ均等。NG（係/留守/役割ラベル/〇）＝全ゼロ。
- develop付与 apply-map 154済。
- **要修正2点（本人エージェント再開で対応中）**：
  - N3a(0101-0125)ルビ密度8%＝ふりがな未付与→ a3d21ff で ruby_N3a.json（{id:script}）作成中→本体で適用。FORCE_KANA5件(今朝/眼鏡/一日/明後日/三日/二日)も同時解消。
  - N5-C-K-0144 が既存0025と病院会計テンプレ近似0.90→ aa9120f で fix_N5_0144.json（別状況の二者択一）作成中→適用＋mora再ゲート。
  - ※0138/0131の一日は誤検出（一日券（いちにちけん）でグループルビ済）＝修正不要。
  - ※台本近似の他ペア（N5 0022-0033・N4 0051-0067）は既存×既存＝据え置き。

## 現在地（2026-08-19）＝音声生成 完了
- **音声生成 完了**（bk5ybpx5v・exit0）＝**154/154成功・失敗0**。実費 **Gemini2.5Flash TTS $4.77≒716円**（D2報告済）。リトライ不要。ログ=memory/choukai_gen_log.txt。出力=問題/聴解/{lv}/kadai/{id}.mp3＋assets/audio/{id}.mp3。
- **次の一手（未実施・ユーザー確認待ち）**＝rebuild.ts（_manifest+bundled再生成）→在庫Excel再生成チェーン→コミット（push/ビルドは指示時）。※UI等の付随修正も未コミットで溜まっている＝`git add -A`でまとめて。
- 出力＝問題/聴解/{lv}/kadai/{id}.mp3（記録）→ assets/audio/{id}.mp3（アプリ読込）。ログ＝memory/choukai_gen_log.txt。
- **完了後の一手**＝実費（$と円・モデル=Gemini2.5Flash TTS）をD2で報告 → `node --import tsx tools/content/rebuild.ts`（_manifest+bundled再生成）→ TSテスト＋tsc確認 → 在庫Excel再生成チェーン（stock_report→mock_stock→stock_excel→daimon --xlsx→skeleton_tag --xlsx）→ コミット（push/ビルドは指示時のみ）。
- ※失敗IDが出たら**リトライせず**残IDだけ後で1回。

## （旧）現在地＝作問・全ゲート完了／ユーザーが目視レビュー中
- 全ゲート緑（merge致命0帯外0・daimon新規重複0・skeleton✅・TSテスト19/19・tsc0）。
- ユーザー選択＝「先に問題を目視したい」→レビューExcel作成・送付済＝
  `C:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ\問題\聴解\課題理解_新規154問_確認.xlsx`（3シートN5/N4/N3・正解=緑列・ルビ付台本・mora・develop・一意性根拠）。
- **次の一手＝ユーザーのレビュー結果待ち**。OKなら音声生成へ／直し指示があればID単位で該当エージェント(N5a/N5b/N4a/N4b/N3a/N3b)を再開して修正→再ゲート。
- 音声見積り＝Gemini2.5Flash TTS 実測~3-4円/本×154≒450-650円（¥1000未満・D2実費報告）。生成=`python 問題/tools/gen_choukai_json.py --ids <csv>`（新規154のID）→rebuild→manifest→コミット。※TTSはリトライ禁止・1コール（[[tts-no-retry-single-call]]）。

## 適用後の残手順（本体で実行）
1. ruby_N3a.json を content/kadai_N3.json の該当script へ反映（文言不変・ルビのみ）。密度再測定で100%確認。
2. fix_N5_0144.json を反映（scriptほか差し替え）＋ develop維持＝二者択一。mora_check・daimon近似再確認（0025との近似が下がるか）。
3. tts_lint 再走（新規のFORCE_KANA欠落0を確認）。skeleton check・qtype再集計。
4. build.ps1のテスト群（skeletonBalance含む）＋tsc確認。
5. 作問結果を報告（音声=有料の手前でチェックポイント）。承認後に音声→rebuild/manifest/コミット。

## （旧）完了後の次の一手
1. 6ファイルを結合→ <newqdir>/new_kadai.json（1本）に。
2. `python tools/choukai/merge_and_gate.py --new <newqdir>`（モーラ帯・重複・係・場面を確認）→問題なければ `--apply` で kadai_{N5,N4,N3}.json へ追記。
3. developをマップ化（各レコードの develop）→ `python tools/choukai/skeleton_tag.py apply-map develop <map.json>`。
4. `python tools/choukai/daimon_solvability.py`（攻略耐性）＋`python tools/choukai/skeleton_tag.py check`（偏り≤35%）＋qtype_ledger（手順偏り）で確認。
5. develop/qtype/場面の追加後分布を再集計→ユーザー報告（音声=有料の手前でチェックポイント）。
6. 承認後：音声生成（gen_choukai_json.py・実測~2.5-3.5円/本×154≒400-600円・D2で実費報告）→ rebuild.ts → manifest再生成 → コミット。

## 設計根拠（レベル差）
モーラ帯 N5 105-157／N4 209-313／N3 258-386（official_mora_baseline.json）。
間接性 N5直接→N3消去法・本音後半・ネタバレ禁止。develop値は全レベル共通（レベルで変えない）。
偏り薄めの狙い＝追加後の最大% N5 22%／N4 22%／N3 31%（消去46%→31%）。

## 付随修正（2026-08-19・未コミット・音声とまとめてコミット予定・OTA/再ビルドで端末反映）
- QuizScreen: 問題IDタップ選択(DevIdPicker)を移植（穴埋め/並べ替え/文字語彙でもジャンプ可・以前は聴解/読解/文章の文法だけ）。tsc緑。
- 文法自動生成の2正解バグ: makeQuestionのcloze誤答が空欄に入る別文法を拾う。n4-g-55(寝〔なさい〕へ「ないと」)・n4-g-105(会え〔てよかった〕へ「ばよかった」)を grammarClozeOk.json から除外→穴埋め自動生成を停止（意味/用法形式は継続）。quiz.test 11/11・tsc緑。※再現は独立スクリプトで確認済（実機不要・スクショ不要）。
- 【根本修正・実装済】文法の復習の犯人＝reviewQuestion.unitForPick が文法点を `#grammar_form` に写像→questionForUnit が makeQuestion(cloze強制)で自動生成([daimon.ts:248])。復習(review:true=おすすめ/ホーム/書斎/AIコーチ/カード)＋模試の弱点ドリルが該当。大問別/カテゴリは元々バンクで無関係。
  → reviewQuestion.ts に GRAMMAR_BANK_BY_POINT(pointId→grammar_form/order バンクid)を追加し、文法grammar面は検証済みバンク問題を返す(無い点はnull=スキップ・生成しない)。習得先は facetMap の KB_RESOLVE で pointId の grammar 面に統合＝従来と同じ(検証済)。
  → 実行時検証: N4 131/131・N3 186/186 バンク出題/生成0、N5 86/92(6点はバンク無=スキップ)。n4-g-55/66/105 は一意選択肢のバンク問題に(ないと/なさる/ばよかった 混入せず)。tsc緑・facet/quizテスト緑。n4-g-66もこれで解決。
  ※弱点ドリル(QuizScreen itemIds→makeQuestion)は別経路。文法idが来れば生成に落ちる可能性。要否をユーザーに確認予定。
- 既存の番人fail(私の変更と無関係・grammar.json未変更): grammarExclude.test の n5-g-32「ましょう」がバラ活用点として検出(n5-g-87へ集約 or ラベル説明化が要る)。別途対応。
- AdMob: src/config/admob.ts に FORCE_TEST_ADS=true 追加→未公開でもテスト広告が出る。原因=承認状況「要審査」+ストア未リンク（アプリ未公開なので本番広告は原理的に出ない=正常）。※公開前に FORCE_TEST_ADS=false へ戻す。
- 旧バンク残骸駆逐: gen_knowledge_bank.mjs/_knowledge_bank.jsonl/dissolve_knowledgebank.py/phase_b_usage.py/split_explain.mjs/backup .bak×2 を削除。memory knowledge-bank-regen-pipeline も削除・MEMORY.md索引更新・rehydrate.tsコメントから旧ファイル名除去。未処理=docs/superpowers×2＋問題/tools/build_knowledge_bank.py（要確認）。
- 友だち紹介UIをPro画面と統一(ReferralScreen): edges={['top']}除去／ヒーロー画像を marginTop:-lg＋marginHorizontal:-lg で上端edge-to-edge化／×を画像上のheadRowから、ScrollView外の半透明丸ボタン(xBtn top:10/right:12・Pro画面と同一)へ移動。上の白余白解消・×が画像右上に。tsc緑。入口=AccountScreen `nav.navigate('Referral')`。
- ※commit時は `git add -A`（削除も含める）。push/ビルドは指示時のみ。
