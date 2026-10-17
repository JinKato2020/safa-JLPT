# N4 問題 整合性監査・本番同等化 実装計画

> **For agentic workers:** 本計画は設計書 `app/docs/superpowers/specs/2026-07-15-n4-question-integrity-audit-design.md` を実装する。
> **Goal:** N4の3大問(用法630・並べ替え135・文章の文法40パッセージ/200空所)の一意性破綻・ダミー近接化・構造的赤旗を全数監査し自動修復、日本語を本番同等品質に確定する。
> **方式:** ①機械監査(Python¥0)→②A/B LLM監査＋修復(in-session ~34体・自己検証)→③修復のみ再検証→④反映＋rebuild。

## Global Constraints(全タスク共通)
- 対象は**N4のみ・3大問のみ**。翻訳・N3/N5・他大問はスコープ外。
- **money ¥0**(in-session生成)。quota節約: read:エージェント禁止・大バッチ・~34体・自己検証内包・独立verifyは修復問のみ。
- 個人名禁止=役割ベース。ルビは `漢字（かな）` 全角括弧。正解位置ランダム。
- ソースJSONは**applyまで無変更**。apply直前に3ファイルを `scratchpad/audit/backup/` へ退避。10%ごと中間保存。
- 実行cwd = プロジェクト根 `JLPTアプリ/`。

---

## Task 1: 機械監査ツール `tools/audit_questions.py`(サブコマンド machine)
- Create: `tools/audit_questions.py`
- 対象: `app/content/problems/moji_goi/usage_N4.json`, `app/content/problems/bunpou/order_N4.json`, `app/content/problems/bunpou/passage_grammar_N4.json`
- C1 位置偏り(answer位置分布) / C2 選択肢重複 / C3 ルビ形式一貫性 / C4 長さtell / C5 個人名 / C6 答え整合
- 出力: `scratchpad/audit/structural_report.json` ＋ 標準出力サマリ
- 完了条件: 3ファイルを読み、各Cの件数と該当IDを出力。エラーなく走る(nullガード・utf-8)。

## Task 2: バッチ分割(サブコマンド batches)
- 用法630→23バッチ(28/体)、並べ替え135→5バッチ(27/体)、文章の文法40パッセージ→6バッチ(7/体)。計~34。
- 出力: `scratchpad/audit/batch_<daimon>_<NN>.json`(各: `{daimon, level, ids:[...], items:[...元データ...]}`)。パッセージは本文＋5空所を1単位で同梱。
- 完了条件: 34バッチファイルが生成、総item数=805単位/965問と一致。

## Task 3: パイロット監査(各大問1バッチ=3体)
- 各大問の先頭バッチを Agent で監査。プロンプト=§5基準＋§6出力契約。agentは自分のbatchファイルを読み、verdictを `scratchpad/audit/verdict_<daimon>_<NN>.json` へWrite。
- 完了条件: 3 verdictファイルが schema 準拠で出力。人手(私)でサンプル妥当性を確認。プロンプト/スキーマ不良があればここで是正(手戻り防止)。

## Task 4: 全体ファンアウト監査＋修復(残り~31体)
- 残バッチを Agent 並列(グループ分け)で監査。各agent: read batch → 判定＋修復＋自己検証 → write verdict。
- 完了条件: 全34 verdictファイル出力。欠落=そのバッチのみ再実行。

## Task 5: 検証層(サブコマンド validate-verdicts)
- 全verdictを読み、`ok=false`の修復を機械再チェック(choices長4・answer∈choices/answerIndex範囲・ルビ形式・重複0・個人名0)。
- 出力: `scratchpad/audit/repairs_clean.json`(機械OK)＋`repairs_reverify.json`(要再検証)。
- 完了条件: 全修復が2群に分類。

## Task 6: 修復のみ独立再検証(少数体・敵対的)
- `repairs_reverify.json`＋機械OK修復も含め、修復されたitemを別agentが「一意性を崩せるか」再判定。崩せたら差し戻し(最大2周)。
- 完了条件: 確定修復 `repairs_final.json`。

## Task 7: 反映＋再ビルド＋報告(サブコマンド apply)
- backup退避 → 確定修復を3JSONへ適用 → `node --import tsx app/tools/content/rebuild.ts` → `app/tools/content/validate.ts` 通過確認。
- 文章の文法で body変更のパッセージ → `scratchpad/audit/retranslate_ne.json`。
- 差分サマリ(大問別 欠陥件数・修復件数・C結果)＋各大問の修復前後サンプルをユーザーへ提示。
- 完了条件: manifest更新・validate緑・報告提示・再訳要リスト出力。

## Self-Review 済
- spec全11節を各タスクが被覆(監査基準§5→T3-4、出力契約§6→T3-5、C→T1、翻訳同期→T7、バックアップ→Global)。
- placeholder無し。件数(630/135/40・805/965)整合。
