# 言い換え④・用法⑤ 模試プール 作問 inflight（2026-08-30 更新）

状態: **✅完成(未コミット) 2026-08-30**。言い換え150(N5/N4=文・N3=語)＋用法100(N4/N3)＝計250問。結線・番人・Excel 全緑。
【完了サマリ 2026-08-30】
- 生成: Opus5体・各50問・自分でWrite。`content/problems/moji_goi/mock/{synonym_N5,synonym_N4,synonym_N3,usage_N4,usage_N3}.json`(pool='mock'・id -IM-/-YM-・languages['ja']・ルビはインライン全角括弧)。予備差替=synN5 4語/synN3 5語/usageN4 2語(送り仮名非正規の落る/落す)。uniqRisk mid=synN5 12/usageN4 4/usageN3 3・high 0。
- 機械検証: 全250 PASS(件数50×5・id/vocabId一意・synは正解が誤答に非混入・usageはchoices=4かつchoices[0]=正解・ルビ括弧整合)。
- 結線: rehydrate(SYNONYM_MOCK/USAGE_MOCK 追加・pool='mock'は学習バンクから自動除外)・index(export)・daimon(HAS_MOCK_POOL+='synonym','usage'・SY_MOCK_INDEX/MULTI・USAGE_MOCK_INDEX・mockUnitIds分岐・questionForUnitでuseMock優先フォールバック・synはstem有無でN4文/N3語自動分岐)。
- 番人: `src/data/synonymUsageMock.test.ts`(package.json test列挙に登録)=16/16。**tsc0・npm test 448/448**・rebuild(81files・_manifest再生成)。
- Excel: 在庫`memory/在庫・模試ストックまとめ.xlsx`の模試問題数列に 言い換え類義50/50/50・用法50/50 追加(stock_excel.py MOCK dict)。一意性`一意性チェック_模試_{N5,N4,N3}.xlsx`再生成(quality_excelは/mock/自動認識・赤0/黄14,11,10)。
- **未実施(任意)**: 用法mockのP1/P2番人=build_usage_distractor_tags.pyは学習usage_*.jsonのみ対象でmock未対応。mockのP1/P2はエージェント自己申告のまま(番人対象外)。必要なら要拡張。
【旧・実行メモ 2026-08-30】
【実行メモ 2026-08-30】Opus 5体起動(iikae N5/N4/N3・youhou N4/N3・各50問=計250)。各自 select_*.json を Read→ mock json を Write。**ルビはインライン生成**(stem/answer/choices/(N3 sentence)の全漢字に `漢字（かな）`全角括弧・表示側 RubyText がユーザーレベルで出し分け)＝別パス省略で往復削減(inflightの別ルビパス方針を上書き)。**languages=['ja']**(同フォルダ context/ortho 模試踏襲・i18nはja.explainのみ・ne後日OTA)。verifiedフィールド無し。次=完了後に(1)build_usage_distractor_tags.py→usageDistractor.test.ts (2)結線確認(daimon HAS_MOCK_POOL+='synonym','usage'・synonymはN4文/N3語の2分岐)＋番人テスト新設 (3)_manifest再生成 (4)quality_excel (5)在庫Excel更新。
方針の正本＝ユーザー承認「指標が骨組み、肉付けと取捨（不適語は予備へ差替）は作問時にLLM」。

## 作る物（1語=1問）
- ④言い換え: mock N5=50 / N4=50 / N3=50（計150）
- ⑤用法    : mock N4=50 / N3=50（計100）※N5に用法は無い（公式・確定）
- 合計 250問。**別プール（pool="mock"）**。通常学習には出さない。

## 選定済み語（骨組み・これを使う。ユーザー承認済）
- 一覧＝ `scratchpad/iikae_youhou_mock/select_{iikae,youhou}_{N5,N4,N3}.json`
  （各行: vocabId, word, reading, meaning, freq, effFreq, cat, half(頻出/中頻度/補充/予備), softAvoid）
