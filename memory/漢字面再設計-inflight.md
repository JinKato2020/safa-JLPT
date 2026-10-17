# 漢字マスタリー再設計＋試験タブUI -inflight（/clear耐性）

## 目的（ユーザー確定）
- 漢字の面＝**4面：読み(read)・意味(mean)・聞き取り(listen)・形(form)**。`write`は面から外す。
- **書き(練習)**＝面に数えない練習ツール（ラベル「書き(練習)」）。
- **読みと意味を別ボタンに分離**。
- **形の弁別(form)を新設**（似た字4択・データはLLM生成）。
- **試験タブ**＝4アイコン(語彙/文法/読解/聴解)＋「試験に挑戦する」ボタン分離。アイコンは書斎タブ(WordsHub)と同じ`ImmersiveTab`/`TabIconButton`（語彙=語緑`#3f9d5a`・文法=文紫`#7b6bd6`）。
- Excelにも反映。

## 走行中（類似字データ生成・Opus4体・裏で実行）
- agent ac036ca99dd037e8e = batch1 → out1.json
- agent a592c1f8f79808c7c = batch2 → out2.json
- agent a317178e2ad093685 = batch3 → out3.json
- agent a2412788da62a4658 = batch4 → out4.json
- 入力=`scratchpad/ksim/batch{1-4}.json`（各153字）／出力=`scratchpad/ksim/out{1-4}.json`＝{char:{similar:[≤3],formMakeable:bool}}
- **完了後**：4つをmerge→`src/data/words/kanjiSimilar.json`（正本）。all_chars.jsonで誤答が実在漢字か検証。

## 実装チェックリスト
- [ ] facetMap.ts: Facet型に'form'追加＋FACETS＋facetsForUnit `#kdiscrim_form`→form(weight1)
- [ ] selectors.ts coverageBars: KANJI_FACETS=['read','mean','listen','form']（writeを外す）＋facetMakeable(form=kanjiSimilar.formMakeable)
- [ ] store.tsx: recordKakitori の facet加点(facetsForKakitori)を撤去＝書きを練習化（★/SRSは残す）
- [ ] KanjiRecognition: route paramに`mode:'mean'|'read'`＋buildKanjiRecognitionQuizに種別フィルタ
- [ ] KubunCard(kanji): 意味/読みを2ボタン＋書き取り→「書き(練習)」＋弁別ボタン新設
- [ ] KanjiFormScreen 新規（似た字4択・answerId=`${char}#kdiscrim_form`）＋App.tsxにnav登録
- [ ] i18n ja/en/ne: 弁別・書き練習・試験に挑戦 等の新キー（parity番人）
- [ ] StudyHomeScreen: moji_goiグリフ字→語＋ラベルcards.vocab・模試をentriesから外しfooterへ／TabSceneに`footer?`prop追加
- [ ] kanjiFacets.json or kanjiSimilar.json に formMakeable
- [ ] 番人テスト＋tsc0
- [ ] Excel ②：単語マスタ数に漢字＋4面、学習ドリルに段階B/弁別、面定義の更新

## 進捗（2026-08-26・全てtsc0・関連テスト緑・未コミット未ビルド）
- ✅類似字データ生成完了＝`src/data/words/kanjiSimilar.json`（612字・formMakeable 557字/91%・平均2.89・Opus4体・**外部API不使用＝¥0**）。
- ✅A 漢字面4化（selectors.ts KANJI_FACETS=read/mean/listen/form・formMakeable=kanjiSimilar）。
- ✅B 書き練習化（store.tsx KAKITORI_PROGRESSのfacet加点撤去・facetReducer.test更新）。
- ✅C 読み/意味を2ボタン分離（KanjiRecognition mode param＋buildKanjiRecognitionQuiz only＋KubunCard）。
- ✅D form面（facetMap 'form'追加＋kdiscrim_form写像／kanjiForm.ts純関数＋番人／KanjiFormScreen＋App登録／i18n kform.* ja/en/ne）。
- ✅E 試験タブ（StudyHomeScreen: moji_goi字→語・cards.vocab・模試を別ボタン「試験に挑戦する」test.challenge ja/en/ne）。
- ✅読み表示バグ修正（強→つよ（い）・手→て[ズ回避]・上→うえ・食→た（べる））＝index.ts formatKanjiReading＋kanjiRecognition pickAnswerReading訓優先。実データ検証済。
- ✅書斎タブ漢字ボタン順（KubunCard）＝リスト→書き取り(練習)→意味→読み→形→聞き取り。
- ⚠既存赤=grammarExclude.test（丁寧形バラ活用点・**私の変更外・grammar.json未変更**・スコープ外）。
- ⏳Excel反映＝§①漢字行＋漢字面数分布(新4面)を用意したが**ファイルがロック中(開いている)で保存できず**。数値=意味clear N5 77/N4 141/N3 311・形 62/159/336・面数分布[N5 4面60/3面19][N4 4面136/3面28/2面2][N3 4面283/3面81/2面3]。§②紐づく大問(漢字4面+書き練習)＋学習ドリル×カバー率(漢字 意味/読み/形 追加)は行挿入/生成系で未反映。適用script=`scratchpad/excel_kanji_v2.py`。

## 次の一手
類似字4体の完了通知を待つ間、E(試験タブUI)→B(書き練習化)→C(読み意味分離)→A(面4化)の順でデータ非依存分を実装。データ到着後にD(弁別ドリル/kanjiSimilar.json)を仕上げ→Excel→tsc/番人。**未コミット・未ビルド（ビルドは指示時のみ）**。
