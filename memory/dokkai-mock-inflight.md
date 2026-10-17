---
name: dokkai-mock-inflight
description: 読解4大問(内容理解 短/中/長・情報検索)模試プール新設の作問設計書＝生成〜結線〜検証の正本。/clear をまたぐ。
metadata:
  type: project
---

# 読解 模試プール新設 — 作問設計書（/clear 耐性・作業正本）

## ▶ 走行中（2026-08-30・生成＝ユーザー「★★実行確定」）
- **波1＝6体 ✅完了（全out確定・各エージェント自己検証OK）**：out_tan_N5(30)・out_tan_N4(40)・out_tan_N3(40)・out_chu_N5(20)・out_chu_N4(40)・out_chu_N3(60)。=計230問。scratchpad/dokkai_mock/。
  - chu_N3=1問 uniqRisk mid自己申告(N3-D-M-9012-q1)。他は自信ありで欄なし。字数は全て番人ハード帯内(中N3は狙い帯下限をやや下回る本数本ありWARNのみ)。
- **波2＝4体 発射済（背景）**：out_cho_N3(10本×4=40)・out_joho_N5(10)・out_joho_N4(20)・out_joho_N3(20)。=計90問。
  - **★joho スキーマ一次確認済**：answerIndex は**0固定でない**（実正解位置・散らす）。figure.kind/skeleton.medium=本文タイプ語("案内"等)。figure.blocks=[{type:"table",table:{columns,rows}},{type:"notice",title,lines}]・notes[]・footer。skeleton={q_type,figure_pattern,notice,scene,medium,answer_sources}。翻訳/ルビ無し・languages=['ja']。
- **合計 210本文/320設問（波1完了230問＋波2生成中90問）**。
- **✅波2＝4体 完了（全out確定）**：out_cho_N3(40)・out_joho_N5(10)・out_joho_N4(20)・out_joho_N3(20)。joho answerIndex分布≈均等・各二段構え(answer_sources=2)。

## ▶ 機械検証（配置前・生out・2026-08-30）
- **構造検証 ✅0エラー**（verify.py）：210本文/320設問・ID一意・choices4相異・内容理解answerIndex=0・joho figure/skeleton完備。※verify.pyのjoho字数はfigure JSON構造ごと数える誤り→実可視テキストは各agent実測で帯内（無視可）。
- **内容理解 実番人（verify_real.py＝dokkai_solvability.py関数流用）**：
  - ✅合格＝短文N5/N4/N3(最長0%)・中文N3(最長23%/語彙33%)。
  - ✅**修正3体 完了・再検証OK 全通過**：中N5(最長0%/語彙5%)・中N4(最長2%/語彙27%)・長N3(最長2%/語彙2%)。選択肢のみ修正・本文/answerIndex/一意性保持。
- **情報検索 実番人（joho_verify.py＝joho_figure_check+joho_solvability関数流用）**：
  - ✅N3 全通過（字数[360-900]内631med・図版依存65%・scene12種最頻20%・走査S/C OK・金額6/選ぶ14）。
  - ✅N5 合格（字数276med・図版依存90%・scene8種）。※走査S「表+注記の構成不足」7件は**N5は走査ハード対象外**ゆえ非ゲート（notice を figure.notes[] に置き blocks に notice無し＝figure_pattern表記との軽微不整合・レンダリング影響なし・放置可）。
  - ✅N4 9015 修正完了→**再検証 joho OK 全通過**（走査C 4/4・字数409）。

## ★★ 生成＋機械検証 完了＝クリア境界（2026-08-30）★★
- **全10体 生成済＋3ファイル攻略耐性修正＋joho1件修正＝最終再検証 3本すべて緑**：
  - 構造 verify.py＝ERROR0/dup0/210本文320設問。
  - 内容理解 verify_real.py＝**OK 全通過**（最長5.9%・語彙39.3%全体／中N5 0/5・中N4 2/27・長N3 2/2・中N3 23/33・短文全0）。
  - 情報検索 joho_verify.py＝**OK 全通過**（N3/N4/N5・字数帯内・図版依存65-90%・scene8-12種・走査S/C合格。N5走査SのWARN7は非ゲート）。
- **scratchpad/dokkai_mock/**：out_*.json（全10・ja平文・ルビ無し・翻訳無し）＋verify.py/verify_real.py/joho_verify.py（検証ツール・流用）。会話にしか無い情報なし＝**/clear 可**。
- **ルビ規則 裏取り済**＝自級以上の漢字にルビ（N5≈全漢字／N4はN4+／N3はN3+・N4/N5漢字は裸）。per-kanji級判定に kanjiJlptLevel.json 必要。熟語単位・括弧内漢字禁止・MeCab不可([[sentence-furigana-needs-llm]])。