- 要約＝ `scratchpad/iikae_youhou_mock/preview.txt` ／ 選定script＝ `tools/select_iikae_youhou_mock.py`（再現可）
- **各(大問,レベル)に予備15語**。作問時に不適語を蹴ったら頻度順で差替（再選定不要）。
- 指標: vocabFreq(JMdict実コーパス頻度・小さい程頻出) + iikaePossible.json(p=1=言い換え可・above_only除外) + usage学習プール実績語(用法=作れる保証) + 方法C(SPOKEN_BOOSTで日常語を頻出ティアへ)。
- 頻出50%＋中頻度帯(freq6-40)50%・カテゴリ上限22%で分散。
- 既知の差替候補（作問時に予備へ）: ④N5の具体名詞多め(コート/ドア/トイレ/ネクタイ/字引)・「では」「ええ」/ ⑤N4の 彼ら/彼女/例えば・送り仮名古い落る/落す。④N5はクロス型(否定/授受)を厚めに。

## 出力先（新規・pool="mock"）
- `content/problems/moji_goi/mock/synonym_N5.json` / `synonym_N4.json` / `synonym_N3.json`
- `content/problems/moji_goi/mock/usage_N4.json` / `usage_N3.json`
- top: 対応学習ファイル `content/problems/moji_goi/{synonym,usage}_*.json` の top形(schema,daimon,level,languages)をコピー＋`"pool":"mock"`＋`"note":"模試専用プール。通常学習には出さない。頻出50%+中頻度50%。"`。
- **id帯（学習と非衝突）**: 言い換え=`{LV}-V-IM-####`（学習は -I-）/ 用法=`{LV}-V-YM-####`（学習は -Y-）。例 N5-V-IM-0001, N4-V-YM-0001。

## スキーマ（既存学習プール実測。この形で作る）
- **④文レベル(N5,N4)**: `{id, vocabId, sentence(提示文・平文), underline, word, answer(正解文), choices([誤答文3〜5]・**正解を含めない**), stem(=sentenceのルビ版・ルビ工程で付与), pattern(N5のみ negation_cross|perspective_cross|noun|verb|adj|adv|hypernym), i18n{ja:{explain},ne:{explain}}, uniqRisk?, uniqNote?}`
- **④語レベル(N3)**: `{id, vocabId, sentence(下線語を含む文・平文), underline, word, answer(正解語1語), choices([誤答語のみ4前後]), i18n{ja/ne:{explain}}, uniqRisk?, uniqNote?}`
- **⑤用法(N4,N3)**: `{id, stem(対象語), question:"「◯」の使い方として最もよいものはどれですか。", answer(正用文), choices([4文]・**choices[0]=answer(正解)を含む**), vocabId, i18n{ja/ne:{explain}}, uniqRisk?, uniqNote?}`
- **要注意の差**: 用法は choices が正解を含む(先頭=正解)／言い換えは choices=誤答のみ・answer別。
- ルビ: 作問は**平文**(漢字そのまま・ふりがな無し)。stem/answer/choices/(語レベルsentence) 全て平文。ルビは別工程で `漢字(かな)` 付与。
- explain: ja必須＋ne(母語化方針)。1文で「正解の理由＋誤答が置換不可の理由」。既存全item踏襲。

## ダミー設計ルール（プロンプトに埋める。正本=md/04_言い換え類義.md, md/05_用法.md 実読必須）
- ④文レベル: 提示文→ほぼ同義4文(12〜22字)。周辺共通・キー語だけ変える。誤答=①近接だがズレ ②上下語ズレ ③連想の罠。**同義文は1つだけ**・**確定正解の近縁語を誤答に置かない**(刷る→コピー/活気→熱気の第2正解事故)。
- ④N5クロス: negation_cross=排他的両端のみ(中間語彙ある温度軸不可)。perspective_cross=貸借/授受/売買の視点転換のみ(出す/入れる不可)。詳細=04MD(3)〜(8)。
- ④N3語レベル: 同一意味フィールド・同一品詞・硬め抽象語で4択。
- ⑤用法: 正用1+誤用3。近接類義語置換主軸(各類義語が最適な文脈→対象語だけ不自然)。罠5型=同一漢字/自他・近接類義・選択制限・コロケーション枠・多読み多義。**P2=殺し方2種以上に分散/P1=置換語を全別語**(自他2連発禁止)。**正用文を誤答にしない**(探すの実バグ)。
- ⑤番人タグ: 作問後 `python tools/build_usage_distractor_tags.py`→`node --import tsx --test src/data/usageDistractor.test.ts`(タグ=repl/type・誤答はchoices[0]除いた順)。
- 一意性: **検証しない**。生成と同時に自己申告 `uniqRisk:"high"|"mid"`(自信あれば欄なし)+`uniqNote`(理由1文)。正本=`md/一意性自己申告ルール.md`。

