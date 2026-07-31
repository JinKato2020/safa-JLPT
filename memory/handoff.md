# handoff（/clear 耐性・上書き式・常に最新のみ）

## 次の一手（LIVE＝いま動いている / 次にやる）
- **🔍 文脈規定 未検査の検査＝N4を実行中（2026-07-31）**: 方針＝**作り直さず既存189問をそのまま点検**（第2の正解/正解破綻/誤字）。合格のみverified付与・不合格は書き換えず人手送り。道具＝`tools/build_context_verify_wf.py`(WF生成)→`tools/bake_context_verify.py`(journal回収→焼き込み)。**実行中WF=run`wf_8374f321-5cd`(Task wohh3z1tz)・5体Opus-high・1パス最小**・transcript=`...\subagents\workflows\wf_8374f321-5cd`。完了後: `python tools/bake_context_verify.py --level N4 --transcript <dir>`(まずドライラン)→`--write`。救済=journal.jsonl+resume。⚠検査ツールのapp/参照は`ce781dc`でroot修正済。旧： 未検査(verified未付与)は文脈規定だけ＝計1507問(N3 1318・N4 189、全て誤答3の4択・N5は検証済)。まずN4 189問を検査。検査フロー/verifiedの付け方を調査中(Exploreエージェント)→段取り＋円見積りを出してから実行(無断で有料API回さない)。直近ビルド=2625/both run`30602928459`。未pushコミット無し(6c655fc/7609d5d等push済)。今セッションのUI/economy修正＝ショップ文字切れ・上部アイコン等間隔・辞書二言語併記解消・成長リング色付き・試験カード移設(未ログインも)・結果ボタン誤記・貝明示(正解2貝/毎日30貝)・リング中央を予想得点/180。
- **🔄 大転換=物語システム撤去＋新オンボ実装＝完了・ビルド済（2026-07-30〜31）**: 方針＝「軸となるストーリーを作らない。桜と柴犬は癒し/ねぎらい専用(数字を言わない)。成長/数値はAIコーチ(別空間)に集約。癒しと分析を綺麗に分離」。**①撤去(commit`6b1a71c`)**=願い(wish)一式・復元クエスト(library/LibraryPanel)・合否申告→色紙(resultReport/ResultReportCard/ShikishiWall)・受験日の桜一言(examLine)・幽霊(SessionSummary/PassRing)。中立化=voice.ts(daily/session_end等のみ)/SakuraSpeech(出迎えのみ)。残=AfterStudyReward＋季節画像(=約10回に1度のご褒美)・decay/greeting・桜/柴犬資産・AICoachScreen。**②新オンボ(commit`1ffe146`)**=初回だけ`assets/onboarding/opening.jpg`に台詞レイヤー上部表示「はじめまして。桜です。/一緒に日本語の勉強、頑張りましょう」→AIコーチ設定(既存light/darkテーマ・目標N5/N4/N3・受験日JLPT2択+未定・毎日リマインド任意)→ホーム。日付=`src/data/jlptDates.ts`共有(Profileも移行)。**タブ構成は現状維持**。**③UI磨き(commit`eee65bd`)**=ショップを共通テーマ(useColors/light-dark)に統一＋ボタン角丸ピル化／桜の吹き出しを「約8時間に1度・ホーム開時1回・タップ/11秒で消える」時間ゲート化(世界のかけら=物語は除外・純癒し)・最終表示時刻はsettings.lastSakuraSpeechAt／開発用「合格率を固定」(設定→開発用・±5＋0/20/40/60/80/100＋自動＝settings.devPassPct→homeStatus.passPct上書き)。**最新ビルド=2619/both dispatch=run`30586107249`(iOS→TestFlight/Android→Play alpha App C)・監視しない**(前=2618/run`30554777369`)。tsc0/test330緑。**次=①ホームを癒し専用に整える(桜と柴犬の今日の一枚＋一言・数字ゼロ)②AIコーチ画面を分析ホーム化(到達度%/語彙+X%/継続/効率)③ご褒美頻度を毎回→約1/10に**。概念デモHTML=scratchpad/newopening.build.html・オープニング実装確認=opening2.build.html。

