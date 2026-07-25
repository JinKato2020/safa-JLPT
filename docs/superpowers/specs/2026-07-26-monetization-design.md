# まいにちJLPT マネタイズ設計（課金＋広告）

- 作成: 2026-07-26
- 対象: `c:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ`
- 上位方針: `..\頭脳\販売戦略掲示板.md` §4 マネタイズ／§11 Pro・無課金・ゲーミフィケーション設計
- 状態: **設計確定（実装計画はこの次）**

---

## 1. 目的と範囲

無料で使い続けられるアプリを保ったまま、**Pro（有料）で収益を作る**。広告は補助。

範囲は3つ。**この順に作る**。

| 記号 | 名前 | 中身 |
|---|---|---|
| **A** | 権利の土台 | 「この人はProか」を一元管理。7日お試し。🔒Pro表示 |
| **B** | 課金 | RevenueCat＋ストア課金。購入画面。販売開始 |
| **C** | 広告 | オプトインのリワード動画のみ |

**Aが先**でないと「Proは無広告」が成立しない。**Cは最後**。

---

## 2. 確定した前提（変更しない）

戦略板の確定事項:

- 課金は**ストアIAP必須＋RevenueCatで権利/復元を一元管理**。ローカルのフラグだけで課金状態を持たない
- 匿名ファースト・ログインは任意
- **無料お試しは自前のローカル付与**（ストアの無料トライアルは使わない）。終了後は無料へ**降格するだけでロックアウトしない**
- 無料＝診断（見えるだけ）／Pro＝治療（弱点を埋める）
- 価格は**年額／受験サイクルパックが主役**・月額は割高アンカー・**国別価格必須**・金額は保留
- 広告は**オプトインのリワード動画のみ**。強制インタースティシャルは非推奨（学習を割る）
- 「合格保証」は言わない

本セッションで追加決定した事項:

- **お試し期間＝7日**（戦略板の14日から変更。紹介制度プランに合わせる。紹介報酬+7日で合計14日）
- **Androidは `com.safa.english`（App C枠）のまま**まいにちJLPTとして販売する。理由は時間: この枠は12人×14日のクローズドテストを完走済みで即本番公開できる。新規パッケージだとやり直しになる。パッケージ名はユーザーに見えないため実害なし
- iOSは `com.safa.jlpt`（既存のまま）。iOS/Androidでパッケージ名が違っても、RevenueCatが同じ「Pro」権利にまとめる

---

## 3. 全体アーキテクチャ

**「Proかどうか」を決める場所を1か所に閉じ込める。** 画面は判定ロジックを持たない。

```
[ストアのレシート] --RevenueCat--> purchaseActive (キャッシュ)
[初回起動日]      --7日お試し-->  proUntil
[紹介制度]        --+7日-->      proUntil
                                     |
                                     v
                        proStatus(state, now)  ← 唯一の判定
                                     |
              +----------------------+----------------------+
              v                      v                      v
        模試の解錠            弱点ドリルの解錠         広告SDKを起動するか
```

判定の優先順位:

1. `settings.devPro`（開発用スイッチ・既存）→ Pro
2. `purchaseActive`（購入済み・**正本はストアのレシート**）→ Pro
3. `proUntil > now`（お試し／紹介の期限内）→ Pro
4. それ以外 → 無料

**通信断でもProが剥がれない**: `purchaseActive` は端末に保存し、起動時にRevenueCatの結果で上書きする。通信できないときは最後の値を使う。

---

## 4. A. 権利の土台

### 4.1 保存する値（`src/store/state.ts` に追加）

```ts
entitlements?: {
  purchaseActive?: boolean;    // RevenueCat 同期結果のキャッシュ（正本はレシート）
  purchaseCheckedAt?: number;  // 最後に同期できた時刻
  proUntil?: number;           // お試し・紹介の期限(ms)
};
```

**インストール日は既存の `state.installedAt` を使う**（`src/store/tickets.ts` の `ensureInstall()` が初回起動で確定させている）。お試し開始日を新設すると同じ事実が2か所になるため作らない。

### 4.2 判定（`src/pro/entitlement.ts`・純関数）

既存の `src/mock/fullMockLock.ts` と同じ「純関数＋テスト」の形にする。

```ts
export type ProSource = 'dev' | 'purchase' | 'trial' | 'referral' | 'none';

export interface ProStatus {
  isPro: boolean;
  source: ProSource;
  until?: number;        // trial/referral の期限。purchase のときは undefined
  trialDaysLeft: number; // お試しの残り日数。終了後は 0
}

export function proStatus(state: AppState, now: number): ProStatus;
```

- お試し付与＝`proUntil = state.installedAt + 7日`（`installedAt` は既存・初回起動で確定済み）
- 紹介報酬＝`proUntil` に7日加算（`proUntil` が過去なら `now + 7日`）
- お試し終了後も**何も削除しない**。単に無料の見え方に戻る

### 4.3 UI