## 作問エージェント計画（B規律=少数の大きめ・Opus・agent自身がWrite）
- 5エージェント（1=1出力ファイル・50問・**自分でmock jsonをWrite**。null返り回避）: iikae_N5 / iikae_N4 / iikae_N3 / youhou_N4 / youhou_N3。
- args で「選定語(select_*.json)＋そのレベルのダミー設計ルール＋スキーマ＋id帯」を直接渡す(B1: read agent禁止)。
- 50問は概ね<64k で単一Write可。超えそうなら25×2に分割。品質最優先=Opus。独立verify段なし(自己申告のみ)。

## 作問後の後工程（順に）
1. **ルビ工程**: 各mockの stem/answer/choices/(語レベルsentence)に `漢字(かな)` 付与。自級以上の漢字のみ。LLMが正本。
2. **用法番人タグ**: build_usage_distractor_tags.py → usageDistractor.test.ts 緑。
3. **プール結線確認**: synonym/usage の pool="mock" を MockScreen/daimon が拾うか（kanji_read/orthography/context は結線済）。要確認＝`src/data/daimon.ts`(HAS_MOCK_POOL+='synonym','usage'・SY_MOCK_*/USAGE_MOCK・mockUnitIds・synonymは**N4文/N3語の2分岐**要)、`src/data/rehydrate.ts`(SYNONYM_MOCK/USAGE_MOCK)、`src/data/index.ts`(export)、`src/screens/MockScreen.tsx`(knowledgeForDaimon)。番人テストは contextMock.test.ts と同型で新設し **package.json の test 列挙に追加**(グロブでない)。
4. **_manifest.json 再生成**(OTA必須・旧指紋だと届かない)→ commit。
5. **一意性Excel**: `python tools/quality_excel.py`→`一意性チェック_模試_{N5,N4,N3}.xlsx`(大問毎シート・🔴high/🟡mid色付け)。**mockのsynonym/usageを読むか要確認**(読まねば対象パス追加)→ユーザーレビュー。
6. 在庫は模試プールゆえ在庫数に数えない(在庫=学習用のみ)。

## ★まとめてコミット（ユーザー指示 2026-08-30）＝言い換え・用法まで作ってから1回で
下記を**全部1コミット**（この順で未コミットが積まれている）：
- (a) **表記模試200**(N5:80/N4:60/N3:60)＝前セッション・未コミット＝[[ortho-mock-inflight]]。
- (b) **文脈規定模試310**(N5:100/N4:100/N3:110)＝完成・未コミット＝[[context-mock-inflight]]。
- (c) **言い換え模試150＋用法模試100**＝このタスク。
- (d) 付随＝CLAUDE.md規律・select系tools・Excel・_manifest/bundled。
- **push=OTAでcontent配信**。daimon/index/rehydrate/MockScreen等コード変更は**次ビルドで実機反映**(それまで旧アプリは pool='mock' を出さない=学習混入なし・害なし)。**ビルドはユーザー明示指示のみ**。

## 現状（/clear 直前）
- 文脈規定模試=完成・全緑(tsc0・npm test 432/432・ランタイム実測OK)・**未コミット**。
- 未処理レビュー＝`一意性チェック_模試_{N5,N4,N3}.xlsx`(プロジェクト直下・黄=mid N5:2/N4:7/N3:7・赤0)。直し指示あればコミット前に反映。
- 制約: 模試組み立ては大問横断で語ユニーク化(MockScreen usedWords)・プール自体の重複可[[mock-cross-daimon-no-word-reuse]]。ビルドは明示指示のみ。scratchpad/iikae_youhou_mock は選定の正本ゆえ残す。
