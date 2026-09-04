# inflight: AIコーチUI刷新＋端末ID(フリーライド対策)＋リテンション計測（2026-09-04）

前回ビルド= **v1.1.33(2902)**。**✅v1.1.34(2903) dispatch済**（2026-09-04・commit `1f0d830b`・iOS+Android・run 33838774591・-NoWatch＝監視しない運用）。テスト71緑/tsc0。ネイティブ3種同梱ゆえ**CI（特にAndroid Gradle）はユーザー側で要確認**。もし `modules/test-lab` でGradle失敗→フォルダ削除して再ビルド（JSは安全fallback・下記D参照）。

## A. 未コミットのコード変更（次ビルドに同梱・OTA不可＝UI/ネイティブ）
tsc緑・i18n parity緑で確認済み。

1. **AIコーチ画面** `src/screens/AICoachScreen.tsx`
   - カバー率カードに**分類別3本折れ線**（漢字青/語彙緑/文法赤・縦=累計語数/横=直近14日）を統合＋**横軸ラベル**（左=coach.growth_ago「2週間前」/右=coach.growth_today「今日」）。
   - 旧「学習量の推移」縦棒バー **削除**（折れ線に統合）。
   - 「本番受験者の中での位置」の**科目別バー(relList/RankBar)削除**＝ベルカーブのみ。
   - **弱点カード＋◇コーチ助言を1カードに統合**（同じアドバイス系）。
2. **記録**：`src/store/state.ts` GrowthPoint に `cov?:{kanji,vocab,grammar}` 追加／`src/store/store.tsx` withStudyDay で分類別カバー率スナップショット記録（今日から。過去は分類別に遡れない＝新規ユーザーは0から自然に伸びる）／`src/store/selectors.ts` `coverageCurve()` 追加。
3. **i18n** ja/en/ne：`coach.vol_title`削除、`coach.growth_ago`/`coach.growth_today` 追加。他8言語は放置（parity対象外）。
4. **端末ID（フリーライド対策A）**：
   - 新規 `src/telemetry/deviceId.ts`（iOS=Keychain UUID via expo-secure-store / Android=ANDROID_ID via expo-application・全て遅延require）。
   - `src/telemetry/telemetry.ts` `anonId()` を**端末固定ID優先**に（既存の全 v_admin ビューが自動で名寄せ＝ビュー改修不要）。
   - `src/pro/trialClient.ts` が `trial-claim` に `deviceId` 送信。
   - 依存追加：**expo-secure-store（app.jsonにconfig plugin自動追加）＋expo-application**。→**ネイティブ追加＝要ビルド**。

## B. サーバ/Supabase（実施状況）
- ✅ `docs/supabase/device_trials.sql` **実行済み**（端末ゲート用テーブル）。
- ✅ Edge Function `trial-claim` **再デプロイ済み**（アカウント＋端末の二重ゲート。無認証POST→401で生存確認済）。実装=`docs/supabase/functions/trial-claim/index.ts`。
- ⚠ `docs/supabase/retention_monetization_views.sql`（**要・再実行**）＝ビュー4本：`v_admin_retention`（週×国D1/D7/D30）/`v_admin_retention_geo`（国別・**テスト由来=未ログイン+学習0を除外**）/`v_admin_monetization`（国×利用×課金・ログイン者のみ）/`v_admin_conversion_geo`（国別転換）。→ **ユーザーが最新版を実行したか要確認**（v_admin_retention_geo 追加後）。
- ✅ `docs/supabase/dashboard.html` に**「国別リテンション(D1/D7/D30)」セクション追加**（v_admin_retention_geo をREST取得。ビュー未作成でも他は壊れない）。→ SQL実行後に再取得で表示。

## C. プライバシー申告（Cステップ）＝✅完了
- ✅ **iOS App Privacy**：デバイスID に **Analytics 追加済み**（広告+トラッキング=はい はAdMob用に正しい・消さない）。
- ✅ **Android Data safety**：Device or other IDs=収集+共有・用途アプリ機能/分析/広告/マーケ。OK。
- ✅ **①プライバシーポリシーWebページ本文＝本番反映済み**（2026-09-04 URL取得で確認）：EN=Device identifier/Keychain/ANDROID_ID/fraud、NE=Keychain/ANDROID_ID/पहिचायक、JA=端末識別子/不正防止/Keychain/ANDROID_ID。www.safa-lang.com/jlpt/{en,ne,ja}/privacy/ 全200。**申告①②③すべて一致・完了。**

## D. ②b Firebase Test Lab 判定＝✅実装済（未ビルド検証）
Test Lab（Google Playテスト前レポートの自動試験）では計測/お試しを送らない＝生tel_snapshot・device_trials も汚さない。
- 新規ネイティブ（ローカルExpoモジュール・Androidのみ）：`modules/test-lab/expo-module.config.json`／`modules/test-lab/android/build.gradle`／`modules/test-lab/android/src/main/java/expo/modules/testlab/TestLabModule.kt`（`Settings.System "firebase.test.lab"`）。
- JS：新規 `src/telemetry/testLab.ts`（遅延require・未リンク/iOS/失敗は false に安全フォールバック）。
- 配線：`App.tsx` の setTelemetryEnabled 2箇所を `&& !isTestLab()` に／`src/pro/trialClient.ts` claimTrial 冒頭で `if(isTestLab()) return null`。
- tsc緑。**⚠ネイティブGradleはビルド未検証**。もし v1.1.34 ビルドが `modules/test-lab` でGradleエラーになったら → **`modules/test-lab` フォルダを削除して再ビルド**（JSは自動でfalse＝抑止しないだけ・他は全て検証済み・アプリは壊れない）。①でダッシュボードは既にクリーンなので保険。

## 次にやる
1. **ビルド v1.1.34**：A（AIコーチUI・端末ID）＋D（②b Test Lab）を iOS+Android で1本に。**「ビルドして」の明示指示で -Approved 実行**。→ **ネイティブ2種（expo-secure-store/expo-application/test-lab）を含むので要ビルド検証**。CI緑を確認（Android Gradleが特に要注意）。
2. **retention_monetization_views.sql を Supabase で（再）実行**（v_admin_retention_geo 追加後）→ dashboard.html 再取得で「国別リテンション」表示。
3. **審査提出**：C完了済みなので、v1.1.34 承認後に iOS/Android 同時リリース（すぐ一般公開方針）。

## 参考（本セッションのSNS/戦略・要点だけ）
- 方針：**すぐ一般リリース**（フォロワー少TikTok100/FB50＝事前登録は不発。iOS/Android同時・承認済み保留分ではなくv1.1.34を提出=再審査）。
- 無料の締め時＝install数でなく **D7リテンション安定＋レビュー数十件＋紹介ループ**。floor目安 1000-3000/国。途上アジア(ネパール)は無料継続。
- 共通DL URL＝ `https://jinkato2020.github.io/safa-JLPT/download.html`（生存200・端末振り分け）。
- SNS素材：予告①絵コンテ artifact / AIコーチ忠実再現スクショ6枚(ja/en/ne×始めたて/合格圏内)=`C:\Users\jwpsa\Downloads\AIコーチ_*.png`ほか / 生成器=scratchpad `render.mjs`＋playwright。※scratchpadは一時。
- 別件（JLPT無関係）：Apple「再訪問記録」アプリ 9/2 Rejected・案件102951179706 → App Review の Reply で対応。
