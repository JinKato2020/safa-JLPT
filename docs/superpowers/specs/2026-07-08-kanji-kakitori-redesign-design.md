# 設計: 漢字書き取りの全面リデザイン（HanziWriterエンジン化＋3ステップ確立＋田/米グリッド＋SRS/TTS/速度/自由練習）

- 日付: 2026-07-08
- 対象アプリ: まいにちJLPT（safa-JLPT・このセッション担当）
- 前提: 2026-07-07 に漢字書き取りを HanziWriter（WebView）へ全置換済み（build iOS1267/Android2267）。実機テストで下記の不具合・要望が判明。
- 目的: 実機フィードバックを恒久解決し、書き取りを「級別の全漢字を、詰まらず、バランス良く、書いて覚える」学習体験に引き上げる。

## 実機テストで判明した課題（根本原因）

1. **3ステップ（なぞり/見て書く/見ないで書く）が進めない・詰む**
   - 根本原因: 進行が `onComplete` の完全自動のみで、明示的な「次へ」ボタンとステップ進捗表示が無い。さらに③は外形なし＋ヒント無効（`showHintAfterMisses:999`）のため、書き順を思い出せないと HanziWriter が `onComplete` を発火せず**前進手段が無い＝詰み**。
2. **UIが整っていない**（ヘッダ・ステップ表示・情報が最小限）。
3. **なぞり画面が真っ黒**（キャンバス背景が `c.surface` でダークテーマ時に黒。目安線が無くバランスが取りにくい）。
4. **書き順アニメ再生は問題なし**（現状の `↻お手本` は維持）。

## スコープ（YAGNI）

含む:
- KakitoriScreen の全面リデザイン（レイアウト・情報行・ステップドット・ツールバー）
- 3ステップ・フローの明示制御（自動合格＋常時「次へ/スキップ」で**詰み防止**、③に**お手本救済**）
- WebViewエンジン化: HanziWriter＋**田/米グリッド（SVG・文字と同座標系）**＋見本ゴースト＋アニメを内包し、明快なJS APIを持つ自己完結HTML
- **HanziWriterライブラリのローカル同梱**（CDN依存排除）＋**字形データはRNがDL＋`expo-file-system`キャッシュしWebViewへ注入**
- **対象漢字を級別の全漢字へ拡張**（`kanji.json`＝N5 79/N4 166/N3 367）
- 読み/意味/例語パネル（`kanji.json`＋`kanjiLevelReadings.json`）
- 追加機能4つ: **書き取りSRS**・**読み上げTTS**・**アニメ速度調整**・**自由練習モード**
- グリッド/速度/音/モードの設定永続化、star/SRSの永続化（後方互換）
- 触覚フィードバック（`expo-haptics`）
- 単体テスト（SRSスケジューラ・採点スコア・級別リスト算出）、tsc緑、既存32テスト緑

含まない（後日）:
- N2/N1漢字の書き取り（データは級別で拡張しやすい形にするが今回はN5〜N3）
- 白紙フリーインク描画エンジン（自由練習は「なぞり反復型」で実現＝車輪の再発明回避）
- 部首ハイライト・手書き文字認識・ランキング等
- SRSと本体学習エンジン（`items` の p/due）の統合（書きは別モダリティの独立スライス）

## アーキテクチャ全体像（A案）

責務を2層に明確分離する。

- **WebViewエンジン（描画・採点）**: `app/src/kakitori/engineHtml.ts` が生成する自己完結HTML。HanziWriter・グリッド・見本ゴースト・アニメだけを持ち、ネットには一切触れない（字形データはRNから注入）。RN↔WebViewは下記JS APIとpostMessageのみ。
- **RN層（学習体験）**: `KakitoriScreen`（1字の練習）＋復習/ドリルの入口＋SRS/TTS/触覚/永続化/遷移。

境界（WebViewエンジンのJS API・RN→WebViewは `injectJavaScript` で呼ぶ）:

| API | 役割 |
|---|---|
| `KW.load(char, dataJson)` | 字形データを与えて1字を準備（`charDataLoader` で注入・ネット不使用） |
| `KW.setStep(step)` | 0/1/2 に応じ outline/ghost/hint/leniency を設定して quiz 開始 |
| `KW.setGrid('none'\|'ta'\|'kome')` | 背景グリッド切替（SVG再描画） |
| `KW.setColors({...})` | RNテーマ色（線/グリッド/ゴースト等）を反映 |
| `KW.setSpeed('slow'\|'normal'\|'fast')` | アニメ速度 |
| `KW.animate()` | 書き順アニメ再生（お手本） |
| `KW.hint()` | 次の1画のヒント表示 |
| `KW.showAnswer()` | ③救済: その回だけ外形＋アニメを表示 |
| `KW.setFree(bool)` | 自由練習モード切替（採点/前進なし・なぞり反復） |
| `KW.clear()` | 現在の書きを消してやり直し |

WebView→RN（postMessage `type`）: `ready` / `loaded` / `started(step)` / `mistake(strokeNum)` / `complete(mistakes)` / `error(msg)`。

