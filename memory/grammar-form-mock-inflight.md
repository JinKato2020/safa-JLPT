# 文法形式 学習倍増＋模試プール新設 作問 inflight（正本・2026-08-30 確定）

状態: **【✅全工程完了・コミット済(未push/未ビルド) 2026-08-30】** 配置(learn 211→398／mock新設 N5:160/N4:150/N3:130)＋結線(rehydrate GRAMMAR_FORM_MOCK・index export・daimon HAS_MOCK_POOL+='grammar_form'/GF_MOCK_INDEX/mockUnitIds/questionForUnit)＋番人`src/data/grammarFormMock.test.ts`(6件・package.json登録)＋rebuild(84)＋tsc0＋npm test 458/458＋ランタイム実測OK(mockUnits160/150/130・cloze・空所〔　〕・学習非解決=汚染なし)＋在庫Excelチェーン(stock_report→mock_stock[bunpou N5=24回]→stock_excel→daimon_solvability --xlsx)＋一意性Excel(quality_excel・模試黄19/19/15・通常N5黄21)。**★配置時に2件の欠陥を機械修正**：(1)空所マーカー=生成物は`【　】`(U+3010)だったがアプリ実装([daimon.ts:344]/[QuizScreen.tsx:36])は`〔　〕`(U+3014)前提→全627問stem＋questionを`〔　〕`へ変換(inflight記載の「【　】固定」は誤りだった)。(2)新規learn stem 3件が既存211問とstem完全一致→pointId/answer/choices保持で別文脈へ最小改変(0313=公園に木がある/0334=遅れた理由/0341=歯を磨いてから)。**次=ユーザー指示でpush(OTA)/ビルド**。以下は作業記録(参考)。
旧状態: **【生成フェーズ完了 2026-08-30・クリア境界に到達】** ✅作問627問（学習187＝out_learn_N5_1/2/3・模試440＝out_mock_{N5a,N5b,N5c,N4a,N4b,N4c,N3a,N3b}）＋✅ルビ全付与済（scratchpad/gf_mock/*.json は**ルビ入り・answer=choices[0]再設定済**）＋✅全機械検証PASS（エラー0/id重複0/stem重複0/各点=4達成/pointId実在/ルビ括弧除去で原文一致・kana場面括弧の偽陽性1のみ）＋✅一意性チェックExcel出力済（`一意性チェック_文法形式.xlsx`・フラグ22件=全mid黄）。**次の一手＝/clear後に下記★手順の[4]配置から**（作問・ルビ・検証・Excelは完了。以降はエージェント不使用の機械作業のみ）。

### /clear後の残作業（ここだけ実行すればよい・機械作業のみ）
1. **配置**：out_learn_N5_1/2/3.json を結合→`content/problems/bunpou/grammar_form_N5.json` の items に追記（211→398）。out_mock_* を level毎に結合→新規 `content/problems/bunpou/mock/grammar_form_{N5,N4,N3}.json`（file レベルに `pool:"mock"` `daimon:"grammar_form"` `level` `languages:["ja"]`・itemに `i18n:{}` を付与）。※scratchpadのitemは i18n 無しゆえマージ時に `"i18n":{}` を足す。
2. **結線**（下記「### アプリ結線」の差分をそのまま適用）：rehydrate.ts に GRAMMAR_FORM_MOCK・index.ts re-export・daimon.ts（import/HAS_MOCK_POOL+='grammar_form'/GF_MOCK_INDEX/mockUnitIds分岐/questionForUnit）・MockScreen変更不要・番人 grammarFormMock.test.ts 新設＋package.json 登録。
3. `node --import tsx tools/content/rebuild.ts`→`npx tsc --noEmit`（0）→`npm test`（緑）。
4. **在庫Excelチェーン**（[[stock-record-to-excel-not-txt]]）：stock_report→mock_stock（文法形式 模試 N5:160/N4:150/N3:130 追加）→stock_excel→daimon --xlsx。模試換算 N5文法形式 13→約24。
5. まとめてコミット（push/ビルドはユーザー明示指示のみ）。生成=Opusエージェント／**検証は機械のみ（反証・修正エージェント無し）**／**ルビは別パス**／最後に在庫Excel＋模試換算更新。

---
## ★実行仕様（2026-08-30 確定・準備完了。ここだけ読めば作問開始できる）★

### 一次情報の実測（確認済）
- N5学習 `content/problems/bunpou/grammar_form_N5.json`：現211問・99点。分布 have1×18/have2×58/have3×17/have4×5/have6×1。**不足=187問**（need3×18点＋need2×58点＋need1×17点）。
- 既存 `-B-` id 最大=**227** → 新規学習idは **`N5-G-B-0228〜`** から連番（0212ではない・衝突回避）。
- スキーマ実測 = `{id, stem, question, answer, choices[4], pointId, i18n}`。**question は固定 `"【　】に入るのは？"`**。stem=ルビ入り本文＋全角空所 `【　】`1個。**choices[0]=answer**（正解位置0・表示時シャッフル）。i18n は学習既存＝`{}`（explain無し）でよい。誤答3つは同カテゴリの実在形。
- grammar.json 実在点数：N5=91・N4=131・N3=186（正本 `src/data/shared/grammar.json`・pointId は必ずこの実在idのみ）。

### エージェント↔担当スライス↔出力ファイル（計11体・各体が自分のjsonへ即Write）
参照ブロック（担当pointId＋カテゴリ＋問数）は各 `scratchpad/gf_mock/slice_*.txt`（生成済）。**エージェントには該当txtの中身をargsで直接渡す（B1：agentにファイルreadさせない）**。
- 学習3体（+187・id `N5-G-B-0228〜` を連番で割当。同id重複禁止＝波内で番号帯を分ける：S1=0228-0290 / S2=0291-0352 / S3=0353-0414）
  - `slice_learn_N5_1.txt`(31点63問) → `scratchpad/gf_mock/out_learn_N5_1.json`
  - `slice_learn_N5_2.txt`(31点62問) → `out_learn_N5_2.json`
  - `slice_learn_N5_3.txt`(31点62問) → `out_learn_N5_3.json`
- 模試8体（`pool:"mock"`・id `N{lv}-G-GM-####`・languages `['ja']`・note="模試専用プール。通常学習に出さない。公式頻度ミラー・全問ユニーク。"）
  - N5(160)：`slice_mock_N5a.txt`(助詞55) `…N5b.txt`(助詞25+疑問10+こそあど10+活用10=55) `…N5c.txt`(副詞20+否定10+場面20=50)。id帯 GM-0001-0055 / 0056-0110 / 0111-0160。
  - N4(150)：`…N4a.txt`(条件逆接40+助詞10) `…N4b.txt`(様態伝聞20+目的20+助詞10) `…N4c.txt`(授受敬語20+こと/て系30)。id帯 0001-0050 / 0051-0100 / 0101-0150。
  - N3(130)：`…N3a.txt`(複合助詞20+時条件20+限定評価20+敬語5=65) `…N3b.txt`(副詞呼応20+モダリティ20+可能見込20+敬語5=65)。id帯 0001-0065 / 0066-0130。
  - 出力＝`out_mock_{N5a,N5b,N5c,N4a,N4b,N4c,N3a,N3b}.json`。
- 波：3～4体ずつ（例 波1=学習3体、波2=模試N5 3体、波3=模試N4 3体、波4=模試N3 2体）。各体Write完了でディスク確定。

### 作問プロンプト骨子（全模試/学習共通・md/06準拠）
- 同カテゴリで4択を完全に揃え、意味/場面の鍵1点で切る（品詞・級で消せる誤答は不可）。個人名禁止＝役割ベース（店員/客・先生/学生・A/B）。
- 会話の意図（依頼/申し出/推量）が1つに定まる文脈に。一意性は検証せず**生成時に自己申告** `uniqRisk:"high"|"mid"`＋`uniqNote`（自信あれば欄なし）。
- pointId=正解が測る文法。stem内に偶然入った形をpointIdにしない。**ルビは付けず平文で作る（ルビは別パス）**←今回は別パス方針ゆえ生成時stem/answer/choicesは漢字平文でよい（後でルビ付与）。※ただし空所 `【　】` は必ず入れる。
- 出力=JSON配列（itemの配列）。各item `{id, stem, question:"【　】に入るのは？", answer, choices:[answer,誤1,誤2,誤3], pointId, uniqRisk?, uniqNote?}`。mockは加えて生成後スクリプトで `pool:"mock"` をファイル側に付与（fileレベル）。

### 機械検証（python・エージェント無し・エラーはユーザー提示）
1. 件数：学習+187（各点=4達成）・mock 160/150/130。id一意・帯正規。
2. choices=4・choices[0]=answer・4択distinct・pointId が grammar.json 実在。
3. stem に `【　】` 丁度1個・question固定文一致。
4. stem全ユニーク（mock：pool内distinct／学習：既存211stemと非重複）。
5. mockカテゴリ配分＝設計値。

### アプリ結線（コード差分・確定＝USAGE_MOCKと同型）
- `src/data/content/rehydrate.ts` line37 USAGE_MOCK の直後に追加：
  `const GRAMMAR_FORM_MOCK = bankItems(files, 'grammar_form', (it, level) => ({ ...stripI18n(it), level, daimon: 'grammar_form', explain: it.i18n?.ja?.explain, explainEn: it.i18n?.en?.explain, explainNe: it.i18n?.ne?.explain }), true);`
  → return オブジェクト（line77）に `GRAMMAR_FORM_MOCK` 追加。
- `src/data/index.ts`：USAGE_MOCK と同様に `GRAMMAR_FORM_MOCK` を re-export。
- `src/data/daimon.ts`：
  - line6 import に `GRAMMAR_FORM_MOCK` 追加。
  - line121 `HAS_MOCK_POOL` に `'grammar_form'` 追加（＝抜き取り廃止・学習は全398／split無効化。これは意図通り）。
  - line205 USAGE_MOCK_INDEX の直後に：`const GF_MOCK_INDEX = new Map<string, BankUnit>((GRAMMAR_FORM_MOCK as unknown as BankUnit[]).map((e) => [e.id, e] as const));`
  - line168 mockUnitIds に分岐追加：`if (daimon === 'grammar_form') return (GRAMMAR_FORM_MOCK as unknown as BankUnit[]).filter((e) => e.level === level).map((e) => e.id);`（usage分岐の隣）。
  - line250 questionForUnit：`const bank = (useMock ? USAGE_MOCK_INDEX.get(unit) : undefined) ?? BANK_INDEX.get(unit);` を `const bank = (useMock ? (USAGE_MOCK_INDEX.get(unit) ?? GF_MOCK_INDEX.get(unit)) : undefined) ?? BANK_INDEX.get(unit);` に。
  - ※grammar_form mock items は既存 `if (bank)` 分岐（line251-258）で daimon==='grammar_form'→furi付きで描画。追加ロジック不要。
- `src/screens/MockScreen.tsx`：**変更不要**。knowledgeForDaimon が mockUnitIds(lv,'grammar_form') を拾い、seen優先で10回横断id重複回避、usedWords=`grammar:<pointId>` で大問横断の点重複回避（order/passage_grammarと共有）。
- 番人：`src/data/grammarFormMock.test.ts` 新設（contextMock.test.ts同型：件数/pool分離/id帯/choices[0]=answer/pointId実在）＋ **package.json の test 列挙に追加**（グロブでない）。
- `node --import tsx tools/content/rebuild.ts`（_manifest再生成）→ `npx tsc --noEmit` 0 → `npm test` 緑。

### 配置・コミット
- 学習：out_learn_N5_*.json を結合し `grammar_form_N5.json` の items に追記（211→398）。mock：out_mock_*.json を level毎に結合→`content/problems/bunpou/mock/grammar_form_{N5,N4,N3}.json`（新規フォルダ・fileに `pool:"mock"` `daimon:"grammar_form"` `level` `languages:["ja"]`）。
- 在庫Excelチェーン＋模試換算（N5文法形式 13→約24）＋一意性Excel（quality_excel.py が grammar_form mock/学習を読むか要確認・読まねば対象パス追加）。
- push=OTA。コード変更は次ビルドで実機反映。**ビルドはユーザー明示指示のみ**。

---


## ユーザー確定事項（2026-08-30・最終）
- Q1=**N5 学習だけ**。倍率は「一律2倍」でなく**各点を4問に揃える**（ユーザー最終決定）。現行 割増表記は×1だが実データは約2.1問/点（漢字読みのような機械増しでなく公式準拠で既に複数問）。N4/N3 学習は据え置き。
- Q2=模試の点選定は**公式頻度ミラー（高頻度点ほど問題数を厚く）**。ただし各問題文は**全ユニーク**で **10回横断で同じ問題を絶対に出さない**（既見＝模試にならない）。一律1問ずつにしない＝高頻度点は複数の異なる問題を持つ。
- 検証=機械のみ。ルビ=生成後に別パス。良問を公式の型で新規作問（既存学習からのコピー流用は不可＝初見必須）。
- 実行=**クラッシュ耐性優先**＝少数ずつの波(3〜4体)＋各体が自分のjsonへ即Write（上限到達でも失うのは実行中の波だけ・[[subagent-bulk-checkpoint-flow]]）。体数削減より波＋Writeで守る（総トークンは問題総数で決まり体数では減らない）。

## 成果物（2本立て）
### A. N5 学習プール増産（各点を4問に揃える）
- 対象=`content/problems/bunpou/grammar_form_N5.json`（現211問・99点）に**+187問を追記**（合計398）。
- 方法=**各 pointId を丁度4問に揃える**（既にある分はそのまま／不足分だけ新規の別問題を追加）。同じ文法点・別の文/文脈・別の正解語形。**流用不可＝全別問**。
  - 現分布→不足数: 1問×18点→+3ずつ(54)／2問×58点→+2ずつ(116)／3問×17点→+1ずつ(17)／4問×5点→0／6問×1点→据置。**新規計187**。最終=98点×4＋1点×6=398。
- id帯=既存 `-B-` の続き `N5-G-B-0212〜`（学習・pool欄なし）。
- 既存stemとの重複禁止（機械dedup）。ルビは別パス。
- 模試換算=211→398 ÷16 → 13→**約24回**（floor）。
- **N4/N3 学習は触らない。**
- 準備=`python tools/grammar_pointid_counts.py`（無ければ集計スクリプト）で N5 grammar_form の pointId 別現数を出し、各点の「あと何問要るか(=4-現数, 負は0)」表を作ってエージェントに配分。

### B. 文法形式 模試専用プール（新設・bunpou 初）
- 出力=`content/problems/bunpou/mock/grammar_form_{N5,N4,N3}.json`（新規フォルダ）。`pool:"mock"`・note="模試専用プール。通常学習に出さない。公式頻度ミラー・全問ユニーク。"
- 数=**N5:160 / N4:150 / N3:130**（公式16/15/13 × 10回）＝計440問。**全問ユニーク（10回横断で重複ゼロ）**。
- id帯=`N{lv}-G-GM-####`（学習 -B- と非衝突。GM=Grammar Mock）。
- 点選定=公式頻度ミラー。**高頻度カテゴリほど distinct 問題数を厚く**（10回分の合計＝各回ブループリント×10）。
  - **N5(16/回)**: 助詞8・活用形1・こそあど1・疑問詞1・副詞2・否定語形1・場面/会話2。→10回で 助詞≈80/副詞≈20/場面≈20… 助詞は に/で/を/が/へ/と/は/も/か/や に分散、各点に複数の別問題。
  - **N4(15/回)**: 条件逆接(のに/ても/から/なければ)≈4・助詞(か/しか/など/ぐらい)≈2・様態伝聞(そう/よう)≈2・目的(ために/ように)≈2・授受敬語≈2・たら/たり/ことにする等≈3。
  - **N3(13/回)**: 複合助詞視点(にとって/にたいして/において/によって)≈2・時条件(たびに/うちに/としたら等)≈2・限定評価(とはかぎらない/ばかり等)≈2・副詞呼応(せっかく/いくら/まるで等)≈2・モダリティ授受伝聞≈2・敬語≈1・可能見込語形(そうにない/わけがない等)≈2。
  - 各回内は点を重複させない（またはできる限り分散）。回をまたいで点は再利用可だが**問題文は別**。
- スキーマ=学習と同形 `{id, stem(ルビ入り・【　】1個), question:"【　】に入るのは？"（学習踏襲）, answer(ルビ入り), choices([4]・**choices[0]=answer**・全て同カテゴリの実在形), pointId, i18n:{ja:{explain}, ...}, uniqRisk?, uniqNote?}`。languages=['ja']（他大問mock踏襲・ne後日OTA）。

## スキーマ実測（grammar_form 学習・この形で作る）
`{id, stem, question, answer, choices[4], pointId, i18n}`。stem=ルビ入り本文＋空所マーカー`【　】`（全角）1個。question=固定`「【　】に入るのは？」`。choices は**正解を含む4択**（choices[0]=answer・正解位置0・表示時シャッフル）。誤答=同一カテゴリの実在形で品詞消去を封じる。

## ダミー設計（プロンプトに埋める・正本=md/06_文法形式判断.md 実読必須）
- **同カテゴリで4択を完全に揃え、意味/場面の鍵1点で切る**（＝文脈規定と同型）。品詞や級で消せる誤答は不可。
- N5=会話/場面比率高（店員/客・先生/学生・A/B の役割ベース＝個人名禁止[[content-borderless-no-names]]）。助詞が主力(8/16)。総ルビ。
- N4=同一語幹の活用/接続/機能だけ替えた4形＋機能近接助詞。前後の意味関係(条件/逆接/伝聞/目的)で切る。会話多め。
- N3=複合助詞・呼応・敬語の向き（尊敬↔謙譲）・語形（そうにない/わけがない）。後件固定→前件4択で一意化。
- **一意性=会話の意図(依頼/申し出/推量)が1つに定まる文脈に**（文末よ/ね/か＋相手の応答で固定）。一意性は検証せず**生成時に自己申告** uniqRisk/uniqNote（正本=md/一意性自己申告ルール.md・[[uniqueness-self-declaration-in-generation]]）。
- pointId=**正解が測る文法**に一致（文中に偶然入った形をpointIdにしない・md冒頭ルール）。pointId は `src/data/shared/grammar.json` 実在id(n{lv}-g-#)のみ。

## 作問エージェント計画（B規律・Opus・agent自身がWrite・read-agent禁止=argsで直接渡す・**波＋Writeでクラッシュ耐性**）
- **実行=3〜4体ずつの波**。各体は自分の scratchpad json へ即Write（完了波はディスク保存＝上限到達でも失うのは実行中の波だけ）。総トークンは問題総数(627)で決まり体数では減らない→体数削減でなく波で守る。
- args に「担当スライスの pointId＋点の意味/例＋ダミー設計ルール＋スキーマ＋id帯」を直接埋める（既存stemは渡さず「別文脈で」厳命→機械dedup）。目安 <64k/Write。
- **A(N5学習+187)**: 3体（各≈62問）。担当 pointId 群＋各点の不足数を配分。
- **B(模試)**: N5 160=3体／N4 150=3体／N3 130=2体（各回ブループリント×担当回。カテゴリ配分厳守・全問ユニーク）。
- 計 **≈11体（生成）**。**独立verify段なし**（自己申告のみ）。品質最優先=Opus（安価モデルに落とさない[[quality-critical-gen-use-opus]]）。ルビ別パスも波で（軽いので束ねて数体）。

## ルビ別パス（作問後）
- stem/answer/choices/(question固定は不要) に `漢字（かな）`全角括弧を付与。**LLMが正本**（MeCab18%誤る[[sentence-furigana-needs-llm]]）。付与範囲=自級以上の漢字（N5模試/学習は総ルビ＝ほぼ全漢字）。省トークン方式=「平文→読みだけ返させ機械マージ」。
- ※recent mockはインライン生成したが、今回はユーザー指示で**別パス**。

## 機械検証（エージェント無し・python/nodeで）
1. 件数=目標（N5学習+187で各点=4[6の1点除く]・mock 160/150/130）。id一意・id帯正規（-B- / -GM-）。各点=4問の達成を機械確認。
2. choices=4・choices[0]=answer・answer∈choices・4択distinct・pointId が grammar.json 実在。
3. stem に `【　】` 丁度1個。question=固定文。
4. **stem全ユニーク**（mock は10回横断重複ゼロの担保＝pool内distinct）。学習+211は既存211stemと非重複。
5. mock: カテゴリ配分＝各回ブループリント×10の許容誤差内。各回内 point重複最小。
6. ルビ後=全角括弧の対応が取れている・括弧除去で平文が生成前と一致。
7. エラーは**修正前にユーザーへ提示**（勝手に直さない）。

## アプリ結線（mock・context/synonym と同型）
- `src/data/content/rehydrate.ts`: `GRAMMAR_FORM_MOCK = bankItems(files,'grammar_form',map,true)` を追加（wantMock=trueでpool='mock'分離）。KNOWLEDGE_BANK は既に mock除外。return に追加。
- `src/data/index.ts`: `GRAMMAR_FORM_MOCK` を export。
- `src/data/daimon.ts`: `HAS_MOCK_POOL` に `'grammar_form'` 追加。`GF_MOCK_INDEX/MULTI`（USAGE_MOCK/CONTEXT_MOCK同型）＋`mockUnitIds('grammar_form')`＋`questionForUnit` の useMock分岐。grammar_form は 'cloze'/item系(KNOWLEDGE_BANK)。
- `src/screens/MockScreen.tsx`: knowledgeForDaimon が grammar_form mock を拾うか確認。**10回横断で同一問題を出さない**＝used（既出id）で回またぎ非重複を担保（MockScreenのサンプリングを要確認・必要なら withoutReplacement 化）。
- 番人=`src/data/grammarFormMock.test.ts` 新設（contextMock.test.ts 同型）＋**package.json の test 列挙に追加**（グロブでない）。
- `node --import tsx tools/content/rebuild.ts`（_manifest再生成・OTA必須）→ tsc0 → npm test 緑。

## 在庫Excel＋模試換算（最後）
- 学習+211反映: `tools/stock_report.py`→`tools/mock_stock.py`（模試換算 N5文法形式 13→26）→`tools/stock_excel.py`→`daimon --xlsx`（[[stock-record-to-excel-not-txt.md]] の再生成チェーン）。
- mock 440 は在庫に数えない（在庫=学習のみ）。Excel「模試問題数」列に 文法形式 160/150/130 追加（stock_excel.py の MOCK dict）。
- 一意性Excel: `python tools/quality_excel.py`→`一意性チェック_模試_{N5,N4,N3}.xlsx`＋`_通常_N5`（grammar_form mock/学習を読むか要確認・読まねば対象パス追加）。

## コミット方針
- push=OTAでcontent配信。daimon/index/rehydrate/MockScreen等コード変更は**次ビルドで実機反映**（それまで旧アプリはpool='mock'非表示＝学習混入なし）。**ビルドはユーザー明示指示のみ**[[never-build-without-explicit-order]]。

## 手順（/clear後の実行順）
1. 生成エージェント起動（A=3体・B=N5 3/N4 3/N3 2体＝計11体）を**3〜4体ずつの波**で。各体 scratchpad へ即Write。
2. 機械検証（上記1-5）→ エラーはユーザー提示。
3. ルビ別パス → 機械検証6。
4. 本ファイル群を content/ 所定パスへ確定配置（学習は追記・mockは新規）。
5. 結線（rehydrate/index/daimon/MockScreen/番人）＋rebuild＋tsc＋npm test。
6. 在庫Excel＋模試換算＋一意性Excel。
7. まとめてコミット（push/ビルドはユーザー指示待ち）。
