# 文章の文法(passage_grammar) N4/N3 リビルド — inflight（/clear耐性）

## 【2026-08-21 完了(未コミット/未ビルド)】N3 計50問＝live追記済・ビルド指示待ち
- ルビ検算exit0→**live追記**: `passage_grammar_N3.json` items=20→**50**(0001-0050・全文ルビ・item形式)。
- テスト更新: passageGrammar.test.ts(150→**180**・{N5:80,N4:50,N3:50})・passageGrammarWire.test.ts(150→180・N3 20→**50**)・passageTransNe.test.ts(借金150→**180**)。`_manifest`再生成(N3 count=50)。
- **番人28/28緑・tsc0**・在庫チェーン再生成(在庫15900・N3満試25回)。
- **確認用Excel(全50・ルビ付)**: `問題/N3_文章の文法_確認用_全50問.xlsx`(exporter=`tools/export_n3_passage_grammar_review.py`・旧`N3_文章の文法_確認用.xlsx`は開いてた為別名)。ユーザー確認中。
- **通算カバー0001-0050＝126/186＝67.7%**。SOFT目視=N3-G-S-0030。
- **未コミット/未ビルド**＝content(passage_grammar_N3.json)・_manifest・bundled.generated・3テスト・在庫Excel/txt・exporter。**ビルドはユーザー指示待ち**(前回2832でN4新50は端末反映済・今回のN3 21-50はまだ端末に無い→次ビルドで載る)。RUN_BALANCE=false据置(126点・全186未達)。
- N3残り＝80問目標まであと30セット(0051-0080・alloc new_sets[50:80]・`build_specs_n3.py --start 51 --count 30 --prefix n3c`)。

## 【2026-08-21 履歴】N3 21-50＝生成→機械ゲート→ルビ
- 5体完了→結合`assembled_n3b_30.json`(30・N3-G-S-0021..0050)。機械ゲートexit0(HARD0)。SOFT1件=N3-G-S-0030(目視)。
- **通算カバー0001-0050＝126/186＝67.7%**・cap max2・超えなし。
- **ルビ走行中 run＝ae2091400cf4e4322**(general-purpose・Opus)。出力=`ruby_out_n3b_p1..p3.json`(各10・0021-30/0031-40/0041-50)。検算=`PG_ASSEMBLED=assembled_n3b_30.json PG_RUBY_GLOB="ruby_out_n3b_p*.json" PG_COUNT=30 PG_BAND="380,500" python validate_ruby.py`。
- **ルビ後**: ①検算exit0 ②確認用Excel全50版を再生成しユーザーへ(exporter --include-drafts をルビ版で・またはlive追記後に通常出力) ③live追記(20→50・item形式・設問id={sid}-q{blankNo}) ④テスト(passageGrammar/Wire 150→180・N3 20→50／passageTransNe 借金150→180) ⑤_manifest再生成→番人/tsc→在庫 ⑥**ビルドはユーザー指示待ち**(前回2832でN4新50は端末反映済)。

## 【2026-08-21 走行中→完了】N3 21-50（30セット追加・計50問へ）作問
- ユーザー指示「n3 21-50問へ」。スペック=`build_specs_n3.py --start 21 --count 30 --prefix n3b`→`spec_n3b01..05.json`(7/7/7/7/2・id N3-G-S-0021..0050)。字数帯380-500。
- **カバー見込み**: 21-50で新規66点・**計126/186=67.7%**(0001-0020の60→126)。cap≤3充足(max2)。
- **走行中5体**(general-purpose・Opus・独立verify無し): out_n3b01(0021-0027)/b02(0028-0034)/b03(0035-0041)/b04(0042-0048)/b05(0049-0050)。
- **再開手順(5体完了後)**:
  1. 機械ゲート: `cd scratchpad/pg/gen && PG_BAND="380,500" PG_SELF_LEVEL="N3" python validate_out.py out_n3b01.json out_n3b02.json out_n3b03.json out_n3b04.json out_n3b05.json`。HARD>0は該当specだけregen→再ゲート。**加えて0001-0050通算のcap≤3を確認**(alloc設計上OKだが要検算)。
  2. 目視HTML: `python make_review_html.py out_n3b01.json out_n3b02.json out_n3b03.json out_n3b04.json out_n3b05.json`→ユーザーへ送付(一意性はビルド後にユーザー目視の方針)。
  3. ルビ: assemble→list→1エージェントで全30本インラインルビ(64k回避で3分割 `ruby_out_n3b_p1..p3.json`)→`PG_ASSEMBLED=assembled_n3b_30.json PG_RUBY_GLOB="ruby_out_n3b_p*.json" PG_COUNT=30 PG_BAND="380,500" python validate_ruby.py`。
  4. live追記: `passage_grammar_N3.json` items=20→50(0021-0050をitem形式で追加・設問id={sid}-q{blankNo}・i18n空)。
  5. テスト更新: passageGrammar.test.ts(150→180・N3 20→50)・passageGrammarWire.test.ts(150→180・N3 20→50)・passageTransNe.test.ts(借金150→180)。
  6. `_manifest`再生成→番人/tsc→在庫チェーン→**ビルドはユーザー指示待ち**(前回2832でN4新50は端末に載る)。RUN_BALANCEはfalse据置(126点・全186未達)。

