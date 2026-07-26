# ポイント（桜貝）＆ショップ 設計

作成 2026-07-13 / 承認済み（ユーザー: 着せ替え専用ショップ／獲得は両方バランス）

## 目的
学習の継続動機を高める内部通貨「桜貝」と、**着せ替え専用**ショップを導入する。
**非ペイ・トゥ・ウィン**（着せ替えのみ・消耗品なし）で、Pro課金（実課金＝治療系学習機能）とは別軸・非衝突。
※連続フリーズは従来どおり自動消費のまま。**ショップでは販売しない**（ユーザー指示）。

## 通貨
- 名称「桜貝（さくらがい）」／アイコン 🐚（名称・アイコンは i18n で差し替え可）。
- 残高 = `AppState.wallet.points`（整数・0以上）。

## 獲得ルール（両方バランス・純関数で付与）
farming/インフレ防止に **1日獲得上限** と **節目は各1回** を必須にする。

**学習量（`awardForAnswer` / `awardForCompletion`）**
- 問題正解: **+2**（クイズ/ドリルの正解ごと。`dailyEarn` に加算し 1日上限 **300** を超えたら付与しない）
- ドリル/クイズ/セット完了: **+15**
- 模試完了: **+50**
- 漢字1字マスター（stars→最大）: **+5**

**継続（`awardStreak`・その日の初回学習時）**
- 毎日の初回学習: **+10**
- 7日連続到達: **+50**（`claimedMilestones` に `streak7` を記録し重複防止。以降 7日ごとは付与しない＝到達時1回、次は 14/21… も付与するなら `streak-<n>` で記録）
  - MVPでは「7日連続」「30日連続」の2節目のみ。
- 30日連続到達: **+200**（`streak30`）

**上達（節目・`awardMilestone`・各1回）**
- 合格率 tier（0→9）が上がるたび: **+100**（`tier<n>`）
- 合格率 50/70/80% 到達: 各 **+150**（`pass50` `pass70` `pass80`）
- 覚えた語 100 語ごと: **+30**（`learned100` `learned200`…）

> 付与は既存の学習フロー（quizAnswer/mockAnswer/recordKakitori/学習日確定/成長更新）にフックして reducer 内で行う。値・上限は定数化。

## ショップ商品（着せ替え専用・購入で所有＝owned・切替は無料）
- ステータス枠スキン（別配色・季節版）… 500〜1500
- 桜巫女の衣装・小物（帽子・扇・季節衣装）… 600〜1200
- 桜エフェクト（花びらの舞いの種類）… 400
- プレミアム背景テーマ… 800
- 特別バッジ意匠… 700

> 既存の無料着せ替え（`settings.theme`/`font`/`badgeSet` の現行選択肢）は**無料のまま**。ショップは**新規プレミアム着せ替えのみ**扱う（消耗品なし）。

商品定義 = `src/data/shop.ts` の静的カタログ：
```ts
type ShopItem = {
  id: string;
  kind: 'frame' | 'outfit' | 'petal' | 'theme' | 'badge';
  price: number;
  nameKey: string; descKey: string;
  asset?: ImageSourcePropType; // 着せ替えのプレビュー/適用素材
};
```

## 状態（AppState 追加・Supabase LWW 同期に自然に乗る）
```ts
wallet?: { points: number };          // 所持桜貝（未設定→0）
owned?: string[];                     // 購入済みアイテムID
equipped?: { frame?: string; outfit?: string; petal?: string; theme?: string; badge?: string };
claimedMilestones?: string[];         // 節目付与の重複防止
dailyEarn?: { day: string; amount: number }; // 1日獲得上限の当日累計
```
すべて optional（旧state互換）。`updatedAt` 更新で同期。

## 付与・購入ロジック（純関数＝テスト可能）
`src/store/wallet.ts`:
- `addPoints(state, amount, now): AppState` … dailyEarn 上限を考慮して加算（学習量系）。上限超過分は捨てる。
- `awardMilestoneOnce(state, key, amount): AppState` … `claimedMilestones` に未記録なら加算＋記録。
- `canBuy(state, item): boolean` / `buy(state, item, now): AppState` … 残高十分＆未所有なら points 減算＋owned追加（着せ替えのみ）。
- `equip(state, item): AppState` … owned のみ装備切替。
- reducer に `ADD_POINTS` / `BUY_ITEM` / `EQUIP_ITEM` を追加、`useAppActions` に対応アクション。

## UI
- **上部共通バー**に「桜貝残高 🐚N」を追加（アカウント/レベル/設定/通知 の並び・タップでショップへ）。
- **ショップ画面**（RootStack モーダル `Shop`・桜巫女が店番の没入UI）：
  - 上部に残高、カテゴリタブ〔枠／衣装／エフェクト／テーマ／バッジ〕、商品グリッド（アイコン・名・価格・状態〔購入/所有/装備中〕）。
  - 購入時：残高チェック→購入→トースト「+所有」；不足時は無効表示。
  - 獲得時：学習画面等で「+N 🐚」の小演出（既存トースト/簡易アニメ）。
- 装備の反映：`equipped.frame` → StatusPanel の枠、`equipped.petal` → 桜エフェクト、`equipped.outfit` → 巫女表示、`equipped.theme` → テーマ。MVPでは frame と consumable(freeze) を実装、他は枠だけ用意。

## i18n
`shop.*`（title/cat_frame/cat_outfit/cat_petal/cat_theme/cat_badge/buy/owned/equipped/equip/insufficient/balance）、`points.*`（name=桜貝/earned等）、各アイテムの `nameKey`/`descKey`。ja/en/ne を用意、他は ja フォールバック。

## Pro/課金との関係
桜貝は**学習で稼ぐ内部通貨**、商品は**着せ替え＋フリーズ**（学習の有利不利に影響しない）。Pro（実課金）とは別軸で衝突しない。関連 [[jlpt-release-order-monetization]] [[priority-complete-app-before-monetize]]。

## 段階
- **段階1（MVP）**：wallet＋獲得（学習量＋継続＋tier昇格の主要フック）＋残高表示＋ショップ（ステータス枠スキン2〜3種）。純関数＋テスト。
- **段階2**：衣装/桜エフェクト/プレミアムテーマ/特別バッジのアセット生成と装備反映。獲得演出の作り込み。

## 検証
- `npm run tsc` 緑、`npm test`：`wallet.ts` の純関数（1日上限・節目重複防止・購入/所有/装備・残高不足）をテスト追加（package.json の test に登録）。
- 実機：学習で桜貝が増える→上限で頭打ち→ショップで枠スキン購入→装備でステータス枠が変わる。
- ビルド（iOS/TestFlight＋Android AAB）。build番号を起動時併記。

## 非対象（将来）
- ガチャ・機能アイテム（ヒント/XPブースト）は今回対象外（着せ替え＋消耗品のみ）。
- 実課金でのポイント購入は行わない（学習で稼ぐ内部通貨に限定）。
