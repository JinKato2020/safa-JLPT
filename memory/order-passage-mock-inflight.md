# 組み立て(order)・文章の文法(passage_grammar) 模試プール新設 inflight（正本・2026-08-30）

## ▶ 走行中（2026-08-30・生成開始）
- **波1=order 3体 ✅完了**（各50問・ID一意・parse OK）：out_order_{N5,N4,N3}.json。
- **波2=pg 3体 ✅完了**（各5セット/25設問・parse OK）：out_pg_{N5a,N5b,N4a}.json。
- **波3=pg 3体 ✅完了**：out_pg_{N4b,N3a,N3b}.json。
- **✅機械検証 0エラー**（order150=id/stem全ユニーク・★位置=answer位置一致・choices4相異・pointId実在・n5-g-92不使用／passage30セット150設問=【n】各1回・N5=2ブロック他1・answerIndex有効）。
  - 微調整済（内容不変・地の文追加のみ）：N5 order 20問(枠なし18＋被り2)・N4 order 1問(0047「医者に言われて、」)。パッチ=scratchpad/pg_mock/patch_order.py。
- **✅ルビ工程 完了**（Opus3体・全漢字ルビ＝既存mock準拠）。ルビ版 `out_*_ruby.json` を機械再検証＝**0エラー**（ruby_verify.py：ルビ剥がすと原文完全一致＝内容不変／answer∈choices全維持／【n】各1回／裸漢字0＝々含め全ルビ）。
- **✅配置 完了**（place.py）：`content/problems/bunpou/mock/{order_N5,order_N4,order_N3,passage_grammar_N5,passage_grammar_N4,passage_grammar_N3}.json`（schema1・daimon・level・pool='mock'・note・languages['ja']・items）。order各50・passage各10セット。**※まだ結線していない＝アプリ非表示・学習汚染なし（pool='mock'は学習バンクから自動除外）。**
- **✅一意性Excel 完了**（quality_excel.py）：`一意性チェック_模試_{N5,N4,N3}.xlsx`（プロジェクト直下・赤0／黄= order N5:1/N4:0/N3:3・passage N5:1/N4:2/N3:2、全て自己申告midと一致）。ユーザー後日レビュー用。

### ★★ ここまででクリア前工程は全完了＝**/clear 可** ★★
scratchpad/pg_mock/ に out_*.json（原文）・out_*_ruby.json（配置元）・patch_order.py・verify.py・ruby_verify.py・place.py。会話にしか無い情報なし。

## ▶ 結線 ✅完了（2026-08-30・/clear後）＝未コミット・green
- **✅結線コード**：rehydrate(ORDER_MOCK/PASSAGE_GRAMMAR_MOCK＋pgMap抽出＋return追加)・index(ORDER_MOCK/PASSAGE_GRAMMAR_MOCK export＋passageGrammarMockSetsFor)・daimon(import・HAS_MOCK_POOL+='order'・ORDER_MOCK_INDEX・mockUnitIds order分岐・questionForUnit useMock chain+ORDER_MOCK_INDEX)・MockScreen(passageGrammarItems=mock優先fallback)。
- **✅番人新設**：src/data/orderMock.test.ts／passageGrammarMock.test.ts＋package.json登録。
- **✅rebuild(90)・tsc0・npm test 470/470・ランタイム実測**：order/passage とも mockUnits各50/10・学習と重複0・order fmt=cloze(furi/orderSentence有)・passage N5=2ブロック/N4N3=1ブロック。
- **✅在庫Excel MOCK dict**：stock_excel.py に 組み立て50/50/50・文章の文法50/50/50 追加→再生成済。
- **✅在庫EXCEL最新データ更新**（stock_report→mock_stock→stock_excel）＝46行/在庫18769・full_mock N5:21/N4:18/N3:25。
- **✅E19-E24 割増倍数**（大問別まとめ E列・小数）：組み立て 1.60/1.65/1.67・文章の文法 4.40/2.29/1.88。式=在庫問題数D/grammar点数[91/131/186]。実装=stock_excel.py DYN_MULT{'組み立て','文章の文法'}＋GRAMMAR_PTS で在庫から自動算出。
- **✅コミット＆Build**：commit `e8babe86`・push済(OTA起動)・**v1.1.26(2888) dispatch both**・run 33296930432・iOS本日1/8。-NoWatch=監視しない。**★この結線タスク=全工程完了。**
  - 未処理レビュー=一意性チェック_模試_{N5,N4,N3}.xlsx（黄=self申告mid・QA用）。

