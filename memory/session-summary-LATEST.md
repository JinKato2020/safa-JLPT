# 前セッション圧縮情報

## 何をしたか
- ツール呼び出し 2 回・6 ターン
- 往復 8252 回

## 何が変わったか
- memory/handoff.md
- 画像/ストーリー/ストーリー.xlsx
- memory/session-summary-LATEST.md
- App.tsx
- content/_manifest.json

## 次の一手
- **🐛 実機テスト3バグ修正＝iOS 2611で配信中（2026-07-29）**: commit932cc7c・tsc0/test366緑・run`30424126041`(platforms=ios)。①母語訳の英語落ち＝カタカナ外来語16語のne欠落→`content/lexicon/meaning_*.json`にne追加(manifest/bundle再生成済)。※UI言語(uiLang)と意味の母語(l1)は別設定＝仕様（日本語UIでも意味はl1=neのまま）。②ルビ下の漢字上端切れ＝`RubyText.tsx`のbase lineHeightを1.18倍(col gap0で相殺)。③書き取り自己交差の線切れ＝`engineHtml.ts`の`#t svg path`をround結合/nonzero(iOS WKWebView対策・**要実機確認**)。**次=iOS実機で3件確認**。**Android未解決**＝ads SDK(AdMob)のKotlin2.3.0がKSP2と不整合([[android-admob-kotlin-2_3-mismatch]])→次善=AdMob版downgrード or 広告後回し。
- **📖 世界観ストーリー P0＝実装完了・配信済み**: v2602/both dispatch=run `30398250437`（push済602コミット）。tsc0・test359緑。正本=`docs/superpowers/specs/2026-07-28-書斎ストーリー-design.md`(v6)＋`docs/superpowers/specs/桜-口調シート.md`。核＝**軸=ユーザーの「願い」を世界の中心**（使命は預かる／没入は狙わない=選択・痕跡・承認／物語は乗数）。成果コード=`src/story/{wish,decay,voice,examLine,resultReport,metrics}.ts`＋UI配線`src/home/{SakuraSpeech,ResultReportCard,ShikishiWall}.tsx`＋学習後まとめ画面`src/components/AfterStudyReward.tsx`（毎問登録廃止→最後に10単語☑まとめ・桜貝＋ねぎらい・四季画像`src/data/afterStudyArt.ts`／`assets/afterstudy/{spring,summer,autumn,winter}.png`）。**次=P1〜（要画像/Rive・要見積りD1）**＝合格リング意匠/入場物語/機能の衣。**ユーザー待ち**=全画面の合格ムービー（AI動画・Veo/Kling等でユーザーが作成）→来たら私が`expo-av`で合格報告に全画面配線。台詞のC2/C3後払い在庫は到達直前に執筆（今は下位棚へ自動フォールバック）。
- **🔊 聴解 新260問の音声（未生成・要D1見積提示）**: 対象=各大問021-040の260問（001-020は既存mp3が実在）。IDリスト=`問題/聴解/audio_todo_021-040.txt`。手順=生成前に`python 問題/tools/tts_script.py`で台本更新→`python 問題/tools/gen_choukai_json.py --ids-file 問題/聴解/audio_todo_021-040.txt`。声=ナレータAoede／対話Orus,Fenrir,Leda,Kore／独話は既定Leda・男役のみOrus／番号・末尾は合格クリップ固定。実費目安¥300-500（Gemini2.5Flash TTS・同期）→**実行前に円で提示（親D1）・後でD2報告**。後工程=assets/audio自動コピー→Pages配信→**OTA `_manifest.json`再生成必須**([[ota-manifest-regen-or-stale]])→ビルド。正本=`md/聴解_音声作成フロー.md`・[[choukai-audio-pipeline]]・[[choukai-authoring-flow]]。
- **🌏 翻訳(i18n)＝全10言語まとめて・保留中**: passage_grammar 200セットのne他が未訳（読解は完備）。落ちはしない（`PassageSetPlayer.tsx`が`l1==='ne'`時だけ訳トグル）。見張り=`src/data/exam/passageTransNe.test.ts`（`KNOWN_PG_UNTRANSLATED=200`・増えたら赤）。やる時は**ネパール単独でなく10言語同時・見積も10言語分**。[[i18n-translate-all-10-langs-at-once]]。
- **💰 課金の続き＝正本は別ファイル** `memory\monetize-inflight.md`（Phase0-1は配信済＝1日3回ゲートON。残るユーザー手作業=AdMob/ストア設定等はそちらを参照）。
