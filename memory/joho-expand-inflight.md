# 情報検索 joho 増作＋解説簡潔化 inflight（2026-08-21 起動）

## 目的（ユーザー承認済み 2026-08-21）
- **N4・N3 を各60問へ**（既存10問含む・新方式＝表8-12行/決め手は※注記/表の最素直な一致が罠）。**各+50問**（0011-0060）。
- **解説を簡潔・明快に**（新スタイル・下記）。**既存N3/N4の10問×2も同スタイルに修正**。
- N5=60据置。作問はサブエージェント（追加課金なし）→私が全数検証。

## 新・解説スタイル（joho・簡潔）＝正本
- 2文以内・目安**60〜110字**。
- 第1文＝**決め手（特に※注記の条件）を示して正解を確定**（金額なら計算式を１本）。
- 第2文＝**表の最素直な一致がなぜ罠か**を1つだけ（※で失格）。
- 誤答3つを逐一説明しない。単位・数字は必要分のみ。
- 例(N3-0001新)：「部屋代は３時間で１５００円。市外の人は※で５割増し＝２２５０円、暖房２００＋プロジェクター５００で**２９５０円**。表の数字だけだと２２００円の罠。」

## 手順（順序）
1. ✅ 現状確認：N5=60 / N4=10 / N3=10（0001-0010）。解説は旧＝140-214字で冗長。
2. ▶ 既存20問の解説を新スタイルへ（fix-agent→patch `scratchpad/joho_fix/explain_patch.json` {id:explain}）→私が検証→apply→サンプル提示。
3. スタイルOK後：N4/N3 各+50をgen（サブエージェント・中間形式）→`joho_merge_validate.py`→apply。
4. rebuild.ts→`johoSkeletonBalance.test.ts` **RUN_BALANCE=true化**（60問で絶対数条件を満たす）→構造/一意チェック→在庫Excel＋読解Excel再生成。
5. コミット・ビルドは`-Approved`明示指示待ち＝[[never-build-without-explicit-order]]。

## 中間形式（gen出力）
{title,body,figure{kind,header,intro,blocks[],notes[],footer},q,choices[4],answer,explain,skeleton{q_type,notice,scene,figure_pattern,medium}}
- on-disk：explainは `questions[0].i18n.ja.explain`。id採番 N4/N3=0011-0060。

## 設計正本
- md/09_読解.md「★情報検索 難度・公式忠実化」／骨組み5軸＝`tools/joho_skeleton_tag.py`／番人＝`src/data/johoSkeletonBalance.test.ts`。
- RUN_BALANCE=true条件：正誤≥5・N3広告/パンフレット各≥3・N4案内/お知らせ各≥3・偏り<55%・型数充足。

## 進捗（2026-08-21）
- ✅ 既存20問(N3/N4)の解説を新スタイルへ適用済（70-84字）。旧gen中間ファイル掃除・START N3=11修正済。
- ✅ +50スロット計画 `scratchpad/joho_hard/slots_{N4,N3}.json`（合算60でRUN_BALANCE全条件PASS）。
- ✅ gen起動＝4体（N4_a/N4_b/N3_a/N3_b・各25）→`scratchpad/joho_gen/{lv}_{a,b}.json`。共通ブリーフ=`scratchpad/joho_hard/GEN_BRIEF.md`。
- ✅ **新パラメータ＋番人 実装**（ユーザー指示「場面多様性・全体を見渡す必要をパラメータ化＋ゲート」）：
  - tool＝`tools/joho_solvability.py`（--check）。番人＝`src/data/johoSolvability.test.ts`（build.ps1 $testsに登録。`johoSkeletonBalance.test.ts`も未登録だったので併せて登録）。
  - **多様性**＝scene種類≥6 かつ 最頻≤35%（全レベル常時）。**走査S**＝情報源≥2（表+注記/2表以上/カード≥3/プローズ行≥4／表のみは行≥8&列≥4）N4/N3ハード・N5対象外。**走査C**＝選ぶは4択中≥3が図版に実在（N4/N3ハード）。**走査K**＝条件数≥2(WARN・粗い)。
  - 現状content全緑（N4/N3既存10・N5は対象外扱いでハード0）。
- ✅ バージョン方針メモリ化＝[[version-numbering-scheme]]（マイナー=末尾+1・メジャー=中央+1で末尾1）。

