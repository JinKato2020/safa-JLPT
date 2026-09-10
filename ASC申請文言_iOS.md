# App Store Connect 申請チェックリスト — まいにちJLPT (iOS / com.safa.jlpt)

> ⚠️ **文言の正本は `画像\申請スクショ\ストア文言_11言語.xlsx`（iOS+Android・全11言語）です。**
> このファイルは **申請の設定チェックリスト**（ロケール/カテゴリ/URL/プライバシー/スクショ/ビルド等）に用途を絞っています。**文言はここに転記しません**（二重管理で古くなるため）。
> 指標ラベルは必ず **「予想得点（180点満点）」**。到達度/合格率/準備度/readiness は使いません。
> アプリ対応レベル＝**N5・N4・N3**（誇大表現を避けるため N1/N2 は記載しない）。

---

## 1. ロケール（App Store 掲載言語）

- **プライマリ言語 = English (U.S. / en-US)**
- **App Store 掲載ロケール = 8 言語**（正本Excelで「対応」の行）:
  `ja / en-US / id / ko / th / vi / zh-Hans / zh-Hant`
- **ストア非掲載 = ne / bn / my**（正本Excelで「非対応」）。※アプリUIは11言語だが、App Store の掲載言語は8。
- App Name（各30字）/ Subtitle（各30字）/ Promotional Text / Keywords / Description は **すべて正本Excelから該当ロケール列をコピペ**。
  - App Name: en=`Mainichi JLPT` / ja=`まいにちJLPT`（端末表示名と統一）。
  - ⚠ **Subtitle（副題・30字）は現状の正本Excelに列が無い**。旧版は en=「Your predicted JLPT score」/ ja=「予想得点を、毎日すこしずつ上げる」。**副題を出すなら別途決定してExcelに追加**するか、意図的に空欄にするか要判断。
- What's New（リリースノート）: v1.0.0 初回は不要。更新提出時から記入。

---

## 2. App Privacy（プライバシー）【✅ ASC上は既に「収集あり」で申告済み・追加入力不要】

**✅ 2026-09初旬、App Store Connect の App Privacy は既に正しく「収集あり」で入力済み**（プレビュー＝追跡:ID/使用状況、関連付け:購入/位置情報/ID/連絡先/ユーザコンテンツ/使用状況。データタイプ9種＝購入履歴・クラッシュ・おおよその場所・広告データ・ユーザID・デバイスID・メールアドレス・ユーザコンテンツ・製品の操作）。**編集ボタンを押す必要なし。**
以下は根拠と旧メモ誤りの記録：**旧チェックリストの「データを収集していません・トラッキングSDK無し・アカウント無し」は誤り**（手元メモだけが古く、実際のASCは正しかった）。現在の実装（`package.json`/`app.json` で確認）＝ **「データを収集します」が正**。

実装済みSDK:
- **AdMob**（`react-native-google-mobile-ads`）＝広告
- **ATT**（`expo-tracking-transparency`）＝トラッキング許可ダイアログのプラグインあり
- **Supabase**（`@supabase/supabase-js`）＝アカウント（メール）・クラウド同期
- **RevenueCat**（`react-native-purchases`）＝アプリ内課金（サブスク）

広告の実挙動（`src/pro/ads.ts`）＝**リワード広告のみ・既定は非パーソナライズ**。iOSは「トラッキング許可」トグルON＋ATT許可のときだけIDFAでパーソナライズ、拒否/未設定なら非パーソナライズ。

これを ASC の App Privacy に落とすと:

| Apple区分 | データ | 由来 | 用途 |
|---|---|---|---|
| **あなたを追跡するために使用されるデータ** | 識別子（デバイスID/IDFA）・使用状況データ | AdMob | サードパーティ広告（同意時のみ追跡だが「追跡し得る」ため「はい」） |
| **あなたにリンクされるデータ** | メールアドレス・ユーザーID | Supabase（アカウント） | アプリ機能（アカウント/同期） |
| 〃 | 購入（Purchases） | RevenueCat | アプリ機能/分析 |
| 〃 | 識別子 | AdMob | 広告 |

**ATT文言＝設定済み**（`expo-tracking-transparency` プラグインの `userTrackingPermissionMessage`。ビルド時に `NSUserTrackingUsageDescription` を自動注入）:
> 「許可すると、あなたの興味に合った広告が表示されます。学習の記録が第三者に共有されることはありません。」

**ATT文言＝全11言語化 実装済み（2026-09-10・選択C）**：Expo標準の `expo.locales` で `locales/<lang>.json`（ja/en/ne/bn/id/ko/my/th/vi/zh-Hans/zh-Hant）に `NSUserTrackingUsageDescription` を用意。`expo prebuild --clean`（CI）で各言語の `InfoPlist.strings` が生成され、**ATTダイアログの説明文が端末の言語で表示**される。基本フォールバック（開発言語）は `expo-tracking-transparency` プラグインの日本語文。
- ✅ 次のiOSビルド実機で「端末を英語/ネパール語等にした時、ATTの説明文がその言語で出るか」を目視確認。
- 参考：iOS でも AdMob を実際に配信するのか（地域限定運用か）は運用判断。配信しないなら申告を軽くできるが、現状は「収集あり」で申告済みなので問題なし。

---

## 3. 提出チェックリスト（設定・URL・スクショ）

| 項目 | 推奨 / 状態 |
|---|---|
| Primary Category | **Education（教育）** |
| Secondary Category | Reference（辞書/参考）または無し |
| Age Rating | **4+**（不適切表現なし。※広告ありのため広告設定は要確認） |
| Price | **Free**（無料・アプリ内課金あり=Proサブスク） |
| Encryption | `ITSAppUsesNonExemptEncryption=false` を app.json に設定済み → 輸出コンプライアンスは自動クリア |
| Support URL（**必須**） | en `https://www.safa-lang.com/jlpt/en/` ／ ja `https://www.safa-lang.com/jlpt/ja/` ／ 他掲載ロケールも各言語LP。⚠ **提出前に各URLが200で開くか要再確認**（配信は Cloudflare R2＝jlpt.safa-lang.com へ移設済だが、LP/privacy/terms は www.safa-lang.com 側。実体の生存確認を） |
| Privacy Policy URL（**必須**） | en `https://www.safa-lang.com/jlpt/en/privacy/` ／ ja `https://www.safa-lang.com/jlpt/ja/privacy/`（末尾スラッシュ）。⚠ **プライバシー本文も「データ収集なし」で書いていないか要確認**（App Privacy を「収集あり」に直すなら本文も整合させる） |
| Marketing URL | 任意（Support兼用可） |
| Screenshots | 実画面の実キャプチャ・枠なし 1320×2868。en（英語UI）=`申請スクショ\en\` ／ ja（日本語UI）=`申請スクショ\ja\`。他掲載ロケール分のUI言語スクショも用意 |
| App Icon | assets/icon.png（設定済） |
| Build | **v1.1.47**（app.json version）。iOS ビルド番号は CI（build-jlpt.yml）が自動採番（2000+コミット数）。TestFlight 処理完了後に ASC で選択 |

### 残り（提出前）
- ⏳ **App Privacy を「収集あり」で申告し直す**（上記2章。旧「収集なし」は使わない）＋ ATT メッセージ確認
- ⏳ Subtitle を出すか決定（出すなら正本Excelに追加）
- ⏳ Support / Privacy / Terms の各言語URLが200で開くか再確認
- ⏳ 掲載8ロケール分の文言を正本Excelからコピペ＋各UI言語スクショ
- ⏳ 審査提出は **ユーザー合図後**（無断提出しない）