## /clear後の一手（結線から・機械工程のみ）
配置済みmockを**結線→番人→rebuild→tsc→npm test→ランタイム実測→在庫Excel→コミット**（下記「/clear後の残作業」節 step3以降が正本。step1ルビ/step2配置/step7Excelは完了済）。手本=[[grammar-form-mock-inflight]]（orderは同型／passageは別経路=PASSAGE_GRAMMAR_MOCK＋MockScreen変更）。
- 完了後：機械検証→ルビ→配置→結線→番人→Excel（下記「/clear後の残作業」）。


状態: **【設計完了・作問(生成)は未開始＝ここが /clear 境界】**（ユーザー要望2026-08-30「設計が終わったら作問前にクリアしたい」）。設計・スキーマ・ID選抜・エージェント発射レシピは全てディスク確定済。**/clear後はこのinflightと下記「作問レシピ」を読めば、そのまま生成波を発射できる**（点リスト=`scratchpad/pg_mock/points_{N5,N4,N3}.txt`・passage選抜=`scratchpad/pg_mock/curated_pg_points.md`）。手本=[[grammar-form-mock-inflight]]（結線同型）。ただし passage_grammar は別経路（下記）。※一度order3+pgN5a=4体を発射したが、クリア境界を作るため即停止（ディスク出力なし）。

## ★作問レシピ（/clear後にそのまま実行＝生成9体・波でクラッシュ耐性）
全エージェント＝Opus・general-purpose・run_in_background・**各体が自分のjsonへ即Write**（read-agent禁止＝点リストは下記からプロンプトに埋めて渡す）。スキーマ・品質規律・id帯は本inflightの「スキーマ」節に確定済。出力先=`c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/scratchpad/pg_mock/`。
- **波1=order 3体**（各50問・stem全ユニーク・良点は最大4問・幅広く）：
  - out_order_N5.json（id N5-G-OM-0001〜0050・点=points_N5.txt全体, n5-g-92禁止・N5骨=連体修飾/格助詞/て形連結・N4上超えない）
  - out_order_N4.json（N4-G-OM-0001〜0050・points_N4.txt・N4骨=受身使役/条件/授受/という/連語＋連体修飾）
  - out_order_N3.json（N3-G-OM-0001〜0050・points_N3.txt・N3骨=複合助詞/機能語(わけ/はず/たばかり)/引用/とりたて）
  - order共通: stem空所=`＿ ＿ ★ ＿`(全角U+FF3F×3＋★・★原則3番目・散らす)・question固定"★ に入るものはどれですか。"・choices=正順4語・answer=★語・i18n.ja.explain=完成文・一意性自己申告uniqRisk/uniqNote・役割ベース(個人名禁止)・分かち書き・ja平文(ルビ後工程)。
- **波2=passage N5a/N5b/N4a（各5セット）・波3=passage N4b/N3a/N3b（各5セット）**：
  - 出力=out_pg_{N5a,N5b,N4a,N4b,N3a,N3b}.json（各セット5個の配列）。id帯: a=SM-0001〜0005 / b=SM-0006〜0010（例 N5b=N5-G-SM-0006〜0010・設問-q1〜q5）。
  - 点選抜=`curated_pg_points.md`の該当級ブロック。場面配分も同ファイル（a/bで主題を分けクロス重複最小化）。
  - passage共通: N5=passages2ブロック(2+3空所)/N4N3=1ブロック(5空所)・空所`【1】〜【5】`(数字付き隅付き括弧・本文各1回)・本文依存3＋単文2(3:2)・1セット5機能重複なし・自級点≥3・一意性自己申告・本文↔選択肢重複禁止・役割ベース・字数N5250/N4340/N3425・answerIndex散らす・ja平文。
