# ポスター音声「お父さん」検証 inflight（2026-09-07）

## ★全体サマリ（/clear 前提・残る操作は「新ビルド」だけ）
- ✅ お父さん音声＝配信元は既に「父(ちち)」に修正済(前セッション)。ビルド v1.1.43(2915) で TestFlight/Play へ配信済。
- ✅ ポスター3テーマ追加(数字/色と形/時曜日)＝全31・番号順。words.json合成・posterLessons再生成・パックv2をRelease packs-posterへアップ済(公開catalog v2確認)。TTS不要。
- ✅ UI: テーマリスト左端の漢字1字→連番。画像=WebP1080/q80(最適化済)。
- ✅ i18n仕組み: trans_i18n.py --fill(差分翻訳・zh2=OpenCC)＋build.ps1が検証前に自動実行＋parity.test全11言語＋index.tsフォールバックja→en。8言語の未訳10キー(ポスター等)実翻訳済(全11=1432/0)。菱形=現状維持で確定。
- ⬜ **残る操作＝新ビルド v1.1.44(both)**。上記のposterLessons/UI/i18nは全て未コミットの作業ツリー(main)＝ビルドしないと端末に出ない。パックv2は既にRelease上。build.ps1 -Approved -NoWatch -Platforms both。iOS本日3/8→4/8。
- 作業ツリー(未コミット)= src/data/posterLessons.ts, src/screens/PosterListScreen.tsx, src/i18n/*(index.ts/parity.test/8言語json/zh2), tools/poster/*(poster_themes/build_packs), tools/trans_i18n.py, tools/build.ps1, memory/*。素材側(repo外)= 04/02/13のwords.json新規。


## 結論（一次情報で確認済み）
- **Release `packs-poster`(v1) の family JA音声はすでに正しく「父(ちち)/母(はは)/兄/姉」**（faster-whisper 実測・お父さんではない）。前セッションが元アプリ検証済み音声へ差し替え済み。**録り直し・有料TTSは不要**。
- ユーザー端末で「お父さん」が残るのは、**修正コミット `4ac90916`(28テーマ＋版管理ローダ＋正しい配信) が未 push・未ビルド**で、実機が旧パイロット build **v1.1.42(2913・commit b909235b)**＝旧お父さん音声焼き込みのままだから。
- 修正は **JS のみ**（b909235b→4ac90916 のコード差分 tsx2/ts2、ネイティブ追加なし。expo-av は 2913 に既存）。runtimeVersion は 2913 も HEAD も "1.2.1" で一致。

## いまやっていること
- **EAS Android 内部APKビルド（preview・distribution=internal・buildType=apk）起動済**。ストア非提出。EAS署名鍵は既存(`Build Credentials CFc39f8JF1`)使用。
  - ビルドURL(QR/APK): https://expo.dev/accounts/jinkato1914/projects/safa-jlpt/builds/6846042a-a3a0-4ef7-b673-44d879cb6413
  - 状態確認は `npx eas build:view 6846042a-a3a0-4ef7-b673-44d879cb6413`（ポーリング禁止・要求時1回）。※upload 1.4GB=.easignore 未整備(次回改善余地)。
- 目的＝TestFlight/iOS上限を使わず実機で「28テーマ表示・箱ハイライト・父/正しい音声の連続再生」を確認。JSのみ修正ゆえ Android で代表確認可。

## 経緯の訂正（判断ミス）
- 「内部ビルドでローカル確認」は筋悪だった: Android内部APK=versionCode 2001<実機2913 で格下げ拒否(要アンインストール=データ消)・iOS内部=UDID登録必須。→ EAS Android preview ビルドはキャンセル。正規ビルド(TestFlight/Play内部)へ切替。

## いまの状態（正規ビルド dispatch 済み 2026-09-07）
- `feat/poster-all-themes-packs`(4ac90916) を **main へ ff マージ** → build.ps1 -Approved -NoWatch -Platforms both 実行。
- **v1.1.43（Build 2915）** dispatch 済み・commit `2eaace72`・iOS本日3/8。
- run: https://github.com/JinKato2020/safa-JLPT/actions/runs/34121344249
- 完了で iOS=TestFlight / Android=Play内部テスト に反映（審査なし即時・実機は既存アプリ更新＝アンインストール不要）。

## ✅ ビルド成功（2026-09-07）
- v1.1.43(Build 2915)・build-ios=success(TestFlight提出済)・build-android=success(Play内部テスト提出済)・deploy-pages=skipped(正常)。

## 次の一手
1. ユーザーが実機で TestFlight(iOS)/Play内部テスト(Android) から**更新**（新規でなく更新＝データ保持）→ 単語タブ→ポスター朗読→家族 で「父(ちち)」＆28テーマ確認。
2. 本番公開(Play production / App Store)は**別途ユーザー明示指示がある時だけ**。

## 3テーマ追加＋UI番号化(実装中 2026-09-07)
- 追加＝02_数字/04_色と形/13_時曜日(TTS不要=音声/画像 全11言語既存)。words.json をmjsから合成(素材フォルダ)→ poster_themes.py に番号順挿入(全31)→ gen_poster で posterLessons.ts 再生成(31テーマ・箱検出OK)。
- 音声↔カード順 whisper照合OK(色と形:赤→まる→ひしがた・数字:ゼロ→1・時曜日:おととい→去年)。家族のようなズレ無し。
- UI: PosterListScreen 左端の漢字1字バッジ(`l.title.slice(0,1)`)→ 連番`{i+1}` に変更。
- build_packs VERSION 1→2、パック再ビルド中(bg bolvq2qgd)→ **Release packs-poster へ `gh release upload --clobber` 予定**。
- tsc 0。画像=WebP幅1080/q80(既存最適化)。
- ⬜ 端末反映には**新アプリビルド必須**(posterLessons/UIはネイティブ同梱・28→31)。ユーザー合図で build.ps1。
- 菱形の訳=(a)現状維持で確定(ネパールहीरा/ビルマစိန်・宝石語だが◇の通称・"形"付きで区別済)。

## 別件・保留中の判断
- ポスター単語一覧xlsx(31シート番号順・再生成済 `C:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ\ポスター単語一覧_全テーマ.xlsx`)。
- **菱形(ひし形)の訳**：9言語は図形語でOK。**ネパール `हीरा आकार`・ビルマ `စိန်ပုံ` の2つが宝石ダイヤ語ベース(＝ダイヤの形)**。図形語へ直すかユーザー判断待ち。直す場合は元データ `多言語教材/00_共通/語彙/04_色と形/genB_words.mjs` を書換→xlsx再生成、正確な幾何用語は要裏取り。

関連: [[poster-audio-pack-canonical]] [[content-ota-vs-ui-build]] [[build-jlpt-yml-is-canonical]]
