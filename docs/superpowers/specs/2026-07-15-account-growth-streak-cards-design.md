# アカウント画面 成長カード＋継続カード 設計

**Goal:** アカウント画面(AccountScreen)の上部に、ローカル学習統計を可視化する「成長カード」と「継続カード」を清潔系(アカウント画面調)で常時表示する。

**Status:** 承認済み(2026-07-15)。実装へ。

## 背景 / 現状
- `home/StreakCard.tsx`(継続)と `home/StatusPanel.tsx`(到達度)はDQ風フレームで存在するが**どこからも使われていない孤立コンポーネント**(「DQ風ステータスは不採用」の名残)。成長専用カードは無い。
- 成長データは selector にある: `learnedNow(state, now)`(今の覚えた語)、`growthCurve(state, today, n)`(日ごとの累積「覚えた語」)、`streak`、`studySeconds`。
- AccountScreen は明るい清潔系(`c.surface`/`c.line`、`useColors`)で、ログイン中/未ログインの2状態。

## 決定事項(ユーザー承認)
1. **スタイル**: 既存DQ風は使わず、**アカウント画面調の清潔系カードを新規作成**。
2. **成長カードの主役**: 「覚えた語」の推移。
3. **配置**: アカウント画面の**上部**に、**成長→継続**の順。**ログイン中・未ログインの両状態**で表示。

## コンポーネント

### 1. `src/components/AccountGrowthCard.tsx`(成長カード・自己完結)
- `useAppState` で状態取得、`useColors` でテーマ対応。props なし。
- 見出し: 「🌱 成長」(`home.section_growth`)
- 主役(大): **覚えた語 {n}語**(`learnedNow(state, now)`)。新i18n `account.learned_words`。
- 補助: **今週 +{n}語**(`weekGain`)。新i18n `account.week_gain`。増加0以上のみ表示、負値は+0扱い。
- 推移: 直近14日の累積「覚えた語」を**バー・スパークライン**。アクセント=緑(`c.green`)。最新日を濃く。

### 2. `src/components/AccountStreakCard.tsx`(継続カード・自己完結)
- 見出し: 「🔥 継続」(`home.section_streak`)
- 主役(大): **{n}日**(`streak.current` / `status.days`)＋メタ「最長{n}日・フリーズ{n}」(`home.streak_longest`/`home.streak_freezes`)。
- **総学習時間**: `studyHM(studySeconds)` → `status.time_hm`/`status.time_m`(見出し `status.studytime_label`)。
- 直近7日ドット＋28日グリッド(テーマ色。継続日=琥珀 `c.amber`、今日=枠線)。

### 共通スタイル
`{ backgroundColor:c.surface, borderRadius:radius.lg, borderWidth:1, borderColor:c.line, padding:spacing.lg, gap:spacing.sm }`。見出しは小さめ・アクセント色。数値は太字大。`fontVariant:['tabular-nums']`。ライト/ダーク両対応(全色 `useColors`)。

## データ整形(純関数・テスト可能)
`src/home/growthStats.ts`(新規):
- `growthBars(state: AppState, today: string, n = 14): number[]` — `growthCurve` の各日累積「覚えた語」配列(空→[0]相当・0埋め)。
- `weekGain(state: AppState, now: number): number` — `learnedNow(now)` − 7日前時点の累積(`growthCurve`)。負値は0にクランプ。
- いずれも欠損/空でクラッシュしない。

テスト `src/home/__tests__/growthStats.test.ts`:
- 空 growth → `growthBars` は長さnの0配列、`weekGain` は0。
- サンプル growth 与えて累積・増加が期待通り。

## 配置(AccountScreen)
- ScrollView の body 先頭(✕ の直後、hero の前)に `<AccountGrowthCard/>` → `<AccountStreakCard/>`。
- **ログイン中(session あり)・未ログインの両分岐**で同じ位置に描画(両 return に差し込む。共通化のため小さな内部関数 `Cards = () => (<><AccountGrowthCard/><AccountStreakCard/></>)` を置く)。

## i18n(ja/en/ne)
- 新規: `account.learned_words`「覚えた語 {n}語」/「{n} words learned」、`account.week_gain`「今週 +{n}語」/「This week +{n}」、`account.growth_trend`「覚えた語の推移」/「Learned words」。
- 再利用: `home.section_growth`/`home.section_streak`/`status.days`/`status.studytime_label`/`status.time_hm`/`status.time_m`/`home.streak_longest`/`home.streak_freezes`。

## エラー処理
- selector は既存の try/guard に倣い、欠損は0埋め。growth空でもバー描画は0で線化。
- クラッシュ防止: null/undefined を数値化してから使用。

## テスト
- `growthStats.test.ts`(上記)を `package.json` の test スクリプトに追加。
- カード描画自体はRNのため単体テストなし(ロジックは純関数に隔離)。

## スコープ外(YAGNI)
- 既存DQ風カード(StatusPanel/StreakCard)の削除・改修はしない(別件)。
- 到達度(合格率)カードは追加しない(リング/別カードが担う)。
- クラウド同期の変更なし(統計はローカル既存データ)。