- `src/pro/ProLock.tsx`: 無料時に「🔒 Pro」を出す小さな共通部品。Pro機能の入口すべてで使う
- Phase 0 の段階では購入画面が無いので、タップすると「近日」と説明だけ出す（戦略板の「最初から無料/Proの線を表示＝後で課金しても取り上げ感ゼロ」に従う）

---

## 5. B. 課金

### 5.1 使うもの

**RevenueCat（`react-native-purchases`）** を採用する。理由はレシート確認・復元・機種変・国別価格・iOS/Android統合を丸ごと任せられること。売上 $2,500/月まで無料。

不採用案:
- 自前レシート検証（Supabase Edge Function）＝作る量が数倍でバグが売上事故に直結する
- ローカルフラグのみ＝改造で無料化される。戦略板が明確に否定

### 5.2 商品構成

**アプリ内に金額を書かない。** ストアに登録した価格をRevenueCatのOfferings経由で受け取って表示する。これで国別価格が自動で効き、金額を後から決められる。

| 商品 | 種別 | 位置づけ |
|---|---|---|
| 年額 | 自動更新サブスク | **主役** |
| 受験サイクルパック | 非更新（期間固定） | 「12月N4合格パック」＝試験日まで |
| 月額 | 自動更新サブスク | 割高アンカー |

権利（entitlement）識別子は **`pro` の1つだけ**。どの商品を買っても `pro` が立つ。

### 5.3 実装（`src/pro/purchases.ts`）

```ts
export async function initPurchases(): Promise<void>;        // 起動時。Proでなくても必要
export async function syncEntitlement(): Promise<boolean>;   // → entitlements.purchaseActive を更新
export async function getOfferings(): Promise<Offering[]>;   // 購入画面の表示用
export async function purchase(pkg: Package): Promise<boolean>;
export async function restore(): Promise<boolean>;           // 復元（Apple審査で必須）
export async function linkAccount(userId: string): Promise<void>;   // ログイン時
export async function unlinkAccount(): Promise<void>;               // ログアウト時
```

- 匿名のうちはRevenueCatの匿名IDで動く（匿名ファーストを壊さない）
- Google/Appleでログインしたら `linkAccount(supabaseのuserId)` を呼び、機種変・複数端末で権利が follow するようにする

### 5.4 購入画面（Apple審査の必須要件）

以下を**必ず**画面に載せる。欠けるとリジェクトされる。

- 各商品の**価格・期間・自動更新するかどうか**の明示
- **「購入を復元」ボタン**
- **利用規約とプライバシーポリシーへのリンク**（既存の `terms.html` / `privacy.html`）
- 「合格保証」等の断定的な効果表現は書かない

---

## 6. C. 広告（リワード動画のみ）

### 6.1 方針

- **オプトインのみ**。ボタンを押した人にだけ動画を出す。自動再生・全画面の割り込みはしない
- **Proの人は広告SDKを初期化すらしない**。「無広告」を字義どおり実装し、起動も軽くなる

### 6.2 報酬（既存の仕組みに載せる）

| 報酬 | 実装先 |
|---|---|
| 模試チケット +1枚 | 既存 `src/store/tickets.ts`（上限3枚を超えない） |
| 弱点ドリル 1回お試し | **その場で1回だけドリルを開始できる**（視聴直後に即実行。権利として保存しないので残数管理が不要） |

### 6.3 Proを食わないための上限

戦略板の「リワードがPro代替でカニバリ→味見はサイクル1回に絞る（日次にしない）」を受けて上限を設ける。

- 広告視聴は **1日2回まで**
- 広告由来の模試チケットは **月2枚まで**

（数値は運用で調整可能な定数として1か所に置く）

```ts
adRewards?: {
  day?: string;              // 'YYYY-MM-DD'
  countToday?: number;
  month?: string;            // 'YYYY-MM'
  ticketsThisMonth?: number;
};
```

### 6.4 実装（`src/ads/rewarded.ts`）

```ts
export async function initAds(isPro: boolean): Promise<void>;   // Proなら何もしない
export function canWatchReward(state: AppState, now: number): boolean;
export async function showRewarded(kind: 'ticket' | 'drill'): Promise<'earned' | 'skipped' | 'unavailable'>;
```

- 広告が読み込めないときは**静かに諦める**。機能自体は壊さない（ボタンを隠す）
- 開発中は**AdMobのテスト広告ユニットID**を使う。本番IDを開発で叩くとアカウント停止の危険がある

### 6.5 同意・申告（必須）

- **iOS: ATT（追跡の許可）ダイアログ**を1回出す。`NSUserTrackingUsageDescription` を `app.json` に追加。拒否されても広告は出るが単価は下がる
- **UMP（同意管理）**: Googleが必須化。EEA向け同意画面を出す
- **Android 13+**: 広告ID権限が追加される（設定プラグインが自動で入れる）
- **両ストアのプライバシー申告を更新**（広告ID・利用状況データを第三者広告に使う旨）
- 子ども向けアプリとしては設定しない（`tagForChildDirectedTreatment = false`）

