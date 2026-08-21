# 情報検索 需要多源化リビルド（/clear耐性・inflight）

2026-08-21 開始。ユーザー指示＝情報検索の「走査性」を供給側(情報源数)と需要側(答えに必要な源数)に分け、需要を上げる。

## 目標（確定・机上検証済み）
- 供給側: N4の1源3件→2源、N3の1源8件→3源（全て差し替え対象に内包）
- 需要側: N4 ≥2源必要=66%(40/60)／N3 ≥2源=100%(60)・≥3源=50%(30)／N5据置
- タグ方式: 全180問 `skeleton.answer_sources`(1/2/3)。既存=構造proxyでtag、新規=設計で宣言。
- 字数は目標N4 400/N3 600据置（帯 340-460／510-690・ルビ除去）。狙いをやや上(N4~410/N3~630)で初回帯内。
- 解説=シンプル＋各誤答が「なぜ違うか」一言（ユーザー指示2026-08-21）。

## 仕分け（Phase A・確定）＝ `scratchpad/joho_fix/plan.json`
- N4: 残す34（tier≥2の14をtag2/3＋tier1多ブロック20をtag1）／差替26（新規全て源2）。最終 表+注記33(55%上限)・2表以上20・カード7。正誤10。
- N3: 残す29（tag2/3）／差替31（源3×19＋源2×12）。最終 2表以上23・カード18・表+注記19。≥2=60・≥3=30。正誤10。
- 差替は元の scene/q_type/medium を継承（バランス不変）。1ブロックは全て多ブロック化。
- planツール＝`scratchpad/joho_fix/planA.py`（tier=blk/cond/sources_ok・joho_solvability再利用）。

## 作問（進行中）
- N4の3問(0054/0055/0056)＝作成済・帯内(363/357/385)・`scratchpad/joho_fix/dryrun_n4.py`。
- 残り54問をサブエージェント4体で下書き：spec_{N4a,N4b,N3a,N3b}.json→out_同名.json。source数=answer_sources通り・一意・字数帯・per誤答why-wrong解説。
- **本体で必須検証**: 全item 一意性を目視レビュー＋機械ゲート(字数/源数/4択/scene・pattern一致)。落ちは再生成。

## 適用フロー（作問完了後）
1. 旧問を `没問題/情報検索_多源化_2026-08-21/` へ退避（可逆）。新問をID差し替え。既存残す29+34にanswer_sources tag付与。
2. 番人新設 `src/data/johoAnswerSources.test.ts`（分布ゲート: N4≥2源≥40・N3≥2源=60/≥3源≥30・全item answer_sources付与・N5据置）＋build.ps1登録。
3. 既存ゲート緑維持: johoSkeletonBalance(偏り55%/正誤5/媒体)・johoSolvability・字数帯。
4. _manifest再生成→TS/番人テスト→読解Excel(dokkai_joho_excel.py)・品質パラメータExcel(stock_analysis_color.py)再生成。
5. 翻訳(en/ne)は後日・Gemini有料・見積り承認後。作問自体は有料API無し(Opus)。

## ✅ 適用完了（2026-08-21）＝未コミット・未ビルド
- **本体適用済**: N4差替26・N3差替31を `apply.py --write` で本体へ書込。旧問は `没問題/情報検索_多源化_2026-08-21/joho_{N4,N3}_旧.json` へ退避（可逆）。keep問に answer_sources 付与。
- **N5もタグ付与**（番人が3ファイル全itemを検査するため）＝planA.py の tier() 構造proxyで {1:41,2:18,3:1}。N5は据置(差替なし)。
- **修正2件**: ①N3-0059 選択肢を「第１回〜第４回」→「Ａの回〜Ｄの回」に差別化（既存0042と選択肢セット重複していた・カード見出し/解説も整合・字数不変）。②N3-0012（選ぶ）選択肢を「○○プラン」→表の行名「昼のみ/ナイト/フル/ジムのみ」に一致化（走査性C＝図版由来≥3を満たす・正解ナイト=index1不変）。
- **分布**: N4 ≥2源=40/60・N3 ≥2源=60/60・≥3源=30/60。選択肢セット重複=全レベル0。
- **番人**: `johoAnswerSources.test.ts` を build.ps1 に登録。joho番人11/11緑・build用テスト48/48緑・tsc0・_manifest再生成(52)・読解Excel/品質Excel再生成済。
- **残＝コミット/ビルドは指示待ち**。翻訳(en/ne・新旧joho本文/設問/選択肢/解説)は後日・Gemini有料・見積り承認後。作問は有料API不使用(Opus)。
- ※注記: stock_analysis の「本文混入」列 N5 16%/N3 8%（N4 0%）は既存metric（N5は未改変で16%＝設計上の指標でありエラーではない）。

## 【済】次の一手（旧・2026-08-21）
- **N4=完成・検証済**: out_N4a(12)+out_N4b(11)+out_N4c(3)=26問。全26 spec一致・字数帯内・4択重複0・cross26選択肢セット重複0・answerIndex分散({0:9,1:7,2:9,3:1})・源数タグ2。フィールド構造も本体と一致(skeletonにanswer_sources付き)。
- **N3=下書きエージェント2体まだ稼働中**（a357.../a9c2...=14分前起動・out_N3a 16問/out_N3b 15問を仕上げ中）。※注意=早すぎた伸長エージェント3体を出してしまい即停止(書込前で無害)。**教訓=元ドラフトが書込途中だと validate が短く見える→ドラフト完了通知を待ってから検証する**。
- **適用ツール準備済**＝`scratchpad/joho_fix/apply.py`（既定ドライラン・`--write`で本体書込＋旧問を`没問題/情報検索_多源化_2026-08-21/`へ退避＋keep問にanswer_sources付与＋分布ゲート）。番人＝`src/data/johoAnswerSources.test.ts`(未登録→build.ps1へ要追加)。
- **残手順**: N3完了→`python scratchpad/joho_fix/validate.py`緑→apply.py --write→build.ps1へ番人登録→_manifest再生成→tsc+テスト→読解Excel/品質Excel再生成→コミット。翻訳(en/ne)は後日・有料・承認後。