- 発射後：全out_*.jsonがディスク確定→機械検証→ルビ別パス→配置→結線→番人→Excel（本inflight「/clear後の残作業」節）。

## ユーザー確定事項（2026-08-30）
- 対象=order 各50問(N5/N4/N3・計150)＋passage_grammar 各10セット=50問(計30セット/150問)。公式5問/回×10回。
- **文法ID選抜は私(Claude)が実施**（grammar.json 実在点から・md/07,08準拠）。良問IDは10回横断で再利用可・**問題文は毎回新規**（同じIDでも別問題・学習コピー不可＝初見）。
- **検証=機械のみ（反証エージェント無し）**。生成時に一意性を自己申告 `uniqRisk:"high"|"mid"`＋`uniqNote`。**全新規問題を一意性チェックExcel(模試 N5/N4/N3)へ出力し、あやしいセルは色付け**（ユーザーが後日チェック）。出力先＝プロジェクト直下 `一意性チェック_模試_{N5,N4,N3}.xlsx`（`tools/quality_excel.py`）。
- **ja のみ・翻訳(en/ne)は後日OTA**。ルビは生成後の別パス。
- push/ビルドはユーザー明示指示のみ。

## スキーマ（一次情報で実測済み）
### order（bank系・`content/problems/bunpou/order_N5.json`と同形）
`{id, stem, question, answer, choices[4], pointId, i18n, uniqRisk?, uniqNote?}`
- stem=本文に `＿ ＿ ★ ＿`（全角アンダースコアU+FF3F ×3＋★・空所4つ）。★はほぼ3番目。
- question=`"★ に入るものはどれですか。"`
- answer=★位置に来る語。choices=**正順4語**（build4Choicesがanswer基準でシャッフル・answerは必ずchoicesに含む）。
- i18n.ja.explain=**完成文（正しい語順の全文）**。回答後表示。
- ルビは別パス（生成時は漢字平文で可・ただし既存order_N5はルビ入り。今回はja平文→後でルビ付与）。
- id帯=`N{lv}-G-OM-0001〜0050`（OM=Order Mock。学習 -N- と非衝突）。

### passage_grammar（セット形式・`content/problems/bunpou/passage_grammar_N5.json`と同形）
セット=`{id, level, kind:"passage_grammar", passages:[{body}], questions:[{id, blankNo, choices[4], answerIndex, pointId, uniqRisk?, uniqNote?}]}`
- **空所マーカー=本文中 `【1】`〜`【5】`（番号付きU+3010・`〔　〕`でない！）**。番人 passageGrammar.test.ts が `body.includes('【'+blankNo+'】')` を検査。
- **N5=passages 2ブロック（2+3空所）／N4・N3=1ブロック（5空所）**（番人が固定）。
- 各セット5設問・blankNo 1..5・4択distinct・answerIndex有効・pointId=grammar.json実在。
- id帯=セット`N{lv}-G-SM-0001〜0010`／設問`...-q1〜q5`（SM=Set Mock）。
- 字数目安 N5 250／N4 340／N3 425。本文依存3＋単文可2（3:2）。1セット5機能=重複なし・自級点≥3。場面多様(役割ベース・個人名禁止)。

