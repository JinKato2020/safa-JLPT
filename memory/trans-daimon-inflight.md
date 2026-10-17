# 各大問「本文対訳(en/ne)」付与プロジェクト — inflight

## 目的（ユーザー確定 2026-09-02）
④各大問の翻訳を作り直す。文法・文章の文法／読解・内容理解(短中長)は既に100%なので**触らない**。
他の大問は「中途半端な訳を一度リセットして、本文＋（文の選択肢のみ）を en/ne で全部付ける」。
- **訳す範囲** = 本文（問題文）＋「選択肢が文になっている大問（言い換え・用法）」の選択肢のみ。単語・かな・漢字だけの選択肢は訳さない。
- **解説** = 訳さない。日本語に解説が付いていたら**解説フィールド(explain/reason 系)は全削除**（後で再検討）。
- **表示位置** = 回答後に本文の下（orderMeaning と同方式）。
- **進行順** = ①文字語彙 → ②文法 → ③聴解。文字語彙は**まず文脈規定から**順番に。

## 一次情報で確定した設計
- 問題データ = `content/problems/moji_goi/<daimon>_<level>.json`（items[].i18n に翻訳）。通常＋mockあり。
- 現状 i18n に入るのは `explain`（解説）だけ。**本文対訳の表示機構は文字語彙に未実装**（読解だけ `i18n.ne.body` を表示）。→ 表示コードを新設する必要あり。
- 結線: rehydrate.ts が i18n→旧フィールド復元 → daimon.ts が question オブジェクト生成 → QuizScreen が描画。
  - CONTEXT: [rehydrate.ts:23]、[daimon.ts:289] `prompt: cx.prompt … explain: cx.explain, explainNe: cx.explainNe`
  - 表示テンプレ: [QuizScreen.tsx:319-320] orderMeaningEn/Ne（回答後に本文下へ母語訳）

## スキーマ（新）
文脈規定 item.i18n = `{ en:{ prompt:"<英>" }, ne:{ prompt:"<ネ>" } }`（explain は削除）。
- prompt訳 = **空所を答えで埋めた完成文**の訳（回答後表示なので完成文が有用）。

## 実装ステップ（文脈規定）
1. [x] コード完了(tsc緑・関連36テスト緑): quiz.ts Question型(promptTransEn/Ne) / daimon.ts BankUnit＋cloze:289 / rehydrate cxMap(i18n.en/ne.prompt) / index.ts ContextBankItem型 / QuizScreen 回答後に本文下へ表示 / i18n quiz.sentence_meaning(ja意味/en Meaning/ne अर्थ)。※explainは削除せず残置(データ削除時に一緒に外す)
2. [ ] 翻訳バッチ（有料·Gemini2.5Flash）: 完成文 約3,774問×en/ne → i18n.en/ne.prompt
3. [ ] 解説削除: context_*.json の explain 全除去
4. [ ] 後始末: ④Excel行更新 / OTA `_manifest.json` 再生成コミット / 番人(transStaleness等)確認

## 費用見積り（文脈規定・本文のみ・en+ne）
対象 約3,774問／本文 約96,000字。Gemini2.5Flash 概算 **¥200〜400**。①文字語彙全体で約¥1,000〜2,000見込み。

## 実行環境
- `GEMINI_API_KEY` は環境変数に設定済。translation=Gemini 2.5 Flash(thinkingBudget0・memory準拠)。
- 既存の専用対訳スクリプトは無し(読解対訳はWorkflow履歴)。→ `tools/trans_daimon.py` を新規作成予定。

## 文脈規定 進捗(2026-09-02)
- [x] コード(②層)完了・tsc/テスト緑
- [x] 翻訳バッチ完了: 3774/3774・失敗0(分割再試行で回収)・累計実費≈¥87(Gemini2.5Flash)。cache=scratchpad/pg/trans_context_cache.json
- [x] --write 完了: context_*.json 6ファイルに i18n.en/ne.prompt 投入・explain削除・languages=['en','ne']
- [x] テスト緑(transStaleness/passageTransNe/rehydrate/contextGate/validate/manifest 計32)
- [x] OTAマニフェスト再生成: content/_manifest.json (rebuild.ts・113ファイル)
- [x] ④Excel 構造変更保存済: 模試列をB/C間に新設・「└漢字読み(模試プール)」サブ行削除・全大問に通常/模試件数。
      ※件数リフレッシュ: 表記 3088→3350、穴埋め 1020→1207(現content実数)。他は据置。
- [x] ④Excel 文脈規定 en/ne=100% 保存済(2026-09-02)。→ **文脈規定は完全完了**。

## ★次の大問の進め方（/clear後はこの節から再開）
順序: ①文字語彙(残: 言い換え/用法) → ②文法 → ③聴解。
- **【確定 2026-09-02】漢字読み・表記は訳不要＝完了扱い。** 下線語を読む/漢字で書く「解読問題」で本文の意味は問わない(意味は辞書・意味ドリルで担保)。**本文訳もしない**。表記に有った解説(en/ne 旧ne77%)は全削除済。コード連動修正済(schema.ts translate:[]/rehydrate ogMap/daimon.ts:273)・manifest再生成・テスト23緑。⑥翻訳状況シートも「訳なし」へ更新済。→ 翻訳対象から外す。
- **訳す範囲**: 本文＋(文の選択肢のみ)。単語/かな/漢字だけの選択肢は訳さない(確定済)。
  - 言い換え(synonym): 本文=`stem`。選択肢=文→**選択肢も訳す**。
  - 用法(usage): 本文=`stem`/`situation`系＋設問、選択肢=例文→**選択肢も訳す**。※用法は現状「解説の翻訳」扱い。要確認: 用法の本文構造。
- **手順(各大問)**:
  1. `tools/trans_daimon.py` の `DAIMON` に大問追加(glob＋texts関数。選択肢訳す大問は texts に choices も返す＋gemini_batchを複数フィールド対応に拡張)。
  2. 表示結線: rehydrate.ts の該当マップに promptEn/Ne(＋choicesEn/Ne) 追加 → daimon.ts の該当return に promptTransEn/Ne(＋choices訳) → 型(index.ts/daimon BankUnit/quiz.ts) → QuizScreen表示。※contextで作った表示枠を再利用。選択肢訳の表示は新規。
  3. `--dry-run`→費用提示→`--apply`(分割再試行込)→`--write`。
  4. 解説削除(--writeがi18n上書きで自動)。テスト緑確認。`node --import tsx tools/content/rebuild.ts`でmanifest再生成。④Excel該当行を本文の対訳/100%へ更新。
- **注意**: 大問により本文が `prompt`(context) / `sentence`+underline(表記/漢字読み) / `stem`(言い換え/用法) と違う。texts関数で完成文を正しく組む(下線語や設問の扱いに注意)。
- 実費目安: 文脈規定3774問で¥87。文字語彙全体でも¥1000未満見込み(1000円超えるならD1で承認)。

## 主要ファイル
- 翻訳スクリプト: tools/trans_daimon.py / キャッシュ: scratchpad/pg/trans_<daimon>_cache.json
- 表示コード: src/quiz/quiz.ts(Question型) src/data/daimon.ts src/data/content/rehydrate.ts src/data/index.ts src/screens/QuizScreen.tsx(回答後の本文下表示枠) i18n quiz.sentence_meaning
- ④Excel: memory/在庫・模試ストックまとめ.xlsx 「⑥ 翻訳状況」シート(通常/模試列・A40..)
