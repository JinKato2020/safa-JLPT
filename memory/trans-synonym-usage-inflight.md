# 言い換え・用法・穴埋め 対訳(en/ne) 生成 — inflight

## 穴埋め(grammar_form)追加(ユーザー承認 2026-09-02)
- 訳す=stemの空所〔　〕をanswerで埋めた「完成文」のみ(選択肢=文法パーツは訳さない)。表示=既存「意味」カード(promptTrans)流用=新UI不要。
- run ID **b6j0mdrcw** / log=scratchpad/pg/apply_grammar_form.log / cache=scratchpad/pg/trans_grammar_form_cache.json / 概算¥53(1647文/55バッチ)
- コード結線済(tsc緑): rehydrate共通BANK mapperに promptEn/Ne(i18n.en/ne.prompt) / daimon.ts gfX(promptTransへ)。書込=単一fieldの既存context経路(field='prompt')。⑥シート行47(文法穴埋め)は「訳なし」→「完成文の意味」へ更新予定。


## 目的
言い換え(synonym)・用法(usage) の回答後復習用に en/ne 対訳を content i18n へ投入。
- synonym: 本文(sentence)＋答え(answer)＋誤答すべて(choices) を訳す ※誤答も正当な日本語ゆえ訳す価値あり(ユーザー確認)
- usage: 正解の文(answer)だけ訳す ※誤答3つはわざと不自然な日本語ゆえ訳さない(ユーザー確定 2026-09-02)

## 走行中 run(バックグラウンド・Gemini2.5Flash)
- synonym --apply = run ID **byidpsnuz** / log=scratchpad/pg/apply_synonym.log / cache=scratchpad/pg/trans_synonym_cache.json / 概算¥410(12740ユニット/425バッチ)
- usage --apply = run ID **b30vfixn5** / log=scratchpad/pg/apply_usage.log / cache=scratchpad/pg/trans_usage_cache.json / 概算¥41(1271ユニット/43バッチ)
- 合計概算 ≈¥451(¥1000未満=D1事前承認不要／D2実費報告する)

## ツール
tools/trans_daimon.py に synonym/usage(kind='struct')追加。cacheキー= `{itemId}\x01{fieldKey}`(sentence/answer/c0..cN)。
--write は _shape() で c0..cN を i18n.en/ne.choices[] に再構成。languages自動更新。

## UI(i18n)全訳 追加(ユーザー指示 2026-09-02)
- 7言語(bn/id/ko/my/th/vi/zh)の既存315キーは古い→全削除して ja全1405キーから再翻訳(23%→100%)。en/ne は番人維持ゆえ対象外。
- 新ツール **tools/trans_i18n.py**(--dry-run/--apply/--write・langごとcache=scratchpad/pg/trans_i18n_<lang>_cache.json・プレースホルダ{n}保全)。--writeは各 src/i18n/<lang>.json を ja키ー集合で丸ごと作り直し=旧315破棄。
- run ID **b49jw3atk** / log=scratchpad/pg/apply_i18n.log / 概算¥173(9835訳/各lang47バッチ)。
- ★UI完了後: `python tools/trans_i18n.py --write` → ①表(7言語UI=100%)・②表(315→1405/23→100%)を更新。※7言語には parity番人が無い=今後また陳腐化する(memory既知)。

## ✅content側 完了(2026-09-02・未commit/未配信)
- 用法 write済(¥26)・言い換え write済(¥192)・穴埋め write済(¥36)。manifest再生成(113files)・staleness baseline再生成(新規0 stale・既存dokkai en2/ne1のみ)・tsc緑・75テスト緑。
- ⑥シート 行45/46/47 更新済(en/ne=100%緑・他=未着手グレー)。
- 表示結線済(QuizScreen): 用法=正解文の意味 / 言い換え=本文＋各選択肢の意味 / 穴埋め=完成文の意味(既存「意味」カード流用)。

## 進捗(2026-09-02)
- ✅usage: apply完了(done1271/fail0・実測¥26)→ --write済(4ファイル・languages=['en','ne']・explainキー無)。
- 🚧synonym: apply走行中(run byidpsnuz)。完了後 --write。
- ✅コード結線 完了(tsc緑・guard/parity/validate緑):
  - rehydrate: syMap に sentence/answer/choices の en/ne / usage(KNOWLEDGE_BANK共通+USAGE_MOCK)に answerEn/Ne。
  - daimon.ts: BankUnit に answerEn/Ne / questionForUnit usageX(正解文訳)・synonym syX(本文訳＋choiceTrans[]を表示順へJA文字列で整列)。
  - index.ts: SynonymBankItem に sentence/answer/choices の En/Ne。
  - quiz.ts Question: answerTransEn/Ne, synonymSentenceEn/Ne, choiceTransEn/Ne[]。
  - QuizScreen: 用法=回答後に正解文の意味 / 言い換え=本文の意味＋各選択肢の意味(番号=選択肢と同じ・正解に✓)。
  - i18n: quiz.answer_meaning / quiz.choice_meanings を ja/en/ne 追加。

## 次の一手(synonym apply完了後)
1. `python tools/trans_daimon.py synonym --write`
2. manifest再生成 → tsc → npm test(explainTransPolicy/parity/validate/rehydrate/manifest/transStaleness/orderMock)
3. trans_staleness.py で種再生成(synonym/usage en/ne 新規をbaselineへ)
4. ⑥翻訳状況シート 行45(言い換え=本文＋選択肢の対訳)/行46(用法=正解文のみ)を更新・en/ne=100%へ
5. D2実費報告(usage¥26＋synonym実測)。push/build/OTA配信は別途明示指示待ち

## 注意
- synonym/usage は explainTransPolicy.test.ts の NO_EXPLAIN 対象=**explainキーは付けない**(sentence/answer/choicesのみ)。NO_TRANSではないので en/ne 翻訳は可。
