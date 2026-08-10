# 進行中の未完タスク（2026-08-10・コード未着手）

このターンで仕様確定・一部準備済みだが**コード未実装**。fresh session で実装推奨。

## A. 書斎の段階解禁「演出」＝全体カバー率ベースへ改修 ✅完了(commit 376bfd40)
現状の解禁は**分野別**カバー率だが、ユーザー指示で**全体カバー率**(3辞書 漢字/語彙/文法の 合計learned/合計total = AICoachの covLearned/covTotalAll と同じ)に統一する。

- しきい値4段（全体カバー率）: **5%→聞き取り / 10%→漢字書き取り / 15%→語彙パズル / 20%→文法パズル**。
  - 「聞き取り」は漢字・語彙の聞き取りを1つに統合（旧 listen_kanji/listen_vocab → 1段 `listening`）。
- 各段で**専用画像＋桜の上(中央)に「◯◯ 解禁」**を表示。画像は取り込み済(commit 501dbdbf):
  `assets/afterstudy/unlock_{listening,kakitori,vproduce,gbuild}.jpg`（760×1350・縦長立ち絵）。
- **判定は演出もボタンゲートも全体基準に統一**（演出だけ全体・ボタンだけ分野、の不整合を避ける）。
- 実装ポイント:
  - `src/store/unlocks.ts`: `overallCoveragePct(state,now)` 追加。UNLOCKS を4段(key: listening/kakitori_kanji/vproduce/gbuild, need 5/10/15/20)へ。unlockedKeys/firstUnseenUnlock/currentlyUnlocked を overall 判定に。UNLOCK_NEED は据置(5/10/15/20)。
  - `src/components/UnlockCelebration.tsx`: props に unlockKey 追加。key→画像 map(require)。**縦長画像＋中央オーバーレイ Text「{modeLabel} {解禁}」**（`unlock.kicker`="解禁"流用）。
  - `src/screens/WordsHubScreen.tsx`: celebration に unlockKey 渡す（celebrate.key 既存）。
  - `src/components/KubunCard.tsx`: gated の ok 判定を **overallCoveragePct** に変更（バッジ/バーの表示は分野別pctのまま）。
  - i18n: `unlock.listening`="聞き取り" 追加（en"Listening"/ne"सुनाइ"）。`unlock.kakitori_kanji`を"漢字書き取り"に（旧"漢字の書き取り"）。needpct を「全体{pct}%で解禁」に変更検討。en/ne 同期。
  - 既存ユーザー移行: unlocksSeen に旧キー(listen_kanji等)が残るので、全体≥5%の既存者は`listening`が一度演出され得る(許容)。
- 検証: tsc＋テスト＋ i18n backlog/drift 0＋placeholder 0。

## B. 模試の「休憩→制限時間つき開始」フロー ✅完了(commit 6482395f)
既存に i18n `mock.break_*`（break_next/break_meta/break_back/break_warn/break_start_named）と end_sakura あり。まず `src/screens/MockScreen.tsx` のセクション進行・休憩挿入箇所を要調査。

- 休憩を挟む位置: **1回目=休憩なしで開始**／**2回目(N3・N4・N5)**と**3回目(N3のみ)**は任意時間の休憩を挟む。
  （＝N3は2箇所、N4/N5は1箇所に休憩。※アプリの模試セクション構成を MockScreen で要確認）
- 前セクション終了後、休憩画面で**桜が順に**:
  1. ねぎらいの言葉
  2. 休憩を促す
  3. 準備が整ったら試験を開始するよう促す
  4. 最後に **現在の分野・問題数・制限時間・警告文・スタートボタン** を表示（開始で制限時間つき模試スタート）。
- 「模試休憩の画像」から開始する導線。桜の台詞は story/voice 系 or mock.* i18n を確認して整える。
