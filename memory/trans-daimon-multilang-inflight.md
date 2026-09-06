# 大問対訳 多言語化(残り6言語) — inflight（2026-09-06 着手予定・/clear後にここから）

ユーザー指示（2026-09-06）:「クリアして多言語役へ」＝id を完了した流れで、**残りの母語も大問対訳を作成・配線**する。

## 前提（id で完了済み・踏襲する仕組み）
- id(インドネシア語) は **UI/辞書/大問対訳すべて完了**（ne と同格・実費¥473・未コミット）。正本＝`memory\trans-daimon-id-inflight.md`。
- 触り所の全体像＝メモリ `[[daimon-trans-display-lang-levers]]`（UI_LANGS・pickTr・rehydrate/daimon/quiz/3画面・ピッカーclamp・要ビルド）。
- 新ツール＝`tools\trans_daimon_lang.py`（単一lang・`i18n[lang]` へマージ追記・en/ne/id 温存）。使い方＝`python tools/trans_daimon_lang.py <daimon|ALL> --dry-run|--apply|--write --lang <code>`。

## 残り言語（大問対訳が無い＝英語fallback。UI/辞書は完成済み）
bn(ベンガル) / ko(韓国) / my(ミャンマー) / th(タイ) / vi(ベトナム) / zh(中国) の6言語。
- 各言語の大問対訳＝id と同規模（約45,645ユニット・約322万字）。**1言語 ≈ ¥473**。
- **★D1コスト承認必須**：6言語一括なら **≈¥2,800（>¥1000）→ --apply 前にユーザー承認**。各言語の `--dry-run` で見積り提示→合計提示→承認→実行。**どの言語をやるか(全6か一部か)を最初にユーザーへ確認**。

## 手順（1言語ずつ・id と同じ）
1. `python tools/trans_daimon_lang.py ALL --dry-run --lang <code>` で見積り。全6言語ぶん合計を出しユーザー承認（D1）。
2. 承認後：`ALL --apply --lang <code>`（バックグラウンド・完了通知駆動A4／リトライ乱発しない）→ `ALL --write --lang <code>`。
3. 番人＋tsc：`node --import tsx --test src/data/exam/passageTransNe.test.ts` 他＋`npx tsc --noEmit`。en/ne/id 無傷を確認。
4. Excel⑥④：該当言語列を100%化＋`python tools/update_trans_status.py daimon <code> --yen <実測> --chars <字数>`（字数は `scratchpad/pg/trans_*_<code>_cache.json` の値長合計を自集計）。
5. **D2実費報告**（モデル名＋円）。

## ★★言語汎用化リファクタ＝完了（2026-09-06・tsc0/テスト49緑）
**もう「各言語ごとのコード改修」は不要**。大問対訳は言語キー付きマップに統一済み：
- `rehydrate.ts`：`byLang(i18n, field)` で content の i18n にある**全言語を自動収集**（item: promptTr/sentenceTr/answerTr/choicesTr/explainTr＝lang→訳／マップ: `PASSAGE_TRANS`[id→lang→行]・`Q_TRANS`[qid→lang→{q,choices}]。putPassage/putQ）。
- `data/index.ts`：export `PASSAGE_TRANS`/`Q_TRANS`（旧 _NE/_EN/_ID 廃止）＋型 ContextBankItem/SynonymBankItem を `*Tr?: Record<string,…>` 化。
- `daimon.ts`：BankUnit を `explainTr/promptTr/answerTr` 化・question は `orderMeaningTr/answerTransTr/promptTransTr/synonymSentenceTr/choiceTransTr`。`quiz.ts` も同型。
- 画面（QuizScreen/ListeningScreen/PassageSetPlayer）：`pickTr(l1, map)`（record版）で表示。qtr は `(qid)=>pickTr(l1,Q_TRANS[qid])`。
- `i18n/index.ts`：`pickTr<T>(l1, m: Record<string,T>)`＝`m[l1] ?? m.en`／`meaningLangFor(code)`＝UI_LANGS内なら code(jaはen)・他はen。ピッカー（Profile/Account）は `l1: meaningLangFor(code)`。

**→ 新言語Xを出す手順＝ただ2つ**：(1)`python tools/trans_daimon_lang.py ALL --apply --lang X`→`--write --lang X`（データ）(2)`src/i18n/index.ts` UI_LANGS に `{code:'X', name:'…'}` を1行。以上でUI/辞書/大問対訳すべてXに（辞書/UIは既に全10言語データ有）。表示確認はビルド。

## ★(旧)アプリ配線メモ（リファクタ前・参考。上の完了で不要に）
大問対訳を新言語で**表示**するには id と同じ配線が要る（データだけでは英語fallback＝[[verify-app-reads-the-file-you-edit]]）:
- `src/i18n/index.ts` UI_LANGS に該当言語を追加＋`pickTr` を汎用化（例：`pickTr(l1, map)` の record 版へ作り替える方が拡張しやすい。現状は en/ne/id 固定引数）。
- `rehydrate.ts` に `<lang>` の item欄＋PASSAGE_TRANS_<LANG>/Q_TRANS_<LANG>（id を機械的に踏襲。**この段で汎用マップ化(lang→…)に作り替えると以後の言語追加がゼロ改修**になる。番人 passageTransNe.test.ts と data/index.ts export を追随）。
- `daimon.ts`/`quiz.ts` の question 対訳欄・`BankUnit/ContextBankItem/SynonymBankItem` 型・3画面(QuizScreen/ListeningScreen/PassageSetPlayer)。
- 言語ピッカー clamp（ProfileScreen/AccountScreen）を該当言語許可へ。
- **配線＝UI変更ゆえビルド必要（OTA不可）。ビルド/commit/pushはユーザー明示OK後**（[[never-build-without-explicit-order]]）。

## 設計判断（次セッションで最初に決める）
- (a) **翻訳データだけ先に全6言語ぶん作る**（配線は後日/id同様に汎用化してから一括） か、(b) 1言語ずつ翻訳＋配線まで通す か。**id 完了時にpickTr等が en/ne/id 固定なので、多言語を機械化するなら「汎用マップ化リファクタ」を先にやると総工数が減る**（推奨＝先に汎用化→データは各langで流すだけ）。
- 未コミットが積み上がっている（id 分＋v1.1.35系）。ビルド時にまとめて同梱する想定。
