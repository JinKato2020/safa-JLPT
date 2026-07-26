# 課金・広告 アカウント設定手順（人の手が必要な作業）

- 作成: 2026-07-26
- 対象アプリ: まいにちJLPT（iOS `com.safa.jlpt` / Android `com.safa.english`）
- 前提: コード側は Phase1（課金）が実装済み（commit `a457acc`）。**キーを入れるまで課金は一切動かない＝アプリは今までどおり**。
- 設計の正本: `docs/superpowers/specs/2026-07-26-monetization-design.md`

このファイルは「あなたが手で作るもの」の手順書です。コードは私が用意済みなので、**下の穴を埋めれば課金・広告が動き出します**。専門用語はかみ砕いて書きます。

---

## 全体の流れ（ざっくり）

1. **RevenueCat**（課金の管理役）のアカウントを作る → 公開キーを2つもらう
2. **App Store / Google Play** に「Proの商品」（年額など）を登録する
3. もらった公開キーを `src/config/revenuecat.ts` に貼る（私が貼ってもよい）
4. `GATING_ENABLED` を true にする（＝1日3回制限を有効化）＝私の作業
5. ビルドして TestFlight / 内部テストで購入をテスト → 問題なければ販売開始
6. （あとで）**AdMob**（広告の管理役）で広告を用意 → Phase2

**1〜2があなたの手作業。3〜4は私。5のビルドはあなたの合図で。**

---

## A. RevenueCat（課金）— これが Phase1 の鍵

### A-1. アカウントとアプリ登録
1. https://www.revenuecat.com/ で無料アカウントを作る（売上 $2,500/月まで無料）。
2. 「Project」を1つ作る（名前は「Mainichi JLPT」など何でも可）。
3. その中に **アプリを2つ**登録する:
   - **Apple App Store** アプリ … Bundle ID = `com.safa.jlpt`
   - **Google Play Store** アプリ … Package = `com.safa.english`

### A-2. ストア連携（レシートを確認するための鍵）
- **Apple**: App Store Connect で「App内課金」用の共有シークレット、または App Store Connect API キーを作り、RevenueCat に登録。
- **Google**: Google Play の「サービスアカウント」JSON を RevenueCat に登録（Play Console の権限付与も必要）。
  - ※このサービスアカウントは、すでにビルドで使っている `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64` と同種のもの。RevenueCat 用に権限を足すだけで済む場合が多い。

### A-3. 商品（買えるもの）を作る
**App Store Connect と Google Play Console の両方**で、同じ中身の課金商品を作る:

| 商品 | 種別 | 役割 |
|---|---|---|
| 年額 Pro | 自動更新サブスク | **主役** |
| 月額 Pro | 自動更新サブスク | 割高の比較用 |
| 受験サイクルパック（任意・後回し可） | 非更新 | 「試験日まで」 |

- **金額は国別価格でストア側が決める**。アプリには金額を書いていないので、あとで自由に変更できる。
- 金額をいくらにするかは**頭脳セッションの担当**（まだ未定でOK。商品の「枠」だけ作れば先に進める）。

### A-4. RevenueCat 側の設定（ここが一番大事）
1. **Entitlement（権利）** を1つ作り、識別子を **`pro`** にする（← コードがこの名前を見ている。違う名前だと動かない）。
2. 上で作った年額・月額などの商品を、すべてこの `pro` に**ひも付ける**。
3. **Offering（売り場）** を1つ作り、`current`（既定）にして、パッケージ（年額/月額）を並べる。
   - ← 購入画面はこの Offering の並びをそのまま表示する。空だと「まもなく提供」と出る。

### A-5. 公開キーをもらう（私に渡すもの）
- RevenueCat の「API keys」で、**Public SDK key** を2つコピー:
  - iOS 用（`appl_` で始まる）
  - Android 用（`goog_` で始まる）
- この2つを教えてくれれば、私が `src/config/revenuecat.ts` の `IOS_KEY` / `ANDROID_KEY` に貼ります（自分で貼ってもOK。公開して安全なキーです）。

**A が終われば Phase1 は動きます。**（私が `GATING_ENABLED=true` にして、ビルド→テスト）

---

## B. AdMob（広告）— Phase2（Phase1がテスト通過してから）

### B-1. アカウントとアプリ登録
1. https://admob.google.com/ でアカウントを作る（Google アカウントでOK）。
2. **アプリを2つ**登録（iOS・Android）。登録すると各アプリに **App ID**（`ca-app-pub-…~…`）が付く。
3. 各アプリに **リワード（動画を見て報酬）広告ユニット**を1つ作る。→ 広告ユニットID（`ca-app-pub-…/…`）。

### B-2. app-ads.txt（なりすまし防止・任意だが推奨）
- 配信サイト（Pages）のトップに `app-ads.txt` を置き、AdMob の指定行を書く。
- 置き場所は既存の Pages 配信（`confirm.html` 等と同じ場所）。

### B-3. 私に渡すもの
- iOS/Android の **App ID** 2つと、**リワード広告ユニットID** 2つ。
- ※それまでは Google 公式の**テスト用ID**で私が実装・動作確認できます（アカウント無しでも動く）。テストIDのまま本番申請しないよう、本番IDに差し替えてからビルドします。

---

## いま私が待っているもの（最短で進めるには）

- **Phase1を動かす** → 上の **A-5 の公開キー2つ**（iOS `appl_` / Android `goog_`）。
- **Phase2を仕上げる** → 上の **B-3 のID群**（無くてもテストIDで実装は進められます）。

## 私の残タスク（あなたのアカウント作成と並行して進められる）
- [ ] Phase2（広告）のコード実装（テストIDで先行実装可）※別コミット
- [ ] キー受領後: `revenuecat.ts` にキー貼付 → `GATING_ENABLED=true`
- [ ] ビルド（あなたの合図で）→ TestFlight/内部テストで購入・復元・上限をテスト
