# 設計: 辞書タブ→カードタブ化＋漢字書き取りゲーミフィケーション（サンプル10字）

- 日付: 2026-07-07
- 対象アプリ: まいにちJLPT（safa-JLPT・このセッション担当）
- 目的: 辞書タブを「カード」タブに改め、漢字/語彙/文法の3カードで構成。漢字カードに漢字書き取り学習（3ステップ・近さ採点）をゲーミフィケーションとして試験導入する。今回は**10字のサンプル**で成立を確認する。

## スコープ（YAGNI）

含む:
- タブの並べ替え・改名（辞書→カード、ホームの隣）
- CardsScreen（漢字/語彙/文法の3カード）
- ホームのカバー率3行（漢字/語彙/文法）をカードへ移設（バー＋カバーバッジ＋10段名）。ホームからは撤去
- 漢字カードの作り込み: 漢字リストへのリンク＋書き取り入口＋書き取り進捗表示
- 書き取り画面 KakitoriScreen（10字サンプル・3ステップ・近さ採点・星）
- 語彙/文法カード = 辞書リストへのリンクのみ（器だけ）
- 採点関数の単体テスト、tsc緑、既存32テスト緑

含まない（後日）:
- 語彙/文法カードの中身の作り込み
- 10字を超える全漢字への展開
- 筆順の方向・順序の厳密判定（今回は「手本への形の近さ」で採点）
- サーバ連携・ランキング等

## アーキテクチャ / 変更点

### ① ナビゲーション（app/App.tsx）
- `TABS` を **ホーム / カード / 学習 / テスト / 設定** の順に変更。
- 「辞書」エントリを「カード」に置換: `component: CardsScreen`、`labelKey: 'cards.tab'`、アイコンは `albums`/`albums-outline`（Ionicons）。
- 現 `BrowseScreen`（辞書）は RootStack のモーダルに移す（Reading/Listening と同様に `presentation:'modal'`）。ルート名 `Browse`、パラメータ `{ view?: 'kanji' | 'vocab' | 'grammar' }`。
- ナビ型（app/src/navigation/types.ts）に `Browse: { view?: 'kanji'|'vocab'|'grammar' } | undefined` を追加。

### ② CardsScreen（新規 app/src/screens/CardsScreen.tsx）
- StudyScreen のカード意匠（StudyCard 相当）を踏襲。漢字/語彙/文法の3カード。
- 各カードに、ホーム④から移したカバー率表示: `learned/total` のバー＋`Badge metric="cover"`＋`home.coverTier<n>`（既存i18nを流用）。カバー率データ源は HomeScreen の `cov`（漢字/語彙/文法）と同じ算出（selectors から取得する形に共通化）。
- 漢字カード: 「漢字リスト」ボタン → `nav.navigate('Browse', { view:'kanji' })`。「書き取り」ボタン → `nav.navigate('Kakitori')`。書き取り進捗「書き取り X/10」を表示。
- 語彙カード: 「語彙リスト」→ `Browse{view:'vocab'}`。文法カード: 「文法リスト」→ `Browse{view:'grammar'}`。

### ③ HomeScreen（app/src/screens/HomeScreen.tsx）
- ④カバー率ブロック（`home.coverage_title` の見出し＋`cov.map(...)`）を削除。成長グラフ・継続・バッジは残す。
- 未使用になる `cov` 計算があれば除去（他で使っていれば残す）。レイアウト崩れがないことを確認。

### ④ BrowseScreen（app/src/screens/BrowseScreen.tsx）
- 既存で `Kubun = 'vocab' | 'kanji' | 'grammar'` の3タブ（`const [kubun, setKubun] = useState<Kubun>('vocab')`）を内蔵済み。`route.params.view` を初期 `kubun` に渡す（`useState<Kubun>(route.params?.view ?? 'vocab')`）。これで漢字/語彙/文法カードのリンクは各実在一覧を直接開く。
- モーダルとして戻る導線（ヘッダ or 閉じるボタン）を確保。
- 3カードのリンク対応: 漢字→`Browse{view:'kanji'}` / 語彙→`Browse{view:'vocab'}` / 文法→`Browse{view:'grammar'}`。

### ⑤ 書き取りエンジン（核）
データ:
- `app/src/data/kakitoriSample.json` = 10字。各要素 `{ char, level, strokes: number[][][] }`。
  - `strokes` = 画ごとの点列。点は `[x,y]`（0..1に正規化した座標）。KanjiVG（CC BY-SA 3.0, Ulrich Apel）の各字SVGの `<path>` を等間隔サンプリングして生成。
  - 生成は再現スクリプト `問題/tools/build_kakitori_sample.py`（KanjiVG SVG→点列JSON）。10字の選定は N5 の基本字（例: 一 二 三 人 大 日 月 山 川 木）。

