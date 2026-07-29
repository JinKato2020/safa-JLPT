# handoff（/clear 耐性・上書き式・常に最新のみ）

## 次の一手（LIVE＝いま動いている / 次にやる）
- **📖 世界観ストーリー P0＝実装完了→ビルド中（2026-07-29）**: v2602/both dispatch=run `30398250437`（push済602コミット）。tsc0・test359緑。正本=`docs/superpowers/specs/2026-07-28-書斎ストーリー-design.md`(v6)＋`docs/superpowers/specs/桜-口調シート.md`。核＝**軸=ユーザーの「願い」を世界の中心**（使命は預かる／没入は狙わない=選択・痕跡・承認／物語は乗数）。成果コード=`src/story/{wish,decay,voice,examLine,resultReport,metrics}.ts`＋UI配線`src/home/{SakuraSpeech,ResultReportCard,ShikishiWall}.tsx`＋学習後まとめ画面`src/components/AfterStudyReward.tsx`（毎問登録廃止→最後に10単語☑まとめ・桜貝＋ねぎらい・四季画像`src/data/afterStudyArt.ts`／`assets/afterstudy/{spring,summer,autumn,winter}.png`）。**次=P1〜（要画像/Rive・要見積りD1）**＝合格リング意匠/入場物語/機能の衣。**ユーザー待ち**=全画面の合格ムービー（AI動画・Veo/Kling等でユーザーが作成）→来たら私が`expo-av`で合格報告に全画面配線。台詞のC2/C3後払い在庫は到達直前に執筆（今は下位棚へ自動フォールバック）。
- **🔊 聴解 新260問の音声（未生成・要D1見積提示）**: 対象=各大問021-040の260問（001-020は既存mp3が実在）。IDリスト=`問題/聴解/audio_todo_021-040.txt`。手順=生成前に`python 問題/tools/tts_script.py`で台本更新→`python 問題/tools/gen_choukai_json.py --ids-file 問題/聴解/audio_todo_021-040.txt`。声=ナレータAoede／対話Orus,Fenrir,Leda,Kore／独話は既定Leda・男役のみOrus／番号・末尾は合格クリップ固定。実費目安¥300-500（Gemini2.5Flash TTS・同期）→**実行前に円で提示（親D1）・後でD2報告**。後工程=assets/audio自動コピー→Pages配信→**OTA `_manifest.json`再生成必須**([[ota-manifest-regen-or-stale]])→ビルド。正本=`md/聴解_音声作成フロー.md`・[[choukai-audio-pipeline]]・[[choukai-authoring-flow]]。
- **🌏 翻訳(i18n)＝全10言語まとめて・保留中**: passage_grammar 200セットのne他が未訳（読解は完備）。落ちはしない（`PassageSetPlayer.tsx`が`l1==='ne'`時だけ訳トグル）。見張り=`src/data/exam/passageTransNe.test.ts`（`KNOWN_PG_UNTRANSLATED=200`・増えたら赤）。やる時は**ネパール単独でなく10言語同時・見積も10言語分**。[[i18n-translate-all-10-langs-at-once]]。
- **💰 課金の続き＝正本は別ファイル** `memory\monetize-inflight.md`（Phase0-1は配信済＝1日3回ゲートON。残るユーザー手作業=AdMob/ストア設定等はそちらを参照）。

## 道具・正本（毎回は読まない・必要時だけ）
- **ビルド1コマンド**=`tools\build.ps1 -Message "..."`（manifest再生成→test+tsc→commit→push→番号算出=2000+commit→dispatch→監視）。`-DryRun`で検証のみ。公開release口は無し=要る時だけ手で`gh workflow run`。実ビルドは`build-jlpt.yml`のみ[[build-jlpt-yml-is-canonical]]。**⚠dispatch前にpush必須**（未pushだとリモート側commit数で番号不一致→ガード落ち。2026-07-28実証）。
- **過去ログ検索**=`python tools\find_history.py "語1" "語2"`（AND・`--since`/`--role`）。**在庫**=`memory\在庫問題数.txt`（`tools\stock_report.py`・Stop hookが問題ファイル変更時だけ更新）。
- **制作素材1.1GBはgit外**（repoはPUBLIC=公式試験素材/APIキー/画像を絶対に入れない[[repo-is-public-never-commit-materials]]）。PC故障で復旧不可＝外部バックアップは要ユーザー判断。`confirm.html`は消さない（メール確認の着地ページ・build-jlpt.ymlがPages配信・消すと新規登録が404）。

## 完了・配信済み（詳細=git log / 各md / MEMORY索引。ここでは畳むだけ）
- **聴解**: 各大問+20＝260問作問（公式中央値80-120%の本文モーラ帯ゲート）／全520件にルビ＋答え隠し一意性監査／音声フローはGemini2.5Flash確定([[choukai-audio-pipeline]])／ルビ・スクリプトボタン・概要再生UI。
- **読解**: 情報検索405問＋4種図表ブロック（route/card/notice/table）／内容理解（短中長）の公式意図一致監査＋弱誤答差替＋指示語10問([[dokkai-quality-audit]])。
- **文字語彙/文法**: 文脈規定 N4 189＋N3 1273採用／文の組み立て238採用（除外365の作り直し）／言い換え類義N3 604＋先発245採用／文章の文法200セット＋pointId＋ルビ100%。救済=[[second-answer-drop-distractor-not-question]]。
- **マネタイズ**: Phase0-1（RevenueCat/AdMob配線・購入画面・1日3回ゲートON [[jlpt-release-order-monetization]]）。
- **UI/基盤**: ホーム桜ペット＋合格リング試験情報／全画面ルビ被り修正／my単語帳タブ内化＋書き取りUI整理／Supabaseアカウント＋ソーシャルログイン／ダーク統一・レベル表示・AIコーチ助言。

## 文脈の床（基準値・2026-07-19 実測）
- `/clear` 直後の床 = **40.1k / 200k（20%）**。増加は約 760→514→400 トークン/往復と逓減（往復21:46,424 / 24:48,708 / 30:51,791 / 33:52,992）。
- 注意: 最小化前の床は記録が無く、削減幅は不明。以後は変更のたびにここを上書きする。

<!-- AUTO:BEGIN -->

## 走行中の run（自動・完了通知が来ていないもの）
- a24a55339e7688334 general-purpose
- a299080a95b15e8d3 general-purpose
- a47ab6769b1b9a288 general-purpose
- ae9c448fbd26954a9 general-purpose
- a83565e1b69fe6554 general-purpose

## 直近24時間の変更ファイル（自動）
- src/screens/MockScreen.tsx
- src/screens/ListeningScreen.tsx
- src/screens/PassageGrammarScreen.tsx
- src/screens/ReadingScreen.tsx
- src/components/PassageSetPlayer.tsx
- src/components/LearnTestSession.tsx
- src/screens/ListeningQuizScreen.tsx
- src/screens/QuizScreen.tsx

_自動更新: 2026-07-29 12:14_
<!-- AUTO:END -->