## 詳細設計

### ① 画面レイアウト（KakitoriScreen 全面改修）

上から: ヘッダ（× / `idx+1 / total` / 現在字の★★☆）→ 情報行（漢字・音訓・意味・例語＋🔊）→ ステップドット（●─●─○＋ラベル、現ステップ発光）→ **正方キャンバス**（田/米グリッド＋文字＋見本ゴースト）→ ツールバー（[田][米][×]・速度・[見本👁]・[↻お手本]・[ヒント]・[消す]・[ドリル⇄自由]）→ 下部アクション（[スキップ] / [次へ →]）。

- 本体は ScrollView、キャンバスは固定正方（画面幅と高さから安全に算出、上限 340）。小型端末で情報行/ツールバーが溢れないよう最小高さを確保。
- 情報源: `kanji.json`（char/on/kun/meaning/strokes）＋ `kanjiLevelReadings.json`（代表読み＋例語1件）。
- 「見本👁」= 見本ゴースト（薄い完成字）の表示ON/OFF。ステップにより既定が変わる（下表）。

### ② 3ステップ・フロー（詰み防止が核心）

| ステップ | outline | ghost既定 | ヒント自動 | leniency | 開始時 |
|---|---|---|---|---|---|
| ① なぞり | 表示 | ON | 1ミスで | 1.4 | アニメ1回自動 |
| ② 見て書く | なし | ON（消せる） | 3ミスで | 1.2 | なし |
| ③ 見ないで書く | なし | OFF | 手動ヒントのみ | 1.0 | なし |

進行制御:
- **合格**（HanziWriterが全画許容）→ ドット●＋「✓合格」＋触覚(success)＋TTS(有効時) → 0.7秒後に**自動で次ステップ**。③合格 → その字マスター（星付与）→ 次の漢字。
- **[次へ →]**: いつでも現ステップを前進（自動合格を待たず飛ばせる）。
- **[スキップ]**: その漢字全体を飛ばす。
- **③の救済**: [↻お手本] or [ヒント] で `KW.showAnswer()`（その回だけ外形＋アニメ）→ なぞり直して合格。**これで詰みが原理的に消える。**
- **星ルール**: そのステップを**実際に書いて合格**したら星。[次へ]/[スキップ]で飛ばした分は星なし。3ステップ書き切りで★★★＝マスター。

状態遷移は RN 側で保持（`idx`/`step`/`awaitingNext`）。`onComplete` は「合格フラグを立てる」だけにして、実際の前進はタイマー or [次へ] のどちらでも同じ遷移関数 `advance()` を通す（自動/手動で分岐を作らない＝バグ源を断つ）。

### ③ グリッド ＆ 採点

- グリッドは WebView 内 SVG で文字と同一座標系（`0..S`）に描画するため**位置ズレが原理的に起きない**。
  - **田字格**: 外枠＋中央十字（実線・薄グレー）。
  - **米字格**: 田字格＋対角2本（破線・さらに薄い）。
  - **なし**: 外枠のみ。
  - 色は `KW.setColors` で RN テーマ（ライト/ダーク両対応の中間グレー）を注入。既定 = 米字格。`state.settings.kakitoriGrid` に保存。
- 採点は HanziWriter quiz に委譲（自作採点なし）。ステップ別 leniency（1.4/1.2/1.0）。
  - `onMistake` → ミス数++＋軽い触覚、該当画は HanziWriter 標準で赤ハイライト。
  - `onComplete` → `score = mistakes===0 ? 100 : max(60, 100 - mistakes*8)`、`recordKakitori(char, step, score, {skipped})`。

### ④ 追加機能

**(a) 書き取りSRS（間隔反復）**
- `state.kakitori[char]` を拡張: `{ step, stars, best, due?, interval?, reps? }`（既存3フィールドは温存＝後方互換。`due` 未設定は「未スケジュール」）。
- スケジュール: マスター（★★★）or 復習合格時に `interval` を延長 `1→3→7→16→35日`（ミス多/低スコアなら1段戻す/据え置き）。`due = now + interval*日`、`reps++`。純関数 `scheduleKakitori(prev, {mistakes, now})` に切り出し単体テスト。
- セレクタ `kakitoriDueToday(state, now)` → 期日到来字の配列。
- 導線: (1)**ドリル** = 級別・未マスターを順に（既存 `Kakitori` 入口）。(2)**復習** = 期日到来字だけ（カード/ホームに「今日の書き取り N字」チップ → `Kakitori{mode:'review'}`）。ナビ型に `Kakitori: { level?: 'N5'|'N4'|'N3'; mode?: 'drill'|'review' } | undefined` を追加。

**(b) 読み上げTTS**
- `expo-speech`（オフライン・追加課金なし）。合格時に自動＋🔊で手動。内容 = 代表読み＋例語（`Speech.speak(text, { language:'ja-JP' })`）。`state.settings.kakitoriSound`（既定ON）でON/OFF。未インストールなら `expo install expo-speech`。