採点（純JS・app/src/kakitori/score.ts）:
- 入力: ユーザーの描画点列 `user: [x,y][]`（正規化）と手本 `model: number[][][]`。
- `accuracy` = ユーザー各点→手本の全画の最近距離の平均を、しきい距離で 0..1 に写像（近いほど高い）。
- `coverage` = 手本の点のうち、ユーザー軌跡の近傍に入った割合。
- `spill` = しきい距離を大きく超えるユーザー点の割合（はみ出し減点）。
- `score = round(100 * clamp(0.5*accuracy + 0.5*coverage - 0.3*spill, 0, 1))`。
- 純粋関数・副作用なし・単体テスト対象。

画面（app/src/screens/KakitoriScreen.tsx）:
- 10字を順に。各字 **3ステップ**: `trace`（手本を濃く表示・なぞる）→ `guided`（手本を薄く表示・見て書く）→ `recall`（手本非表示・見ないで書く）。
- 描画: `PanResponder`（または react-native-gesture-handler）で指の軌跡を収集→正規化。手本＋ユーザー軌跡を **react-native-svg** で描画。
- 判定: 各ステップで「採点」ボタン→`score`。`score >= PASS(=70)` で次ステップへ。未達は再挑戦。手本を「クリア」ボタンで消去・やり直し可。
- ゲーミフィケーション: 字ごとに星 = クリアしたステップ数（0..3、3=マスター）。全体進捗「マスター X/10」。合格時に軽い演出（既存トーン内・課金なし）。

永続化（app/src/store/store.ts + types）:
- `state.kakitori: Record<string, { step: 0|1|2|3; stars: number; best: number }>`（キー=char）。
- reducer アクション `KAKITORI_PROGRESS { char, step, score }`: `stars=max(stars, step)`, `best=max(best, score)` を更新。
- 既存の永続化（AsyncStorage 等）に相乗り。

i18n:
- 追加キー（en/ja のみ・他言語は後日）: `cards.tab`, `cards.kanji`, `cards.vocab`, `cards.grammar`, `cards.kanji_list`, `cards.vocab_list`, `cards.grammar_list`, `cards.kakitori_entry`, `cards.kakitori_progress`（"書き取り {done}/{total}"）, `kakitori.title`, `kakitori.step_trace`, `kakitori.step_guided`, `kakitori.step_recall`, `kakitori.grade`, `kakitori.clear`, `kakitori.pass`, `kakitori.retry`, `kakitori.score`, `kakitori.mastered`。

## データフロー
1. Cards タブ表示 → selectors からカバー率（漢字/語彙/文法）と `state.kakitori` を読み、各カードにバー/バッジ/進捗を表示。
2. 漢字カード「書き取り」→ Kakitori。字ごとに trace→guided→recall。各ステップで指軌跡→`score()`→合否。
3. 合格で `KAKITORI_PROGRESS` dispatch → store 更新 → Cards の「マスター X/10」に反映。
4. 「漢字/語彙/文法リスト」→ Browse モーダル（該当 view）。

## エラー / 端条件
- 空の描画で採点 → `score=0`、`kakitori.retry` を促す（クラッシュしない）。
- `kakitoriSample.json` 読み込み失敗や字の欠損 → その字をスキップ（nullガード）。実行時検証（node直import）で0不良を確認（[[verify-runtime-not-just-build]]）。
- react-native-svg / gesture が未導入なら導入（package 確認）。PanResponder のみで完結できるなら追加依存を避ける。

## テスト
- `score.ts` の単体テスト: 完全一致≈100、無関係な線≈低、空入力=0、はみ出し減点が効く、を検証。
- KakitoriScreen の描画スモーク（レンダリング落ちない）。
- tsc 緑・既存32テスト緑・`kakitoriSample.json` を node 直 import して10字・各画点列が非空を確認。

## 出典 / ライセンス
- KanjiVG © Ulrich Apel, CC BY-SA 3.0。謝辞（設定の謝辞画面＋metaライセンス表記）に追加。既存の JMdict/KANJIDIC2 © EDRDG、Waller(CC BY) と並記。

## 完了の定義
- カード/ホーム/Browse/Kakitori が上記どおり動作、10字で trace→guided→recall→星が付き、Cards に「マスター X/10」が反映。
- tsc 緑・32テスト緑・採点単体テスト緑・実行時0不良。
- 未ビルド（実機確認の合図後にまとめてビルド）。
