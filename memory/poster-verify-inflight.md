# ポスター音声「お父さん」検証 inflight（2026-09-07）

## 結論（一次情報で確認済み）
- **Release `packs-poster`(v1) の family JA音声はすでに正しく「父(ちち)/母(はは)/兄/姉」**（faster-whisper 実測・お父さんではない）。前セッションが元アプリ検証済み音声へ差し替え済み。**録り直し・有料TTSは不要**。
- ユーザー端末で「お父さん」が残るのは、**修正コミット `4ac90916`(28テーマ＋版管理ローダ＋正しい配信) が未 push・未ビルド**で、実機が旧パイロット build **v1.1.42(2913・commit b909235b)**＝旧お父さん音声焼き込みのままだから。
- 修正は **JS のみ**（b909235b→4ac90916 のコード差分 tsx2/ts2、ネイティブ追加なし。expo-av は 2913 に既存）。runtimeVersion は 2913 も HEAD も "1.2.1" で一致。

## いまやっていること
- **EAS Android 内部APKビルド（preview・distribution=internal・buildType=apk）起動済**。ストア非提出。EAS署名鍵は既存(`Build Credentials CFc39f8JF1`)使用。
  - ビルドURL(QR/APK): https://expo.dev/accounts/jinkato1914/projects/safa-jlpt/builds/6846042a-a3a0-4ef7-b673-44d879cb6413
  - 状態確認は `npx eas build:view 6846042a-a3a0-4ef7-b673-44d879cb6413`（ポーリング禁止・要求時1回）。※upload 1.4GB=.easignore 未整備(次回改善余地)。
- 目的＝TestFlight/iOS上限を使わず実機で「28テーマ表示・箱ハイライト・父/正しい音声の連続再生」を確認。JSのみ修正ゆえ Android で代表確認可。

## 次の一手
1. ビルド完了 → EAS ビルドページのリンク/QR で Android 実機へ APK 直接インストール → ポスター(家族)を再生し「父(ちち)」で鳴るか＋28テーマ表示を確認。
2. OK なら **push（`feat/poster-all-themes-packs`）→ build.ps1 で iOS+Android 本ビルド（-Approved・[[never-build-without-explicit-order]]）**。iOS は本日2/8。
3. iOS の内部確認は ad-hoc(UDID登録) が要り重い＝JSのみ修正のため省略し、本ビルドの TestFlight で確認で無駄がない。

関連: [[poster-audio-pack-canonical]] [[content-ota-vs-ui-build]] [[build-jlpt-yml-is-canonical]]