**(c) アニメ速度調整**
- `state.settings.kakitoriSpeed: 'slow'|'normal'|'fast'` → `strokeAnimationSpeed 0.5/1/2` ＋ `delayBetweenStrokes 320/180/90`。画面内トグル＆設定画面。`KW.setSpeed` と `KW.animate` に反映。

**(d) 自由練習モード**
- `state.settings.kakitoriMode: 'drill'|'free'`（or 画面内トグル）。自由 = `KW.setFree(true)`：採点/ステップ/前進なし、田/米グリッド上に見本ゴースト＋アニメを繰り返しなぞる（leniency最大・合格で前進しない・[消す]で何度でも）。星は付かない。真の白紙フリーインクは作らない。

### ⑤ データ ＆ キャッシュ（実機安定の要）

- **対象字リスト**: `kanji.json` を level で絞込・grade→頻度順。`app/src/kakitori/list.ts` に `kanjiListFor(level)` を実装（`KAKITORI_CHARS` サンプルは撤去）。
- **HanziWriterライブラリ**: `hanzi-writer.min.js`（v3.7）を `app/src/kakitori/hanziWriterLib.ts` に**文字列定数として同梱**しHTMLへ注入（CDN不使用）。ライセンス（MIT）を謝辞/ライセンス表記に追加。
- **字形データ**: `app/src/kakitori/charData.ts` が `hanzi-writer-data`（`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2/<char>.json`）を取得し `expo-file-system` にキャッシュ（既存の音声/画像DLと同一パターン。`legacy` API 使用＝[[expo-fs-legacy-sdk54]]）。取得したJSONを `KW.load(char, json)` でWebViewへ注入。次の1〜2字をプリウォーム。初回のみ要ネット、以降オフライン可。取得失敗時は `error` 表示＋再試行。
- **永続化**: `state.kakitori` 拡張＋設定 `kakitoriGrid/kakitoriSpeed/kakitoriSound/kakitoriMode` を追加（全てオプショナル＝旧stateと後方互換）。

## 変更・新規ファイル

新規:
- `app/src/kakitori/engineHtml.ts` — WebViewエンジンHTML生成（HanziWriter＋グリッドSVG＋JS API）
- `app/src/kakitori/hanziWriterLib.ts` — 同梱ライブラリ文字列
- `app/src/kakitori/charData.ts` — 字形データ取得＋キャッシュ
- `app/src/kakitori/list.ts` — `kanjiListFor(level)`
- `app/src/kakitori/srs.ts` — `scheduleKakitori` / `kakitoriDueToday`（純関数）
- `app/src/kakitori/scoring.ts` — スコア算出（純関数・テスト対象）
- `app/src/kakitori/__tests__/*.test.ts` — SRS/スコア/リストの単体テスト

改修:
- `app/src/screens/KakitoriScreen.tsx` — 全面改修（レイアウト/フロー/ツールバー/エンジン連携）
- `app/src/kakitori/chars.ts` — 撤去 or `list.ts` へ吸収
- `app/src/store/state.ts` / `store.tsx` — `kakitori` 拡張・`KAKITORI_PROGRESS` に skipped 対応・設定4項目
- `app/src/screens/CardsScreen.tsx` — 「今日の書き取り N字」チップ・級別導線
- `app/src/screens/ProfileScreen.tsx`（設定）— 速度/音/グリッド/モードのトグル
- `app/src/navigation/types.ts` — `Kakitori` パラメータ拡張
- `app/src/i18n/en.json` / `ja.json` — 追加キー（en/jaのみ運用）
- 謝辞/ライセンス — HanziWriter (MIT) 追記

## テスト / 検証

- 単体: `scheduleKakitori`（間隔延長/短縮・境界）、スコア算出（ミス0/多）、`kanjiListFor`（級別件数=79/166/367・重複なし）、`kakitoriDueToday`（期日判定）。
- 型/既存: tsc緑・既存32テスト緑。
- 実行時安全: `KakitoriScreen` を直import相当で state 空/旧state/未キャッシュ字でのnullガードを確認（[[verify-runtime-not-just-build]]）。
- 実機（TestFlight）: 3ステップが自動＋手動の両方で必ず前進し詰まないこと、③救済、田/米グリッド表示、読み上げ、速度、自由練習、SRS期日到来字の復習導線。

## リスク / 留意

- WebView字形データ注入の初回ネット依存（キャッシュ後は解消）。取得失敗時のフォールバックUIを必ず用意。
- `injectJavaScript` はWebViewロード後のみ有効 → `ready`/`loaded` を待って呼ぶ（現行の詰み一因も自動遷移のタイミング）。自動/手動を同一 `advance()` に集約してタイミング競合を断つ。
- web（ブラウザ）は WebView 非対応 → 現行同様に案内フォールバック（赤画面回避）。
- ライブラリ同梱でバンドル増（HanziWriter min ≈ 数十KB＝軽微）。字形データは非同梱（DL＋キャッシュ）。