## 【2026-08-21 完了】N3 20セット＝live採用→ビルド（N4新50も同梱）
- ルビ完了→検算exit0（`PG_ASSEMBLED=assembled_n3_20.json PG_RUBY_GLOB="ruby_out_n3_p*.json" PG_COUNT=20 PG_BAND="380,500" python validate_ruby.py`＝改変ゼロ・二重ルビ0・構造不変）。
- **live差替**: `content/problems/bunpou/passage_grammar_N3.json` を旧40→新20（item形式・全文ルビ・設問id={sid}-q{blankNo}・i18n空・skeleton保持）。旧40は`没問題/文章の文法_旧_2026-08-21/passage_grammar_N3_旧40_2026-08-21.json`へ退避（可逆）。
- **テスト更新**: passageGrammar.test.ts（200→150・{N5:80,N4:50,N3:20}）・passageGrammarWire.test.ts（200→150・N3 40→20）・passageTransNe.test.ts（未訳借金170→150）。※passageGrammar.test/Wireは**N4差替時に更新漏れで赤だった**のを今回実体へ修正。
- `_manifest`再生成（N3 count=20）。番人15/15緑＋残11/11(0 fail・balanceはRUN_BALANCE=falseでskip)・tsc0。在庫チェーン再生成（stock_report/mock_stock/stock_excel・在庫15750）。
- **重要**: N4新50はOTA配信のみで直近ビルド(2829)に未同梱だった→**今回のビルドで N4新50・N3新20 とも端末に載る**（bundled.generated.tsがcontentを静的import）。
- カバー率＝N3 60/186＝32.3%。残126点は次作問（配分表n3_alloc.json）。RUN_BALANCEはfalse据置。

## 【2026-08-21 途中経過（参考）】N3 20セット＝生成→機械ゲート→ルビ
- **生成完了**: out_n3_b01(0001-0007)/b02(0008-0014)/b03(0015-0020) 全20。結合=`assembled_n3_20.json`（**list形式**・N4と同じ）。
- **機械ゲート（N3対応済）exit0**: `PG_BAND="380,500" PG_SELF_LEVEL="N3" python validate_out.py out_n3_b01.json out_n3_b02.json out_n3_b03.json`。HARD=0。SOFT1件=N3-G-S-0003#1（否定呼応副詞混在だが本文肯定で誤答不成立＝一意性強・偽陽性寄り）。
- **カバー率＝60/186＝32.3%**（20セットで自級N3点60点をcap内で網羅）。残126点は次作問。
- **ユーザー指示（2026-08-21）＝一意性チェックはビルド後。とりあえずルビ付け→ビルド**。A/B（全面差替 vs 0001-0020差替）は**全面新規＝旧40退避**方針で進める（[[content-ota-vs-ui-build]]・N4先例=80→50全面差替）。旧40は`没問題/文章の文法_旧_2026-08-21/`へ（N4と同フォルダ配下にN3サブ）。
- **ルビ検算 N3対応済**: `PG_ASSEMBLED=assembled_n3_20.json PG_RUBY_GLOB="ruby_out_n3_p*.json" PG_COUNT=20 PG_BAND="380,500" python validate_ruby.py`。
- **走行中 run＝ルビエージェント add9bfb15a745e700**（general-purpose・Opus）。出力=`ruby_out_n3_p1.json`(0001-0010)/`ruby_out_n3_p2.json`(0011-0020)。
- **ルビ完了後の手順**: ①validate_ruby（上記env）exit0確認②ruby2ファイル結合→passage_grammar_N3.json items形式へ（旧40退避）③passageGrammar.test.ts/passageGrammarWire.test.ts のN3件数(40→20)・S.length更新④`_manifest`再生成⑤番人/tsc⑥在庫チェーン⑦**ビルド**⑧commit+handoff。RUN_BALANCEはfalse据置。