## ▶ 配置＋一意性Excel ✅完了（2026-08-30・ユーザー指示で先行実施）
- **✅配置**（place.py）：`content/problems/dokkai/mock/{naiyou_tan,naiyou_chu,choubun,joho}_{lv}.json` 全10ファイル（schema1/daimon/level/pool:'mock'/内容理解はlanguages:['ja']/johoはtype:'情報検索'/source:'opus-authored-mock-2026-08-30'/items）。ja平文。**配置済みだが未結線＝アプリ非表示・学習汚染なし（pool='mock'は学習バンクから自動除外）。rebuild未実行ゆえbundled非取込＝tsc/test不変。**
- **✅一意性Excel再生成**（quality_excel.py）：`一意性チェック_模試_{N5,N4,N3}.xlsx`（プロジェクト直下）に読解4シート追加（naiyou_tan/naiyou_chu/choubun/joho）。赤0／黄=読解は**中N3の1件のみ(N3-D-M-9012-q1・mid・琥珀FCE7C0で色付け確認済)**。他320問はエージェント自己申告で一意=無印。最終判断ユーザー。

## ✅ 結線＋番人＋在庫Excel 完了（2026-08-30・当セッション・未コミット）
- **✅結線**：rehydrate.ts=`readingMap(st)`を関数化し `READING`(学習)と `READING_MOCK`(pool='mock'・初見)両方に適用＋return追加／index.ts=`READING_MOCK`export＋`readingMockItemsForSub(lv,sub)`／MockScreen.tsx=`readingByBlueprint`のpoolをmock優先fallback(`const m=readingMockItemsForSub(lv,sub); return m.length?m:readingItemsForSub(lv,sub)`)＋import追加／rebuild.ts実行(100 files・_manifest+barrel再生成)。
- **✅番人**：`src/data/readingMock.test.ts`新設(210本文/320設問・級×小区分の本文/設問数=公式×10・id一意/id帯9###/choices4相異/answerIndex[内容理解=0,joho=0..3]/subtype/readingMockItemsForSub一致)＋package.json登録。**tsc0・npm test 481/481緑**(ne番人 passageTransNe緑=READING_MOCK未混入で維持・決定どおり)。
- **✅ランタイム実測**：READING_MOCK=210本文・学習READING(710)へのmock混入0・mockUnitは9###初見・readingMockItemsForSubがmock優先で結線。
- **✅在庫Excel**：stock_excel.py MOCK dictに読解4大問追加(内容理解短30/40/40・中20/40/60・長N3:40・情報検索10/20/20＝設問数)→`memory/在庫・模試ストックまとめ.xlsx`再生成(大問別まとめの模試問題数列に反映確認済・mockは在庫本体に数えない)。
- **★残＝後日バッチ(OTA)のみ**：ルビ(自級以上・別LLMパス)＋翻訳(Gemini Flash・joho以外160本文＋設問 ne/en・実費約¥100・D2報告必須)→rebuild→publish-content。**その後に content(dokkai/mock)＋コード変更＋Excel をまとめて1コミット**(push/ビルドはユーザー明示指示のみ)。現状はja平文・ルビ無し・訳無しだが未push/未ビルドゆえアプリ非表示=実害なし。

## ▶ /clear後の残作業（結線〜・トークン最適順）※結線〜Excelは上記✅で完了・残は後日バッチのみ
翻訳がユーザー決定で**後日(Gemini Flash・約¥100)**ゆえ、**ルビも翻訳と同じ後日OTAバッチに束ねる**のが最省（LLMパス1周・rebuild1回）。推奨順（配置=✅済）：
1. ~~配置~~ ✅済（上記）。
2. **結線**：rehydrate `READING_MOCK=READING_SUBTYPES.flatMap(st=>bankItems(files,st,map,true))`＋return／index export＋`readingMockItemsForSub(lv,sub)`／MockScreen `readingByBlueprint` を mock優先fallback（`const m=readingMockItemsForSub(lv,sub); const pool=m.length?m:readingItemsForSub(lv,sub)`）／rebuild.ts。
   - ★ne番人 passageTransNe.test.ts は **READING_MOCK を含めない**（翻訳後日ゆえ・含めると赤）。
3. **番人新設**：src/data/readingMock.test.ts（件数=短30/40/40・中20/40/60・長40・joho10/20/20＝計320／id一意／pool='mock'／answerIndex＝内容理解0・joho範囲内）＋package.json登録。攻略耐性/走査は上記python流用ツールを検証ツールとして残す（or tools本体に--mock拡張）。★決定②＝mock joho に johoSkeletonBalance番人は課さない。
4. rebuild→tsc0→npm test緑→ランタイム実測（mockが初見で出るか・学習汚染なし）。
5. **在庫Excel**（[[stock-record-to-excel-not-txt]]）：mockは在庫に数えない。stock_excel.py MOCK dictに読解を追加するか方針確認。
6. **後日バッチ（OTA）**＝ルビ付与（自級以上・別パス）＋翻訳（Gemini Flash・joho以外160本文＋設問の i18n.ne/en）→rebuild→publish-content。**D2実費報告必須**。
7. まとめてコミット（push/ビルドはユーザー明示指示のみ）。
- **残＝3体修正待ち→verify_real再走(全緑確認)→ルビ別パス→翻訳(Gemini Flash・後日)→配置(content/problems/dokkai/mock/)→結線→番人(tool群をmock/走査に拡張)→Excel。push/ビルドは指示待ち。**
  - ★決定②＝mock joho に johoSkeletonBalance番人（正誤≥5等の絶対数要件）は課さない。走査/図版/字数/一意性の実質ゲートのみ。
  - ★注意＝ne番人 passageTransNe.test.ts は翻訳が後日ゆえ、結線時に READING_MOCK を含めない（含めると訳無しで赤）。翻訳完了後に拡張。


**目的**：読解4大問の**模試専用プール(pool='mock'・初見)**を新設し、模試を学習と分離した初見問題で組む。
他大問(kanji_read/orthography/context/synonym/usage/grammar_form/order/passage_grammar)の模試プールと**同じ設計思想**。
設計根拠＝`md/09_読解.md`（ダミー設計の重心・字数・一意性・情報検索5軸/走査ゲート）と`md/00_共通情報.md`第IV/V部。関連メモリ＝[[order-passage-mock-inflight]] [[unique-answer-question-design]] [[content-borderless-no-names]] [[sentence-furigana-needs-llm]] [[uniqueness-self-declaration-in-generation]]。

**現状（設計フェーズ完了・生成未着手）**：読解は**まだ模試プールが無い**。`readingByBlueprint`（MockScreen）が学習と同じ `readingItemsForSub` から出している。これを他大問と同様に mock 優先へ切り替える。

---

## 1. 作問ターゲット（ユーザー指定＝公式出題数×10回分・全問ユニーク）

q/本文は公式固定（`dokkai_solvability.py` SPEC_QN＝短1・中N5:2/N4:4/N3:3・長N3:4・joho1）。

| 大問(subtype) | レベル | 本文数 | q/本文 | 設問数 | 備考 |
|---|---|--:|--:|--:|---|
| 内容理解短 naiyou_tan | N5 | 30 | 1 | 30 | 個人叙述/お知らせ/メモ/メール等 |
| 〃 | N4 | 40 | 1 | 40 | |
| 〃 | N3 | 40 | 1 | 40 | 説明文型は「下線それ＝指示」も可 |
| 内容理解中 naiyou_chu | N5 | 10 | 2 | 20 | 各本文=①理由 ②下線の指示内容 |
| 〃 | N4 | 10 | 4 | 40 | 指示語≥1問/本文（番人ハード） |
| 〃 | N3 | 20 | 3 | 60 | ①指示語 ②理由 ③主張 の3層 |
| 内容理解長 choubun (N3のみ) | N3 | 10 | 4 | 40 | 下線指示＋主張＋定義。550字 |
| 情報検索 joho | N5 | 10 | 1 | 10 | 図版主体。翻訳不要 |
| 〃 | N4 | 20 | 1 | 20 | 1図版=1設問 |
| 〃 | N3 | 20 | 1 | 20 | 1図版=1設問 |
| **合計** | | **210本文** | | **320設問** | |

翻訳(ne+en)が要るのは **joho以外の160本文＋その設問**（joho は InfoSearchFigure 描画で本文訳を使わない）。

---

## 2. 配置・ID・スキーマ

**配置**＝`content/problems/dokkai/mock/{naiyou_tan,naiyou_chu,choubun,joho}_{N5,N4,N3}.json`（choubun は N3 のみ）。
ファイルヘッダに **`"pool": "mock"`** 必須。`languages`＝joho以外は `["ja","ne","en"]`、joho は `["ja"]`。`daimon`＝subtype名、`level`。

**ID帯＝9001+（模試予約帯）**。学習は0001-。文字コード＝短S/中M/長L/情報J（既存踏襲）。
- naiyou_tan: `{Lv}-D-S-9001…` / naiyou_chu: `{Lv}-D-M-9001…` / choubun: `N3-D-L-9001…` / joho: `{Lv}-D-J-9001…`
- 設問id＝`{itemid}-q1`（複数問は q1,q2,q3…）。

**item スキーマ（内容理解＝短/中/長 共通）**：
```json
{ "id":"N5-D-S-9001","level":"N5","category":"dokkai","type":"reading",
  "format":"メモ","subtype":"naiyou_tan","title":"…（ルビ付）",
  "body":"…（ルビ付・\\n改行可）",
  "questions":[ { "id":"N5-D-S-9001-q1","q":"…（ルビ付）",
     "choices":["…","…","…","…"],"answerIndex":0,
     "uniqRisk":"mid","uniqNote":"…(任意・self申告)",
     "i18n":{"ja":{"explain":"…（根拠1文・任意でルビ）"},
             "ne":{"q":"…","choices":["…","…","…","…"]},
             "en":{"q":"…","choices":[…]}} } ],
  "i18n":{"ne":{"body":["…"]},"en":{"body":["…"]}} }
```
- **answerIndex は 0 固定でよい**（`PassageSetPlayer` が描画時シャッフル＝暗記不可）。作問は正解を必ず choices[0] に置く運用が楽（既存踏襲）。
- `i18n.ne.body`/`en.body`＝**文字列の配列**（本文1つでも `["…"]`）。
- 中/長は指示語設問の設問文に語幹「**指す**」を入れる（番人が検出）。

**item スキーマ（情報検索 joho）**＝本文(body)＋`figure`＋`skeleton`(5軸)。ne/en 無し。
```json
{ "id":"N5-D-J-9001",…,"subtype":"joho","title":"…","body":"…（状況＋条件のみ・答えは書かない）",
  "figure":{ "kind":"route|poster|board|table","header":"…","intro":"…","notes":["※…"],"footer":"",
    "blocks":[ {"type":"table","table":{"columns":[…],"rows":[[…]]}}
             | {"type":"route","steps":[…],"edges":[…],"badges":[…]}
             | {"type":"card","fields":[["ラベル","値"],…]}
             | {"type":"notice","source":"…","title":"…","lines":["…"]} ] },
  "questions":[{"id":"…-q1","q":"…","choices":[…],"answerIndex":0,"i18n":{"ja":{"explain":"…"}}}],
  "skeleton":{"q_type":"…","notice":"あり|なし","scene":"…","figure_pattern":"…","medium":"…","answer_sources":2} }
```

---

## 3. ダミー設計（09_読解.md の重心＝大問ごとに変える・必須）

- **短(naiyou_tan)**：中心情報1つを取り出す。誤答＝**本文にあるが設問の焦点でない“真の事実”**＋主体/時点/行為ずらし。本文語を再利用。遠い無関係ダミー禁止。根拠1文を本文に必ず置く。
- **中(naiyou_chu)**：①指示語(直前に一意な先行詞) ②下線の理由(前後に言い換え根拠) ③(N3)筆者の主張。誤答＝**指示先/因果の取り違え**・語形/頭語を揃えて本文語再利用。
- **長(choubun N3)**：下線指示＋主張＋キーワード定義。主張の誤答＝**①言い過ぎ ②一部だけ ③本文にない一般論**。
- **情報検索(joho)**：全条件を満たす行が図版中**ちょうど1つ**。誤答＝各**1条件だけ外す**。N3は決め手を**表の外(※注記)に置く**二段構え、金額は「表±注記の計算」。難度は本番相当（条件 N4=2〜3/N3=3・表 N4=5〜7行/N3=6〜9行 or 2表）＝過剰難化しない。図版3型(route/poster/board)を級で使い分け（同一級の2問は別型）。
- **共通(番人ハード)**：最長=正解≤35%・語彙マッチ=正解≤45%（joho は対象外）・4択の字数を揃える・誤答にも本文語・第2の正解を作らない。

**字数（ルビ`（かな）`と空白を除く）**：短 N5:80/N4:100-200/N3:150-200・中 N5:250/N4:450/N3:350・長N3:550・情報検索(本文＋図版合算) N5:250/N4:400/N3:600。joho は**公式±15%厳守**（N4[340-460]/N3[510-690]/N5[200-375]）。**狙う目標を帯下限より少し上に設定して一発で収める**（後から加筆で刻まない＝往復浪費）。

**人物**＝個人名なし・役割/記号ベース。ただし同一人物は同一ラベル（先生/学生・店員/客・男の人/女の人・A/B・〇〇大学/△駅）で一貫（[[content-borderless-no-names]]）。

**一意性 自己申告**＝各設問に必要なら `uniqRisk:"high"|"mid"`＋`uniqNote`（理由1文）。自信あれば欄なし。最終判断はユーザー（[[uniqueness-self-declaration-in-generation]]）。

---

## 4. 手順（★ユーザーが /clear した後、このファイルを実読して実行）

**A. 生成（Opus サブエージェント・品質が命＝安価モデルに落とさない）**
1. 大問×レベルごとにOpus作問エージェントを束ねて起動（B2＝細粒度分割禁止・目安30体以下）。プロンプトに 09_読解.md の**該当大問の重心・字数目標(帯下限+少し上)・一意性自己申告・役割ラベル・答えは choices[0]** を入れる。反証/修正の独立verifyエージェントは**使わない**（ユーザー指示＝機械検証）→プロンプトで自己検証を厳格化。
2. 出力は**日本語 素の漢字（ルビ無し）**＋（内容理解のみ）ダミー・explain。**翻訳もこの段では作らない**。joho は figure＋skeleton(5軸)＋uniqNote まで。
3. 巨大書出しは差分で（[[large-write-64k-patch-not-rewrite]]）。落ちたら chunk_runner 併用可（ユーザー明示時）。

**B. ルビ付与（別エージェント＝ユーザー厳命「ルビは生成とは別に」）**
4. 生成済みJAに対し**別のLLMパス**で `（かな）` を付ける。規則＝**自級以上の漢字のみ**・**熟語単位**（市民（しみん））・**括弧内に漢字を入れない**。MeCab不可（18%誤・[[sentence-furigana-needs-llm]]）。answer∈choices と改行を壊さない・裸漢字0を確認。

**C. 翻訳（Gemini2.5Flash 別パス＝ユーザー決定 2026-08-30・実費約¥100見込み）**
5. joho以外160本文＋設問の `i18n.ne`/`i18n.en`（body 配列・q・choices）を Gemini2.5-flash＋thinkingBudget0 で一括生成（[[gemini-model-25flash-thinkingbudget0]]・**fetchは必ずタイムアウト**・リトライ厳禁 [[tts-no-retry-single-call]]の思想）。ソースはルビ除去後のJA。**作業後 D2＝「モデル名＋実費(円)」を必ず報告**。joho は翻訳しない。

**D. 結線（コード変更＝次ビルドで実機反映。それまで pool='mock' は非表示＝学習汚染なし）**
6. `src/data/content/rehydrate.ts`：`READING_MOCK = READING_SUBTYPES.flatMap((st)=>bankItems(files, st, <READINGと同じmap>, true))` を追加し return に載せる（PASSAGE_TRANS_NE/EN・Q_TRANS_NE/EN も mock 分を拾えるよう同じ map を通す）。
7. `src/data/index.ts`：`export const READING_MOCK = _R.READING_MOCK` ＋ `readingMockItemsForSub(level, sub)`（READING_MOCK を level/subtype で絞る）を追加。
8. `src/screens/MockScreen.tsx` `readingByBlueprint`：各 sub で **mock があれば mock、無ければ学習へフォールバック**（`passageGrammarItems` と同型：`const m = readingMockItemsForSub(lv,sub); const pool = m.length? m : readingItemsForSub(lv,sub)`）。
9. `tools/content/rebuild.ts` を実行（bundled.generated.ts と _manifest.json を再生成＝新mock JSONを自動 import。手編集しない）。

**E. 機械検証（エージェントでなく機械。エラーは“修正前に”ユーザーへ提示）**
10. `python tools/dokkai_solvability.py --check` … **mockディレクトリを見るよう拡張が必要**（現状 `content/problems/dokkai/{daimon}_{lv}.json` 直下のみ・`mock/` を走査しない）。`--mock` 引数か DDIR 切替を足す。番人＝最長%>35 or 語彙マッチ%>45 or 設問数不一致 or 指示語欠落で fail。
11. joho＝`python tools/joho_figure_check.py --check`（図版込み字数・図版依存）＋`python tools/joho_skeleton_tag.py check`（5軸バランス）＋`python tools/joho_solvability.py --check`（走査性・多様性）。これらも**mock ファイルを対象に含めるよう拡張**（現状 `joho_{lv}.json` 直下のみ）。
12. ネパール訳の番人＝`src/data/exam/passageTransNe.test.ts`。**READING_MOCK(joho以外)も要ne**になるよう拡張（現状 READING のみ検査）。
13. 一意性レビュー用Excel＝`python tools/quality_excel.py`→`一意性チェック_模試_{N5,N4,N3}.xlsx`（quality_excel は `/mock/` を pool='mock' 判定済＝そのまま拾う）。ユーザーが 🔴high/🟡mid を目視。
14. 在庫Excel再生成チェーン（[[stock-record-to-excel-not-txt]]）は模試在庫の更新方針に従う。

**F. 仕上げ**
15. テスト残骸・幽霊ファイルを駆除（F3）。生成物は絶対パスで提示（F2）。
16. **配置＋結線済みだが commit/push/build はユーザー明示指示待ち**（[[never-build-without-explicit-order.md]]）。

---

## ★★ 実行確定（2026-08-30・一次情報で裏取り済み・/clear後はこの節どおり発射）★★

**裏取り元**＝`md/09_読解.md`（設計canon）＋`tools/dokkai_solvability.py`／`tools/joho_figure_check.py`／`tools/joho_solvability.py`／`src/data/johoSkeletonBalance.test.ts`（番人実コード）＋実データ `content/problems/dokkai/{naiyou_tan_N5,naiyou_chu_N3,joho_N4}.json`（実スキーマ）。

### 確定した番人の“正確な”強制内容（要約でなく実コード）
- **内容理解＝`dokkai_solvability.py --check`（ハード）**：最長=正解≤35%／語彙マッチ=正解≤45%／設問数/本文=公式固定（短1・中N5:2/N4:4/N3:3・長4）／**指示語必須**（中全級・長N3＝ファイルに指示語設問≥1。`classify()`は設問文の `指す|指し|指して|下線|＿＿|___` か「…指示詞…」＋何/どんな/指/意味 で検出）。字数帯[0.6×,1.5×]はWARNのみ。
  - **classify()の落とし穴**：中/長の設問文に `どれ|どちら|いつ|料金|当てはまる|条件|申込|予約|参加できる` が入ると**条件照合に誤タグ**され指示語カウントが減る。→ 中/長の設問文はこれらの語を避け、指示語問は「『それ』が指すものはどれか」の型（"指す"が先に一致するので"どれか"は可）。
- **情報検索**：`joho_figure_check`＝実効字数(body+figure)帯[0.6×,1.5×]・図版依存≥50%・figure欠落0／`joho_solvability`＝場面≥6種&最頻≤35%・走査S(情報源≥2)・走査C(「選ぶ」型4択中≥3が図版実在)【**S/CハードはN4/N3のみ**】。
- **★決定②（ユーザー承認2026-08-30）＝mock joho にバランス番人(`johoSkeletonBalance`=正誤≥5/場面≥6種/素材各≥3等)を課さない**。60問前提の絶対数要件で10問プールに不適（テスト自身がコメントで明記）。mock joho は**走査/図版/字数/一意性の実質ゲートのみ**。生成時は多様性を狙うが正誤≥5等は強制しない。

### 実スキーマの確定差分（要約と違う点）
- **joho `figure.kind` は route/poster/board でなく medium値**（"案内"/"パンフレット"/"お知らせ"等）が実データの慣習。図版型は `blocks[].type`(table/notice/card)で表現。`skeleton`(q_type/notice/scene/figure_pattern/medium/answer_sources)を直書き。
- 内容理解 item＝`{id,level,category:"dokkai",type:"reading",format,subtype,title,body,questions:[{id,q,choices[4],answerIndex,i18n:{ja:{explain}}}]}`。下線は本文中 `①<u>…</u>`。**pointId無し**（読解itemにpointId欄は存在しない＝agentは付けない）。**答えは choices[0]**（PassageSetPlayer描画時シャッフル）。
- 3ツールとも `dokkai/{daimon}_{lv}.json` 直下のみ走査＝**mock/を見ない**。→検証段で `--mock`/DDIR切替を足す（生成段は無関係）。

### ターゲット数（公式出題数×10・実コードSPECと突合済）
短 N5:30本30問/N4:40/N3:40 ・ 中 N5:10本20問/N4:10本40問/N3:20本60問 ・ 長N3:10本40問 ・ joho N5:10/N4:20/N3:20。**計210本文/320設問**。

### ★字数帯（ユーザー修正 2026-08-30・これが作問の正本＝下方の§1/§3の字数記述より優先）
**下限＝公式目標に引き上げ（激短禁止）**。**mock作問にのみ適用**（既存学習の帯は触らない＝下限を上げると既存joho/内容理解が新下限を割り build 赤になるため。検証段で mock/ 走査を足す時、mockには下記帯・学習には現行帯）。
- **内容理解（`dokkai_solvability`＝帯外WARN・非fail）**：agentはこの帯内に必ず収める（WARNでも品質基準として厳守）。

| 大問 | Lv | 公式目標 | 作問目標(狙い) | 下限 | 上限 |
|---|---|--:|--:|--:|--:|
| 短 naiyou_tan | N5 | 80 | 100〜120 | 80 | 120 |
| | N4 | 150 | 170〜200 | 150 | 225 |
| | N3 | 175 | 195〜245 | 175 | 262 |
| 中 naiyou_chu | N5 | 250 | 280〜300 | 250 | 335 |
| | N4 | 450 | 480〜520 | 450 | 675 |
| | N3 | 350 | 400〜480 | 350 | 500 |
| 長 choubun | N3 | 550 | 620〜650 | 550 | 670 |

- **情報検索 joho（実効字数=body+figure・帯は上下ハード＝`johoSkeletonBalance`字数テスト/`joho_len_check` の `BAND`）**：帯を厳守。

| Lv | 公式目標 | 作問目標(狙い) | 下限 | 上限 |
|---|--:|--:|--:|--:|
| N5 | 250 | 280 | 250 | 300 |
| N4 | 400 | **≤450（狙い約440）** | 400 | 450 |
| N3 | 600 | 680 | 600 | 700 |

**N4注意**＝目標=上限450で余白ゼロ→**狙いを約440字にして450を絶対に超えない**（超過は番人fail）。**帯下限より少し上を一発で狙い、後から加筆で刻まない**（往復浪費回避）。字数はルビ`（かな）`と空白を除いて数える。

### ★発射する10体（Opus・general-purpose・run_in_background・各体が自分のjsonへ即Write・read-agent禁止＝仕様はプロンプトに直書き）
出力先＝`scratchpad/dokkai_mock/out_{sub}_{lv}[_x].json`（item配列）。ID帯9001+（短S/中M/長L/情報J）。
- **波1(6体)**：`out_tan_N5`(30) `out_tan_N4`(40) `out_tan_N3`(40) `out_chu_N5`(10本×2問) `out_chu_N4`(10本×4問) `out_chu_N3`(20本×3問)
- **波2(4体)**：`out_cho_N3`(10本×4問) `out_joho_N5`(10) `out_joho_N4`(20) `out_joho_N3`(20)

### 各体プロンプト共通枠（これを埋めれば正しく作問する）
1. ja平文・素の漢字（**ルビ無し**＝別パス）。翻訳(en/ne)も**この段で作らない**。役割ベース（個人名禁止・同一人物は同一ラベル一貫）。答えは**choices[0]**。
2. **大問別ダミー重心**（短=焦点でない真の事実＋主体/時点/行為ずらし／中=指示先・因果の取り違え＋本文語を語形頭語そろえ再利用／長=言い過ぎ/一部だけ/一般論／joho=各誤答1条件だけ外す・決め手は※注記へ）。
3. 4択は字数そろえ・誤答にも本文語・正解は本文丸写し回避で言い換え（最長≤35%/語彙≤45%を自己満たす）。
4. **中/長は各本文に指示語設問≥1**＝設問文に「…」＋"指す"（条件照合トリガー語 どれ以外の料金/当てはまる/いつ 等は避ける）。中N5=指示語+理由／中N4=指示語+理由+内容+主張/内容の4問／中N3=指示語+理由+主張／長N3=指示語+理由+主張+定義。
5. joho＝body(状況+条件のみ・答え書かない)＋figure(header/intro/blocks:table+notice/notes/footer)＋skeleton(5軸直書き・kindはmedium値)＋各設問uniqNote。N4/N3は表密度(N3=8〜12行/N4=6〜8行・列≥4)＋※注記で走査S/C充足。図版型を2問で別型に。
6. 一意性自己申告＝あやしい設問に `uniqRisk:"high"|"mid"`＋`uniqNote`（理由1文）。自信あれば欄なし。

### /clear後の残作業＝設計書上部「4. 手順 B〜F」（ルビ別パス→配置→結線→機械検証[mock対応拡張]→一意性Excel→在庫）。push/ビルドは指示待ち。

## ★次の一手
ユーザーが /clear → 本ファイル実読 → 上記「実行確定」節どおり**波1(6体)発射**→波2(4体)。翻訳=Gemini Flash別パス（後日）。検証=機械のみ・mock joho balance番人は課さない（決定②）。ビルド/pushは指示待ち。

## ▶▶ 2026-08-31 走行中＝後日バッチ実行（ユーザー「今すぐ全部実行」）
- **確定した書き込み先アーキテクチャ**：翻訳は `item.i18n.ne.body`(配列)/`i18n.en.body`＋`q.i18n.ne/en.{q,choices}` に書けば rehydrate `readingMap` が READING_MOCK からも自動で PASSAGE_TRANS_NE/EN・Q_TRANS_NE/EN に捕捉（rehydrate.ts:50-62 で READING_MOCK は同じ readingMap 経由・確認済）。ルビは ja 各欄に `漢字（かな）`全角・熟語単位・自級以上（学習ファイル規約と一致確認済）。
- **件数**＝210本文/320設問。翻訳対象=joho以外160本文。joho(50本文)は翻訳不要・ルビは要（図版内テキスト含む）。漢字級=`src/data/dict/kanjiJlptLevel.json` items{char→N5/N4/N3/BEYOND}。
- **工程**：(B)ルビ＝抽出→Opus5体(tanchu_N5/N4/N3・cho_N3・joho全)→strip検証で書き戻し `scratchpad/dokkai_ruby/`。(C)翻訳＝`scratchpad/dokkai_trans/gen.mjs`(pgtrans/gen.mjs流用・batch checkpoint=二重課金なし・gemini-2.5-flash thinkingBudget0)→content へ i18n merge。→rebuild→tsc→npm test(passageTransNe を READING_MOCK 含むよう拡張)→publish-content(OTA)→D2実費報告→まとめて1コミット。push/ビルドは指示待ち。
- **agentはA1優先で自分の slice ファイルを Read＋出力Write**（生データを本体会話に載せない）。

### 2026-08-31 ルビ中断＝Opusセッション上限(HTTP429・東京2:00リセット)で5体失敗→部分救済済
- **完了2 slice**：tanchu_N5(323/323)・joho_N5(237/237)。**救済済(部分)3 slice**：tanchu_N4(31/570)・tanchu_N3(40/719)・cho_N3(104/260・半角(かな)→全角（かな）正規化で復活)・joho_N3(223/1088)。**未着手1**：joho_N4(0/959)。**全体 958/4156=23%完了**。
- **救済の実体**＝`scratchpad/dokkai_ruby/salvage_partial.py`（壊れJSONは正規表現で完全な"k":"v"組回収＋半角かな括弧→全角＋strip検証）。救済結果は各 `out_<slice>.json` に上書き保存済（strip検証パスした組のみ＝applyがそのまま使える）。**contentには未apply**（最終applyまで非ルビ維持＝再抽出の二重処理回避）。
- **残作業(Opus復帰後)**＝未処理キーだけの `in_<slice>_todo.json`（tanchu_N4/tanchu_N3/cho_N3/joho_N4/joho_N3・計3198キー）を同じルビ規則でOpus5体に流す→出力を各 out へ**マージ(追記)**→全7slice揃ったら `python scratchpad/dokkai_ruby/ruby_io.py apply`→翻訳→merge→rebuild。
  - ★todo再走行の注意＝出力先は `out_<slice>_todo.json` にして、salvage済 `out_<slice>.json` へマージ（上書きしない）。または todo出力を別名で受けて Python で dict.update。
- **翻訳(Gemini・未実施)**＝ユーザーが translation 実行を一旦保留(救済優先の指示)。`node scratchpad/dokkai_trans/gen.mjs`（strip=ひらがなルビ限定に修正済）で流せば160本文×en/ne。ルビ有無に非依存。checkpoint破棄済＝クリーンから走る。

### 2026-08-31 ルビ再開 ✅完了（ユーザー「ルビ再開して」）
- **✅ルビ100%完了＝4156/4156 全文**。残5 slice を Opus5体(background)で処理→各 `out_<slice>_todo_p*.json`→`out_<slice>.json` にマージ→`ruby_io.py apply` で content 書き戻し（**applied=4156・strip_mismatch=0**）。tanchu_N3 は1体が下請け丸投げ→是正指示で自作し直し(679手作業)。
- **★ruby_io.py の apply 照合を修正**：元テキストが既にルビを含む生成物があり(joho_N4 titleの `料理（りょうり）` 等20件)、旧 `strip(rv)==cont` が誤失敗→**`strip(rv)==strip(cont)`(両方からルビ除去して素の骨格一致)** へ変更(ルビ無し文には影響なし・後方互換)。
- **検証済**：全7 slice full被覆0欠落0余分・skeleton_mismatch0／content 10ファイル pool=mock・210 items・ルビ群多数・級ゲート正常(N3ファイルはN4/N5裸・熟語単位の末字spilloverのみ)。読み品質 spot-check OK(検査/図書館/映画館/効率的/満腹/和食/煮物 等)。
- **★次の一手＝翻訳(有料・別決定)**：ルビ完了ゆえ次は Gemini2.5Flash 翻訳(joho以外160本文＋設問 en/ne・実費約¥100・D2報告必須)。**ユーザーが「ルビ再開して」しか言っていない＝翻訳は未承認**。翻訳を走らせる前にユーザー確認。以降＝merge→rebuild→tsc→npm test(passageTransNe を READING_MOCK 含むよう拡張)→publish-content(OTA)→まとめ1コミット。push/ビルドは指示待ち。content mock は未結線でなく結線済(READING_MOCK)だが訳無し・現状 push/build 前ゆえアプリ非表示=実害なし。

### 2026-08-31 翻訳 ▶走行中（ユーザー「翻訳をお願いしたい」＝承認）
- **走行**＝`node scratchpad/dokkai_trans/gen.mjs`（background・checkpoint済でne 14/27は再課金なし・残ne13+en27≈40コール・gemini-2.5-flash thinkingBudget0・90秒timeout）。SETS=160本文/270設問（joho除く7ファイル）。out=`scratchpad/dokkai_trans/out/{ne,en}/batch*.json`。
- **完了後の残**：(1)`python scratchpad/dokkai_trans/merge_trans.py`＝mock の joho以外へ i18n.ne/en.body[配列]＋q.i18n.ne/en{q,choices}書き戻し＋languages=['ja','ne','en']（johoは['ja']）。欠body/欠qは再走で埋める。(2)`node --import tsx tools/content/rebuild.ts`。(3)tsc0。(4)npm test＝passageTransNe.test.ts を READING_MOCK 含むよう拡張。(5)publish-content.ps1(OTA)。(6)D2実費報告(_usage.json)。(7)まとめて1コミット。push/ビルドは指示待ち。

### 2026-08-31 翻訳 ✅完了（merge/rebuild/tsc/test 全緑・未publish/未コミット）
- **翻訳完了**＝ne 27/27・en 27/27 バッチ（全(6/6)/(4/4)・欠落0）。**D2実費（今回走行）＝gemini-2.5-flash・40コール・in87852/out109499/think0＝$0.3001≒¥47**（_usage.json）。※前回の部分走行(ne 14バッチ)も課金済だが _usage.json は毎回上書きゆえ正確値は非保持・見積¥100内。
- **merge**＝merge_trans.py で content/problems/dokkai/mock の joho以外7ファイルへ i18n.ne/en.body[配列]＋q.i18n.ne/en{q,choices}＋languages=['ja','ne','en']。書戻し items=160 questions=270 欠body=0 欠q=0。johoは['ja']維持。
- **検証**＝(1)rebuild(100 files) (2)tsc0 (3)**npm test 481/481緑**＝passageTransNe.test.ts を READING_MOCK 含むよう拡張済（wantReading に readingMock 合流・joho除外）→mock ne 必須化で緑。(4)構造spot-check＝270問 choices数一致・ne body全Devanagari非空・<u>付き52本文すべて en/ne で<u>保持・問題0。
- **★残＝publish-content(OTA)＋まとめて1コミット＝ユーザー明示指示待ち**（OTA=外部配信・push/build同様に指示ゲート）。現状 push/build 前ゆえアプリ非表示=実害なし。commit する時は content(dokkai/mock 翻訳)＋passageTransNe.test.ts拡張 を含める。決定②=mock joho balance番人課さない。
