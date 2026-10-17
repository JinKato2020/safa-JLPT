# ホーム = ゲーム風ステータスパネル（B案・カード内スクロール）設計

作成 2026-07-13 / 承認済み（ユーザー: B案＋カード内スクロール＋学習時間は実時間記録）

## 目的
合格リング（Skia→SVG版）は却下。ホームを、参考画像 `画像/アプリ画像/ホームタブ2.png` のような
**RPG風ステータスパネル**に一新する。背景は `画像/アプリ画像/HOME.png`。

## レイアウト（B案・1画面完結）
- 背景＝`HOME.png` を全画面（`TabBackground` と同じ cover 方式・はみ出さない）。
- 上部＝既存の共通バー（アカウント/JLPTレベル/設定/通知）はそのまま。
- 中央＝**ステータスパネル**（固定サイズのカード。**内側だけ縦スクロール**＝将来ステータスを増やせる）。
- 下部＝**動く桜の巫女**（既存 GUIDE アセット流用・ふわふわ＋瞬き・RN Animated・¥0）。
- ページ自体はスクロールしない（B案）。成長グラフ/バッジ/継続カレンダーはホームから撤去（将来パネル内へ）。
  - ※既存の HomeScreen の成長/継続/バッジ描画は削除。関連 selector は残す（他画面で使用）。

## ステータスパネル（新コンポーネント `src/home/StatusPanel.tsx`）
木枠＋金トリム＋雷グロー。左端に縦「ステータス」タブ。内側は `ScrollView`（`nestedScrollEnabled`）。
順に:
1. **ヘッダー**: 桜巫女ポートレート（小）＋ ランク（合格率tierの称号）／継続日数：N日／学習時間：Xh Ym
2. **合格Lv（メインバー）**: `readinessFor(state,now).passProbability` を 0–100%。緑→黄→桃のカラフルバー。中央に「合格到達度 NN%」。
3. **区分バー×5**（段組みタリー＋雷グロー・並び 漢字→語彙→文法→読解→聴解）:
   - 文法 = `ringsFor().bunpou`、読解 = `.dokkai`、聴解 = `.choukai`
   - 漢字 = 文字語彙のうち漢字系大問の正解率、語彙 = 語彙系大問の正解率
     （`daimonRingPct`/`idsRingPct` を漢字・語彙で束ねる。null は 0% 表示・淡色）
4. （将来枠）他ステータス追加用の余白。カード内スクロールで対応。

タリーバー描画: トラック（暗）＋フィル（`elec1→elec2` グラデ＋glow）＋等間隔の縦チック
（`repeating-linear-gradient` 相当を RN で: 細い区切り View かオーバーレイ）。純RN（react-native-svg 併用可）。

## 学習時間トラッキング（新）
- `AppState` に `studySeconds: number`（既定0）を追加。
- `App.tsx` の AppState リスナで、フォアグラウンド滞在秒を `background`/`inactive` 遷移時に加算保存
  （既存 telemetry の activeSince ロジックに相乗り）。端末保存＋クラウド同期（既存 LWW）に自然に乗る。
- 表示: `Xh Ym`（60分未満は `Ym`）。

## 桜の巫女キャラ（`src/home/HomeGuide.tsx`）
- 既存 `mywordsArt` の `GUIDE.open/blink` を流用（MyWords の BlinkingGuide と同型）。
- 画面下・中央〜右にふわふわ＋瞬き。`pointerEvents="none"`。

## タブのカード＝直接遷移（ポップオーバー「開く」廃止）
- `PopoverBar` のカード＋「開く」二度手間を廃止。**アイコンをタップ＝即その区分の全部入り画面へ遷移**。
  - 単語タブ 漢字 → `WordKubun{kubun:'kanji'}`（CardsScreen: 成長バッジ/バー/漢字リスト/聞き取り/書き取り）。語彙/文法/✦ も各遷移。
  - 試験タブ 字/文/読/聴 → `StudyCategory`、✦→Quiz、試→Mock。辞書タブ 語/漢/文→DictList、★→MyWords。
- 実装: `PopoverBar` を `IconBar`（タップ＝onGo 直呼び）へ戻す/簡素化。`TabEntry.subtitle` は不要化（试験タブの「下のリング…」説明はカード廃止で不要 or ヘッダーへ）。
  - ※「下のリングをタップで大問別…」の案内は StudyCategory 画面内に置く（カードが無くなるため）。

## データ整合・堅牢性
- 全 selector 呼び出しは try/catch or null ガード（`passRingData` と同方針）。値は 0–100 clamp。
- 起動安全: Skia は使わない（撤去済み）。SVG/RN のみ。SafeBoundary は維持。

## 検証
- `npm run tsc` 緑、`npm test`（既存199 維持。学習時間の加算 `addStudySeconds`・漢字/語彙正解率分割・時間整形は純関数化してテスト追加）。
- 実機: HOME.png 背景・パネル内スクロール・各バーの実値・キャラの動き・タブ直遷移。
- ビルド（iOS/TestFlight＋Android AAB）。build番号を起動時に併記。

## 非対象（将来）
- パネルへの追加ステータス（正答数・弱点・模試履歴等）は枠だけ用意し、内容は別タスク。
- 成長グラフ/バッジの別画面導線（今回はホームから撤去のみ）。