## 【2026-08-21 走行中→完了】N3 20セット 作問（旧・参考）
- ユーザー指示: N3を**20セットだけ**作問→ルビ→アプリ実装(OTA)。**品質チェックはユーザーが目視**。独立verify段は入れない(自己反証＋機械ゲートのみ)。
- スペック済: `scratchpad/pg/gen/build_specs_n3.py`（実行済）→ `spec_n3_01..03.json`（7/7/6セット・id N3-G-S-0001..0020）。字数帯380-500・own_points=N3点・filler=N4/N5。
- **走行中エージェント3体**（background・出力先）: `out_n3_b01.json`(0001-0007) / `out_n3_b02.json`(0008-0014) / `out_n3_b03.json`(0015-0020)。run IDは台帳 run-ledger.jsonl。
- **再開手順（3体完了後）**:
  1. `out_n3_b01..03.json` を結合→ `assembled_n3_20.json`（sets結合）。機械ゲート: 字数380-500・各セット5問4択・own_point3・送りがな二重0・choices重複0・answerIndex範囲。落ちたら該当specだけ再生成。
     - **ゲート実行コマンド（N3対応済・2026-08-21）**: `cd scratchpad/pg/gen && PG_BAND="380,500" PG_SELF_LEVEL="N3" python validate_out.py out_n3_b01.json out_n3_b02.json out_n3_b03.json`（validate_out.pyにenv化を実装＝N4既定は不変）。HARD>0なら該当setだけregen→再ゲート。SOFTはユーザー目視。
  2. **ユーザーが問題を目視**（一意性・品質）。OKが出てから次へ。
  3. ルビ付与（N4と同方式・本文＋漢字含む選択肢のみ・二重ルビ0・strip一致検証）。
  4. 本番 `content/problems/bunpou/passage_grammar_N3.json`（現在旧40問 N3-G-S-0001..0040）へ差替。※20セットなので全面差替か0001-0020差替かは**ユーザーに確認**（旧40は退避）。
  5. 番人 `passageTransNe.test.ts` の未訳借金を実数へ更新（現170）。`publish-content.ps1` でOTA配信。

## 【2026-08-21 完了】N4 採用⑤＝live差替＋OTA配信 済
- 本番 `content/problems/bunpou/passage_grammar_N4.json` を旧80問→新50問（全文ふりがな付与）へ全面差替。旧は `没問題/文章の文法_旧_2026-08-21/` に退避（復元可）。
- 検証: id 0001-0050連番・本文strip一致・【1】〜【5】各1回・全問choices4・二重ルビ0。content検証17/17緑。
- 番人 `src/data/exam/passageTransNe.test.ts` の未訳借金 200→170 更新（NE訳は方針どおり未作成）。
- 配信: `tools/publish-content.ps1` で push 済み（commit 843df657）。Pages run https://github.com/JinKato2020/safa-JLPT/actions/runs/32453075570 。端末は次回起動でDL→そのまた次で反映。
- **次の一手（N4残）**: NE/EN訳の作成は保留中（有料API・要見積承認）。RUN_BALANCE番人は未有効化（n5点のcap>3が8点あり要確認）。
- **N3は未着手**（同方式で全面新規→採用が残タスク）。

設計正本＝`md/08_文章の文法.md`「★N4/N3 文法ID紐づけ・カバー率リビルド」。番人＝`src/data/bunshouGrammarBalance.test.ts`（build.ps1登録済・`RUN_BALANCE=false`＝リビルド後にtrue）。

## 方針（2026-08-21 ユーザー決定）
- N4・N3ともに**全面新規**。既存 N4 80＋N3 40 は `没問題/文章の文法_旧_2026-08-21/` にバックアップ済（live差替は採用⑤で）。
- 到達目標＝カバー100%（N4 131/131・N3 186/186）・各本≥3自級点・同一級点≤3回・場面最頻≤20%/≥8系統・字数 N4 340-460/N3 380-500。
- 配分表（生成入力）＝`scratchpad/pg/allocation/{n4_alloc.json,n3_alloc.json,配分表.md}`（各本 scene＋own_points3点・set_id付き）。

## パイロット結果（N4 40セット・wf_79fface8-161 完了 2026-08-21）
- **品質良好・方式成功**。構造/字数帯/pointId/cap は全40クリーン。自級カバー81点(40本で既に60%超)。
- 欠陥2種（プロンプトで解決）: ①送りがな二重 約8本（本文に活用語幹を残す）②近義副詞の第2正解 約7本（あまり/ぜんぜん両立）。答え露出4件は誤検知。
- 対策済: `build_specs.py` の RULES に「送りがな二重の禁止」「誘導肢の禁じ手」を追記。`validate_out.py` に robust LCP の送りがな二重チェック。
- 反証で落ちた15本＝0002,0003,0007,0009,0010,0011,0012,0015,0027,0028,0029,0033,0036,0038,0039。

