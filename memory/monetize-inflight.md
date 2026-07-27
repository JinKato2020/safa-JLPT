# 課金Phase1 走行中メモ（inflight）

- 目的: iOS課金(RevenueCat)のサンドボックス購入テスト
- 走行中run: iOSビルド **2576** — https://github.com/JinKato2020/safa-JLPT/actions/runs/30208489401
  - platforms=ios / submit=true（TestFlight提出まで）
- 済: 公開キー貼付(appl_/goog_)・GATING_ENABLED=true・iOS商品(jlpt_pro_yearly/monthly)・Entitlement pro・Offering default(current)にAnnual/Monthly紐付け
- ビルド2576=成功/TestFlight提出済み。端末は2576確認済み。
- 詰まり: Paywallに商品が出ない=有料アプリ契約が未締結だった。対処中:
  - 法人情報更新✅ / 契約署名✅(=ユーザ情報を保留中) / 銀行口座(楽天)登録=処理中 / 納税フォーム(証明書・W-8BEN)提出✅
  - サンドボックステスター jw.psalms34.8+sbx@gmail.com 作成済み(日本)
- 待ち: 銀行処理完了→契約「有効(Active)」化(数時間〜1営業日)→Apple商品反映(さらに数時間)→Paywallに¥3000/¥400
- 次の一手:
  1. https://appstoreconnect.apple.com/business の「有料アプリ契約」が有効化したら、Paywallで価格が出るか
  2. 出たらサンドボックス購入→無制限化→「購入を復元」確認
  3. OKなら Android(Google Play)商品作成→RevenueCat Google Play側にProduct追加→both運用へ
- 保留(テストに影響なし): W-8BENの租税条約9/10(0%)は後日新フォームで出し直し可 / DSA(EUトレーダー)後回し
- 未了: Phase2広告(AdMob未着手)

## Android課金 進行中(2026-07-28)
- お支払い/販売者プロファイル: 既存「加藤 仁」個人プロファイルを選択・公開販売者情報送信済(サポートmail=contact@safa-lang.com / 明細名=SAFA JLPT)
- Play商品2つ **有効**: jlpt_pro_yearly:yearly(¥3000/1年) / jlpt_pro_monthly:monthly(¥400/1月) 各174地域・自動更新
- パッケージ名=com.safa.english / RevenueCat ANDROID_KEY=goog_...設定済
- 次の一手(step3): RevenueCatにGoogle Play接続
  1. サービスアカウントJSON(RevenueCatがPlay購入を検証する鍵)を用意→Play Consoleで権限付与
  2. RevenueCatにGoogle Playアプリ追加(package=com.safa.english + JSON)
  3. 商品 jlpt_pro_yearly:yearly / jlpt_pro_monthly:monthly をRevenueCatに作成→entitlement pro & offering default(既存Annual/Monthlyパッケージ)に紐付け
  4. ライセンステスターでテスト購入
- コード変更は不要(Paywall/購入は両OS共通・キー設定済)

## Phase2 広告(AdMob) 実装(2026-07-28・コード完了/未commit/未ビルド)
- 方針=リワード広告「見て+1回」(1日2本まで)。RevenueCatと同じく「本物ID未設定ならGoogleテスト広告=安全」。ATT(iOSトラッキング許可)=入れる(収益重視・ユーザー選択)。
- SDK追加=`react-native-google-mobile-ads@16.4.0`＋`expo-tracking-transparency@6.0.8`(expo install)。
- 新規: `src/config/admob.ts`(リワードunitID・空ならテストID・`adsConfigured()`)／`src/pro/ads.ts`(`initAds`=ATT→initialize・`showRewardedAd():Promise<bool>`・SDK未リンクでも安全no-op)。
- 改修: `LimitReachedSheet.tsx`(`quota.canWatchAd`の時だけ広告ボタン→報酬で`grantAdBonus()`→Alert→onClose)／`App.tsx`(hydrated後`initAds()`)／i18n `limit.watch_ad/ad_loading/ad_failed/ad_earned`をja/en/neに追加(他7言語はja fallback=既存踏襲)。
- `app.json`: plugins2つを配列化＋**runtimeVersion 1.1.1→1.2.0**(ネイティブ変更でOTA非互換=旧バイナリに配らない)。
- **本物ID反映済み(2026-07-28)**: publisher=pub-8926100627445480。アプリID iOS `~7953954707`/Android `~1388546351`(app.json)。リワードunit iOS `/4757634081`/Android `/7192225739`(admob.ts)。`adsConfigured()`=true。tsc0・pro test16/16。
- テスト端末口=`admob.ts TEST_DEVICE_IDS[]`(空)＋`ads.ts`が`setRequestConfiguration`。本物IDでも自分の端末を載せればテスト広告(規約=自分の本番広告タップ禁止)。
- ゲートのロジック層(grantAdBonus/canWatchAd/AD_BONUS_PER_DAY_MAX=2)はPhase0で既存・出荷済み。検証=tsc0・pro test16/16。
- **⚠広告はネイティブ=OTA不可。反映は再ビルド必須**。いまビルドすればGoogleテスト広告で動作確認できる(実広告は本物ID入れてから)。
- **ビルド方針(2026-07-28 ユーザー指示)**: 「すべて実装してからビルド」。公開はまだ先なので実広告は出ないが、テスト広告で確認するため広告入りビルドは作る(A選択)。実装の最後の残り=**N3聴解021-040の音声100本**を生成中(run `bpr6p4ck8`・約80分)。**完了したら**: ①assets/audioの021-040音声(N5/N4/N3)＋content(係→スタッフ・+260問)＋広告コード を **commit** ②`_manifest.json`再生成＋bundled再ビルド([[ota-manifest-regen-or-stale]]) ③push ④`build-jlpt.yml` dispatch(both・番号=2000+commit)。⚠広告はネイティブ→OTA不可・runtimeVersion 1.2.0。⚠AdMob=お支払い✅済/審査自動開始(24h)/「アプリストアにリンク」はアプリ公開後まで不可=実広告は公開後。テスト端末登録でテスト広告確認。
- **次の一手(ユーザー手作業・公開時)**: ①AdMobアカウント新規作成(admob.google.com)→アプリ2つ登録(iOS com.safa.jlpt / Android com.safa.english)→リワード広告ユニット作成→本物のアプリID/ユニットIDを取得。②app.jsonのandroidAppId/iosAppIdとsrc/config/admob.tsのREWARDED_IDを本物へ置換。③app-ads.txt作成(publisher ID要)＋build-jlpt.ymlでPages配信。④iOS ASCのプライバシー申告に「トラッキング」追加。⑤ビルド。