### 6.6 収益の見込み（正直な数字）

戦略板の実測でベトナムのeCPM ≈ $2.17〜2.34＝**1回あたり約1〜1.5円**。1日100人が1回見て100〜150円/日。**主役は課金であり、広告は補助**である。

---

## 7. 無料/Pro境界の実装マッピングとフェーズ

現行コードに当てはめた結果、実装の重さが大きく分かれる。

| Pro機能 | 現状 | 重さ | 投入 |
|---|---|---|---|
| 無制限の模試 | チケット制(3枚/300pt)＋月1ロックが既にある | 軽 | **Phase 1** |
| 弱点自動ドリル | オススメCTAが既にある | 軽 | **Phase 1** |
| Pro限定の装飾 | ショップ（`src/data/shop.ts`）が既にある | 軽 | **Phase 1** |
| N4/N3フル開放 | レベルは自己申告。制限の概念が無い（28ファイル関与） | 重 | Phase 2 |
| 無制限SRS | 日次上限がそもそも無い | 重 | Phase 2 |
| ペース予測（日付） | 合格率はあるが日付予測は未実装 | 中 | Phase 2 |

### フェーズ

| Phase | 中身 | 売上 |
|---|---|---|
| **0** | A（権利の土台・7日お試し・🔒Pro表示） | 0 |
| **1** | B（RevenueCat＋購入画面＋商品登録）＋上表の「軽い」3つのゲート → **販売開始** | 本命 |
| **2** | C（リワード広告） | 補助 |
| **3** | N4/N3開放範囲・SRS上限・日付予測 | 後 |

**Phase 3 は「今ある物を取り上げる」変更**であり、既存ユーザーには機能が減ったように見える。Phase 1で実際に売れてから判断する。

---

## 8. ストア・外部サービスの設定作業（人の手が必要）

| 相手 | 作業 |
|---|---|
| Apple | 小規模事業者プログラム登録（手数料15%）／サブスク商品を作成／税務・銀行情報／App内課金のプライバシー申告 |
| Google Play | **App C枠（`com.safa.english`）の掲載情報をまいにちJLPTへ書き換え**／課金商品を作成／データセーフティ記入／現地決済の確認 |
| RevenueCat | アカウント作成／App Store Connect APIキー連携／Play サービスアカウント連携／`pro` 権利とOfferingsの定義 |
| AdMob | アカウント作成／iOS・Android のアプリ登録／リワード広告ユニット作成／`app-ads.txt` を配信サイトへ設置 |

---

## 9. リスクと対策

**最大のリスク＝ネイティブSDKの追加でビルドが壊れること。** 過去にAppleログインの設定でビルド1392/1393がARCHIVE FAILEDになった前例がある。現在 New Architecture が有効なので、SDKは新方式対応版を選ぶ。

対策:

1. **課金SDKと広告SDKを別々のコミットで入れる**（同時に入れない）
2. 各SDK投入後、**TestFlightに届くまで確認してから次に進む**
3. 壊れたらそのコミットだけ戻せる状態を保つ
4. `app.json` のプラグイン追加は1回につき1つ

その他:

- **購入直後にアプリが落ちると「払ったのに使えない」事故**になる。購入完了→権利同期→保存の順を必ず守り、失敗しても次回起動時の `syncEntitlement()` で回復できるようにする
- **審査落ち**: 購入画面の必須要素（価格・期間・自動更新・復元・規約リンク）を実装時チェックリストにする

---

## 10. テスト方針

- **純関数はテストを書く**（既存 `node --test` の並びに追加）
  - `src/pro/entitlement.test.ts`: お試し期限・紹介加算・購入優先・期限切れ・devPro
  - `src/ads/adLimits.test.ts`: 1日2回上限・月2枚上限・日付またぎ
- **実機確認**
  - iOS: サンドボックス購入・復元・機種変（別端末でログイン→Pro follow）
  - Android: ライセンステスターで購入・復元
  - 広告: AdMobテストIDで表示・報酬付与・上限到達時にボタンが消えること
- **回帰**: Pro でない既存ユーザーの動作が Phase 0/1 で変わらないこと

---

## 11. 戦略板（頭脳セッション）へ報告すべき差分

1. **お試し期間 14日 → 7日**（紹介制度プランと整合させた。紹介で+7日＝合計14日）
2. **Androidは新規パッケージを作らず App C枠（`com.safa.english`）で販売**する（12人×14日を完走済みで即公開できるため）

---

## 12. 未決定（実装をブロックしない）

| 項目 | 決める人 | 備考 |
|---|---|---|
| 価格の金額 | 頭脳セッション | ストア側で設定するためコード変更不要 |
| リワード上限の具体値（1日2回・月2枚） | 運用 | 定数1か所で変更可能にする |
| 受験サイクルパックの期間定義 | 頭脳セッション | 「試験日まで」の起算・終了の扱い |