## ★字数・難易度 方針変更（ユーザー指示2026-08-21・厳守）
- **字数＝公式目標±15%（ルビ除く）**：**N4 400→帯[340-460]／N3 600→帯[510-690]**。従来の[0.8-1.5]から厳格化。N5は据置[200-375]。
- **難易度＝本番と同じ条件数**（N4=2〜3個・N3=3個）。**過剰に難化させない**（条件追加/段の重ね/表10行超で難しくしない）。字数は「自然で完成した掲示物」で合わせる＝中立の一般案内文・自然な地の文で埋める（水増し禁止・難化禁止）。
- 反映済＝`joho_len_check.py`・`joho_merge_validate.py`・`johoSkeletonBalance.test.ts`・`stock_analysis_color.py` の帯を全て±15%へ／`ENRICH_BRIEF.md` を「本番相当難易度＋自然完成＋±15%」へ改訂。
- **既存の帯適合**＝N3の10問は全部帯内✅／**N4の10問は3問(0002/0004/0007)が下限わずかに割れ**→適用後にまとめて微修正。
- gen4体は旧「難化」ブリーフだった→**旧N4伸長2体は停止**、全4バッチ(N4_a/b・N3_a/b)を新ブリーフで再調整中（agent＝各バッチ1体）。

## ✅ 完了(2026-08-21・未コミット/未ビルド)
- **N4/N3 各60問**(0001-0060)適用済＝新方式・本番相当難易度・字数±15%(N4[340-460]/N3[510-690])・全item帯内。merge_validate不良0・rebuild済。
- **番人 全緑(RUN_BALANCE=true化)**＝johoSkeletonBalance 5/5＋johoSolvability 3/3(走査S/C・多様性)。build.ps1に両番人登録済。joho_solvabilityハード違反0・tsc0・content整合テスト緑。
- **解説簡潔化**＝既存20＋新100とも新スタイル(2文60-110字・※の決め手＋罠1つ)。
- **混入バグ修正**＝N3_a伸長時の本文取り違え3件(0020キャンプ/0032体育館/0033夏祭り＝本文/intro/notice)を全図表に合う正しい内容へ差し替え・一意性確認済。検出＝本文重複スキャン＋題名vs本文全数照合。
- **Excel**＝「読解 品質パラメータ」に走査S/走査C・多様性の列(J/K/L)追加＋着色(stock_analysis_color.py)・字数帯±15%表示。在庫チェーン再生成済(在庫16000・読解問題_N*も60問)。
- **バージョン方針**＝[[version-numbering-scheme]]記録。

## ✅ コミット＆ビルド済(2026-08-21)
- コミット`c683060c`(17ファイル)＋**Build v1.1.1(2828) iOS/Android both dispatch**(run`32443522123`・NoWatch)。テスト45/45緑・tsc0・push でOTA/Pages起動。版番号=1.1.0→1.1.1(新方式マイナー相当・app.json更新済)。iOS本日2/8。

## ✅ 追加実装(2026-08-21・build 2828後・未コミット)
- **バージョン自動更新を仕組み化**＝`tools/build.ps1` Step1.5。既定=マイナー(末尾+1)／`-Major`でメジャー(中央+1・末尾1)。DryRunは更新なし。ロジック検証済(1.1.1→minor 1.1.2 / major 1.2.1)。記憶頼みを廃止＝[[version-numbering-scheme]]更新済。**未コミット**（次ビルドで自動コミット＋その回から自動バンプ発火）。
- 走査性/多様性の番人はビルド自動実行を確認済(build.ps1 $tests 111-112行・今回45テストで走行)＋md/09_読解.md記録済。

## 残務（次の一手＝ユーザー判断）
- **①Build 2828 のCI結果確認**（未確認・GitHub Actions run 32443522123・成否は未取得）。
- **②情報検索の en/ne 翻訳**（joho 本文body/設問q/選択肢choices/解説explain。新方式でN3/N4は総入れ替えのため実質ほぼ全訳＋N5 60問。Gemini・有料＝¥見積り提示→承認要）。図版figure(表/注記/カード)の訳の持ち方はInfoSearchFigure.tsx/PassageSetPlayer.tsxを見て方式決定。配信はOTA(再ビルド不要)。

## 旧・残タスク(消化済)
1. gen4体完了→`python tools/joho_merge_validate.py`（不良0確認）→`--apply`。不良は該当バッチへSendMessageで修正指示。
2. `node --import tsx tools/content/rebuild.ts`→番人：`joho_solvability.py --check`＋`johoSolvability/johoSkeletonBalance` テスト。
3. `johoSkeletonBalance.test.ts` の **RUN_BALANCE=true** 化（60問で絶対数条件クリア）→緑確認。
4. 構造/一意チェック（各60・id連番・4択一意・選択肢セット/タイトル重複0・字数帯内）→サンプル提示。
5. **Excel更新**（ユーザー指示・確定・`在庫・模試ストックまとめ.xlsx`「読解 品質パラメータ」）：**走査性S/C・多様性を品質表（情報検索行）に列追加＋着色するだけ**（`stock_analysis_color.py`改修）。**掲示物サンプル図の配置はしない**（ユーザー訂正2026-08-21＝問題図を置くのではない）。→問題適用後に在庫/読解Excel一括再生成チェーン。
6. コミット・ビルドは`-Approved`明示指示待ち＝[[never-build-without-explicit-order]]。次ビルドの版番号は[[version-numbering-scheme]]。

## run
（起動したrun idは run-ledger.jsonl。gen4体＝N4_a/N4_b/N3_a/N3_b）