## ID選抜方針
- grammar点=N5:91／N4:131／N3:186（`src/data/shared/grammar.json`実在id `n{lv}-g-#`のみ）。点リスト＝`scratchpad/pg_mock/points_{N5,N4,N3}.txt`（id|category|point|romaji）。
- order N5=連体修飾・格助詞位置・て形連結中心／N4・N3=連語・引用構造（〜ように言われる/という＋名詞/たばかり）。
- passage=md/08 機能パレット準拠。模試はカバー率母数外＝カバー率100%制約でなく公式同等の機能の広がり。

## 作問エージェント（Opus・各体自分のjsonへ即Write・波でクラッシュ耐性・read-agent禁止=argsで点リスト直渡し）
- order 3体：out_order_{N5,N4,N3}.json（各50）
- passage 6体（1体≤5セット＝md/08「1体8上限」順守）：out_pg_{N5a,N5b,N4a,N4b,N3a,N3b}.json（各5セット・id帯 a=0001-0005/b=0006-0010）
- 波：波1=order3／波2=pg N5a,N5b,N4a／波3=pg N4b,N3a,N3b
- 出力先=`scratchpad/pg_mock/`

## 機械検証（python・エージェント無し・エラーはユーザー提示）
1. order：各level50・id一意・帯正規(-OM-)・choices=4 distinct・answer∈choices・stemに`＿`と`★`・pointId実在・stem全ユニーク。
2. passage：各level10セット・設問5・blankNo 1..5・本文に【n】・4択distinct・answerIndex有効・pointId実在・N5=2ブロック他=1・セット/設問id一意。
3. 一意性Excel出力（quality_excel.py が order/passage mock を読むか要確認・読まねば対象パス追加）。

## /clear後の残作業（機械のみ）
1. ルビ別パス（stem/choices/answer/explain・passageはbody/choices。【n】と★は保護）。方式=平文→読みだけ返させ機械マージ([[sentence-furigana-needs-llm]])。
2. 配置：out_order_*→`content/problems/bunpou/mock/order_{N5,N4,N3}.json`（fileに pool:"mock" daimon:"order" level languages:["ja"]・itemに i18n:{ja:{explain}}）。out_pg_*→`content/problems/bunpou/mock/passage_grammar_{N5,N4,N3}.json`（file pool:"mock" daimon:"passage_grammar" level languages:["ja"]）。
3. 結線：
   - **order**＝grammar_form mock同型：rehydrate `ORDER_MOCK=bankItems(files,'order',map,true)`＋return追加／index export／daimon（import・HAS_MOCK_POOL+='order'・`ORDER_MOCK_INDEX`・mockUnitIds分岐・questionForUnit line254のuseMock lookupに`?? ORDER_MOCK_INDEX.get(unit)`追加）。**MockScreen変更不要**。
   - **passage_grammar**＝別経路：rehydrate `PASSAGE_GRAMMAR_MOCK=bankItems(files,'passage_grammar',<同map>,true)`＋return追加／index export＋`passageGrammarMockSetsFor(level)`／**MockScreen `passageGrammarItems` を mockプール優先に変更**（`passageGrammarMockSetsFor`があればそれ、無ければ従来）。既存 passageGrammar.test.ts（学習210固定）は不変。
4. 番人：`src/data/orderMock.test.ts`＋`src/data/passageGrammarMock.test.ts` 新設＋package.json登録。
5. `node --import tsx tools/content/rebuild.ts`→tsc0→npm test緑→ランタイム実測（mockが初見で出るか・学習汚染なし）。
6. 在庫Excelチェーン（[[stock-record-to-excel-not-txt]]）：stock_report→mock_stock→stock_excel→daimon --xlsx。模試「模試問題数」列に order 50/50/50・passage_grammar 50/50/50 追加（stock_excel.py の MOCK dict）。mockは在庫に数えない。
7. 一意性Excel（quality_excel.py）→ 模試 N5/N4/N3。
8. まとめてコミット（push/ビルドはユーザー指示待ち）。

## クリア境界
生成+ルビ+機械検証がディスク確定したら /clear 可（本inflightに全状態）。以降は上記「残作業」のみ。