- **🐛 実機テスト3バグ修正＝iOS 2611で配信中（2026-07-29）**: commit932cc7c・tsc0/test366緑・run`30424126041`(platforms=ios)。①母語訳の英語落ち＝カタカナ外来語16語のne欠落→`content/lexicon/meaning_*.json`にne追加(manifest/bundle再生成済)。※UI言語(uiLang)と意味の母語(l1)は別設定＝仕様（日本語UIでも意味はl1=neのまま）。②ルビ下の漢字上端切れ＝`RubyText.tsx`のbase lineHeightを1.18倍(col gap0で相殺)。③書き取り自己交差の線切れ＝`engineHtml.ts`の`#t svg path`をround結合/nonzero(iOS WKWebView対策・**要実機確認**)。**次=iOS実機で3件確認**。**Android未解決**＝ads SDK(AdMob)のKotlin2.3.0がKSP2と不整合([[android-admob-kotlin-2_3-mismatch]])→次善=AdMob版downgrード or 広告後回し。
- **📖 旧・世界観ストーリー(願い/復元)＝2026-07-30に全撤去済み(上の🔄参照)＝無効**。`docs/superpowers/specs/書斎ストーリー-design.md`等の願い中心設計は不採用。癒し資産(AfterStudyReward・四季画像`assets/afterstudy/*`・桜/柴犬)のみ新方針で存続。合格ムービー(ユーザー作成のAI動画→`expo-av`で合格報告に全画面配線)の受け入れ口だけは今後も有効。
- **🔊 聴解 音声＝全520本 生成・コミット・push済み（2026-07-29 実データ確認・完了）**: 13大問×各40問=520問すべてに実音声mp3が実在（`assets/audio`・中央値約0.5MB・空/壊れ0）。新260問(021-040)は 07-27〜28 に生成→commit`48d346f`「聴解新音声260本」で本番反映→`main==origin/main`・`_manifest.json`再生成済み=OTA配信可。**⚠旧記述「260未生成・要D1見積」はこの生成より前の古い記録＝無効**（`choukai_gen_done.txt`は180IDだが記録漏れで、mp3実体は260本そろう）。作り直したい時だけ手順=`md/聴解_音声作成フロー.md`＋`tools/choukai`。[[choukai-audio-pipeline]]・[[choukai-authoring-flow]]。
- **🌏 翻訳(i18n)＝指示があるまで他言語に触らない（厳命2026-07-30）**: 新規UI文字列は`ja.json`だけに入れる＝他言語は`t()`がjaへ自動フォールバック（既にbn/id/ko/my/th/vi/zhは約370キー=半分未訳でこの方式で運用中・ne/enほぼ完備）。**先回り翻訳・小出し禁止**。翻訳はユーザーが明示した時だけ一括＋円見積り。バックログ=`tools/i18n_backlog.py`（`--lang <l>`で作業リスト・`--stale`で幽霊キー）。保留=passage_grammar 200セット本文訳。[[i18n-translate-all-10-langs-at-once]]。
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

## ⚠ 会話が重くなっている（自動）
- ⚠ 連続 51ターン（文脈 37万）— ループが長い
- ツール呼び出しループが長い（指示1件に対し 51ターン・ツール20回）— まとめ方を変える

## 走行中の run（自動・完了通知が来ていないもの）
- a24a55339e7688334 general-purpose
- a299080a95b15e8d3 general-purpose
- a47ab6769b1b9a288 general-purpose
- ae9c448fbd26954a9 general-purpose
- a83565e1b69fe6554 general-purpose

## 直近24時間の変更ファイル（自動）
- memory/在庫問題数.txt
- content/_manifest.json
- src/data/content/bundled.generated.ts
- 文脈規定_N4_人手が必要な問題.md
- content/problems/moji_goi/context_N4.json
- tools/bake_context_verify.py
- memory/session-summary-LATEST.md
- memory/handoff.md

_自動更新: 2026-07-31 18:24_
<!-- AUTO:END -->