## 走行中 run
- **wf_01772338-51b（task w2x3g6cbh）＝上記15本を更新ルールで焼き直し＋再反証**（2026-08-21起動）。
  - spec＝`spec_n4_r01..r03.json`（5×3）／出力＝`out_n4_rNN.json`・`verdict_n4_rNN.json`。返り＝{nonunique,okurigana_dup,out_of_band,other_issues}。
  - builder＝`build_specs.py`(全spec再生成)→`regen_specs.py`(15本抽出)。検算＝`validate_out.py`。

## 【方針変更 2026-08-21】独立エージェントの一意性チェックは今後やらない
- ユーザー指示＝一意性は**ユーザー自身が確認する**。**今後の生成ワークフローに独立verify段を入れない**。
- 代わり＝①生成プロンプトの自己反証を強化（選択肢差し込み全文を正解伏せで自己判定）②機械ゲート（構造/字数/cap/級ミックス/**送りがな二重**）は全部残す。
- 走行中の wf_01772338-51b はverify段を含むが、これは**そのまま完了させてよい**（ユーザー了承済）。

## /clear 後の再開手順（この時点＝regen生成済・verify生成中）
- regen本文は保存済＝`scratchpad/pg/gen/out_n4_r01..r03.json`（15本）。verify結果＝`verdict_n4_r01..r03.json`（出れば）。
- 再開＝`python scratchpad/pg/gen/validate_out.py` は out_n4_b*（元40）用。**まず regen をマージ**してから検算する:
  1. out_n4_r0N の各setで、out_n4_b* 内の同id を置換（15本差し替え）。
  2. `validate_out.py` を全40本に対して実行し 送りがな二重=0/自級点≥3/cap≤3/字数帯 を確認。ユーザーが一意性を目視。
  3. 残欠陥あれば該当のみ regen_specs.py の FLAGGED を差し替えて再焼き。

## 【2026-08-21 追記】止まる関所（機械ゲート）実装＋41-50 小刻み生成
- **仕組み実装済**: `scratchpad/pg/gen/validate_out.py` を「印刷だけ」→「止まる関所」に。HARD欠陥1個で exit=HARD件数（非ゼロ）＋`gate_fail.json`{hard,soft}出力。`run_gate()`で再利用可。
  - HARD（自動作り直し・誤検知ゼロ）＝送りがな二重/字数外/blank数・番号/choices/pointId/自級点<3。SOFT（目視）＝答え露出?(漢字含む時のみ・語尾偽陽性除去)/否定呼応副詞の複数混入。
  - 既定引数=out_n4_b* を r* で上書きした確定40本を検査。任意globも可（`python validate_out.py out_n4_c*.json`）。**40本でexit0確認済（触っていない）**。
- **build_specs.py 範囲引数化**: `--start N --count M --prefix X`（既定1-40/prefix b＝不変）。41-50は `--start 41 --count 10 --prefix c` → spec_n4_c01(41-46)/c02(47-50) 生成済。
- **走行中 run = wf_3b2d5a6c-213（task wlwpdzvqz）= 41-50 生成のみ**（2バッチ並列・自己反証プロンプト・独立LLM検証なし）。出力=out_n4_c01/c02.json。
  - 完了後の手順（本体側で機械ゲート）: `cd scratchpad/pg/gen && python validate_out.py out_n4_c01.json out_n4_c02.json`。HARD>0なら該当setだけ regen→再ゲート。SOFTは一覧提示しユーザー目視。
- **設計方針（ユーザー質問への回答）**: 自己チェックは自分のミスに弱い→**機械で取れる欠陥は機械（Python関所）に回し自己チェックに頼らない**。意味的一意性のみ自己反証＋ユーザー目視。必要ならSOFT該当のみ限定独立チェックを追加可。

## 【2026-08-21 追記2】41-50 ユーザー目視→修正完了・仕組み追加
- **41-50 生成→機械ゲートHARD=0**。ユーザー目視で第2正解4件を指摘→`apply_fixes_41_50.py`で安全置換（旧値存在確認＋正解位置保持＋重複チェック）:
  0043#1 はずだ→ことがある / 0046#3 は→で・ぐらい→だけ / 0047#2 ないことにして→なくても・なくなって→なければ / 0047 空所番号 1,4,2,3,5→1,2,3,4,5振り直し。再ゲートexit=0。
- **絶対パス強制フック実装**: `~/.claude/hooks/emit-write-path.mjs`＋settings.json PostToolUse(Write)。Write直後に絶対パスをadditionalContext注入（稼働確認済）。メモリ=[[always-cite-absolute-save-path]]。
- **目視HTML生成器**: `make_review_html.py`（`--ids a,b,c` 絞り込み＋同id後勝ち＝b*をr*で上書き対応）。
- **0003/0009/0027 ユーザー目視完了→修正済**（`apply_fixes_r.py`）: 0003#3 そうに→そうと / 0027#2 なら→が / 0027#3 かしら→です（0009は指摘なし）。r01/r02保存・再ゲートexit=0。
- **到達点**: 0001-0050 は機械クリーン＋ユーザー目視の一意性崩れ全つぶし済。次=0051-0080を同型生成（build_specs --start 51 --count 10 --prefix d…と10刻み／各バッチ後に機械ゲート→目視HTML→安全スクリプト修正）。

## 【/clear後の最初の一手（2026-08-21）】
1. `ls scratchpad/pg/gen/ruby_out_p*.json` で5ファイル揃ったか確認（ルビエージェント a124668dde9904c5d の出力・各10件）。揃ってなければエージェント継続待ち or SendMessageで再指示。
2. `python scratchpad/pg/gen/validate_ruby.py`（exit0=改変ゼロ・二重ルビ無し・構造不変・字数帯）。NGなら該当だけ直す。
3. OKなら下記「追記3」の3以降＝live差替→passageGrammar.test.ts(200→170,N4→50)→_manifest再生成→番人/tsc→在庫チェーン→**ビルド(ユーザー指示済)**→commit＋handoff。RUN_BALANCEはfalse据置(N3未リビルド)。

## 【2026-08-21 追記3】N4 0001-0050 を live採用→ビルド→在庫更新（ユーザー指示・実行中）
- 決定=新50本をliveへ採用してから在庫更新。その後ビルドして記録。**とりあえずN4は50本で区切り（51-80は作らない）**。
- Live形式=`content/problems/bunpou/passage_grammar_N4.json` {schema,daimon,level,languages,items}。item={id,level,kind,passages:[{body}],questions:[{id"{sid}-q{n}",blankNo,choices,answerIndex,i18n:{},pointId}],i18n:{}}。**ルビは本文・選択肢インライン(漢字（かな）)**。旧items80はskeleton無し。
- 採用手順:
  1. **assemble**: 0001-0050現行(b*をr*で上書き＋c*)→item形式。skeletonの要否=番人bunshouGrammarBalance.test.ts次第(確認中)。
  2. **ルビ付け**: assemble済(`assembled_n4_50.json`)→1エージェント(a124668dde9904c5d・general-purpose)に50本一括、全漢字インラインルビ(既存data様式=全漢字ルビ・アプリ側で級別表示)。**64k回避で出力を5分割**`ruby_out_p1..p5.json`(各10件)へ指示済([[large-write-64k-patch-not-rewrite]])。検算=`validate_ruby.py`(ルビ剥がし＝元一致で改変ゼロ保証・二重ルビ・構造不変・字数帯)。※1体に束ねた理由=本体コンテキストを太らせない(A1)＋細分割しない(B2)。
  3. **live差替**: passage_grammar_N4.json items=50(旧80退避は没問題に済)。総セット200→170。
  4. 番人/テスト更新: passageGrammar.test.ts の S.length(200→170?)・N4件数、bunshouGrammarBalance RUN_BALANCE。
  5. **_manifest再生成**必須([[ota-manifest-regen-or-stale]])。
  6. **在庫チェーン**: stock_report→mock_stock→stock_excel→daimon --xlsx → `memory/在庫・模試ストックまとめ.xlsx`。
  7. **配信**: content変更ゆえ本来OTA([[content-ota-vs-ui-build]])。ユーザーは「ビルド」指示。iOS本日既に3/8(E3上限注意)。
  8. 記録: commit＋handoff更新。

## 次の一手
1. （↑マージ＆検算）クリーン40本を確定。
2. **N4残り40（sets 41-80）→ N3 80** を同型生成（build_specs を level/範囲引数化・batch6・**独立verify無し**）。
3. 全出力 assemble → `content/problems/bunpou/passage_grammar_N4.json`（items形式）→ ルビ付け（`scratchpad/pg/ruby_*`・本文をLLMに渡さない）→ 番人 RUN_BALANCE=true → テスト更新（passageGrammar.test.ts の 200/N3=40 期待）→ `_manifest`再生成。
4. 翻訳(en/ne)は別途・Gemini有料・見積り承認後。作問はOpusのみ＝有料API無し。
