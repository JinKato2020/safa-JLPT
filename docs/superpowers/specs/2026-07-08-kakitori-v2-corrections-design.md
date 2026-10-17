# 設計: 漢字書き取り v2 修正（実機フィードバック）— 第1弾=正確性 / 第2弾=UX

- 日付: 2026-07-08
- 対象アプリ: まいにちJLPT（safa-JLPT）
- 前提: 2026-07-08 の書き取りリデザイン（build iOS1282/2282）を実機テスト → 13点のフィードバック。
- 進め方（ユーザー承認）: **第1弾（正確性）を実装→ビルド→実機確認 → その後 第2弾（UX）**。

## 実機フィードバックと分類

第1弾（正確性）:
- ① お手本の薄い字が正しくない（一部の漢字）。→ 原因＝手本データが**中国語漢字**（`hanzi-writer-data`＝makemeahanzi）。日本の字形/筆順/画数と違う（骨/海/曜 等）。
- ⑥ 音声（読み上げ）が出ない。→ 原因＝書き取り画面が `Audio.setAudioModeAsync({ playsInSilentModeIOS:true })` を呼んでいない（iOSサイレントスイッチで無音）。聴解/模試画面には既存。
- （新）「見ないで書く」なのに左上に対象漢字が表示されている。
- ⑩ カードタブ「N5漢字563」＝実は「漢字を含む語数」。漢字は79字。

第2弾（UX/学習最適化）:
- ② 田/米/なし・速度 → プルダウン。
- ③ お手本とヒントが同じ → 統合。
- ⑦ 自由練習でも なぞり/見て書く/見ないで書く を選びたい。
- ⑧ 書き取りが毎回同じ字から → 学習最適化（未習得優先・苦手反復・SRS）。
- ⑨ 漢字/語彙/文法リストに戻るボタン。
- ⑩(nav)+⑫ 漢字リストのカードタップ→詳細→書き取り自由練習の行き来。
- ⑪ カードの読み二重表示解消＋例語の全漢字にふりがな。
- ⑫ カード=対象レベルの読みだけ、詳細画面=全読み＋練習行き来。
- （新）「カード」タブを「単語」タブにリネーム。

決定（ユーザー承認）: ①=**animCJK 日本語データ**採用（純KanjiVGは塗り筆画生成が未解決＋CC BY-SA共有継承のため不採用）／⑩=**漢字の字数(79)基準**／⑧=**SRS優先**／進め方=**正確性を先に1ビルド**。

---

## 第1弾 詳細設計（正確性）

### ① 手本データを animCJK 日本語へ差し替え（ビルド時抽出→同梱）

**調査結論**: animCJK（parsimonhi/animCJK）は `graphicsJa.txt`（1行1字の HanziWriter形式 JSON＝`{"character","strokes":[...SVG paths...],"medians":[[...]]}`）で日本語字形データを配布。per-char CDN は無い。ドロップイン npm（hanzi-writer-data-jp）は submodule 依存で CDN 取得に不向き。→ **ビルド時に対象612字を抽出して同梱**する。

- **新規ビルドスクリプト** `問題/tools/build_kakitori_strokes.py`（or node）:
  - `https://raw.githubusercontent.com/parsimonhi/animCJK/master/graphicsJa.txt` を取得（jsdelivrは403のためraw.githubusercontent）。
  - **スパイク（最初に実測確認）**: 1行=1JSONで `character/strokes/medians` キーがあること、612字（`kanji.json` の type==='kanji'）のカバレッジを確認。
  - 対象612字の `{strokes, medians}` を抽出し `app/src/data/kakitoriStrokes.json`（char→{strokes,medians} のマップ・推定 約1.5〜2.5MB）へ書き出す。**欠け字があればログ列挙**し、欠けは現 `hanzi-writer-data`（中国データ）へフォールバック（どの字も練習不能にしない・欠け一覧を報告）。
- **`charData.ts` を簡素化**: ネットDL＋`expo-file-system`キャッシュを廃止し、**同梱 `kakitoriStrokes.json` からの同期ルックアップ**に置換。`fetchCharData(char): Promise<string>` は互換シグネチャのまま `JSON.stringify(strokes[char])` を返す（欠け字はCDNフォールバックを試行）。→ 完全オフライン・正確・簡素化。
- **謝辞**: `profile.dataSourceBody`（en/ja）に「漢字筆順・書き取りデータ: animCJK / Arphic Public License・KanjiVG系」を追記。HanziWriter(MIT)表記は残す。中国データ(hanzi-writer-data)への言及は不要。
- バンドル増（約2MB）は許容（フォント同梱と同程度）。DL/キャッシュ撤去で `charData_url.test.ts` は用途変更（下記テスト節）。

### ⑥ 音声（TTS）修正

- `KakitoriScreen` で音声を鳴らす前に **`Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(()=>{})`**（expo-av・聴解/模試画面と同じ）を1回実行（マウント時 useEffect）。→ iOSサイレントON時も発話。
- 🔊 ボタンは**常時発話**（`sound` 設定は「合格時の自動読み上げ」だけを制御）。
- `readingLine(char)` が空（`kanjiLevelReadings` 欠け）の時は `kanji.json` の on/kun 先頭読みへフォールバック。

### 「見ないで書く」(step3) で対象漢字を隠す

- 情報行の大きな漢字グリフ `infoChar` を **step===2（見ないで書く）かつ非free時は非表示**（`？` プレースホルダ等）。意味＋読みは手がかりとして残す（＝読み/意味から記憶で書く）。手本ゴーストは既に step2 でOFF。

### ⑩ カバー率「漢字」を79字基準に

- `selectors.ts` の `coverageBars` の 'kanji' カテゴリ母集団を「漢字を含む語(VOCAB.filter(hasKanji)=563)」→ **漢字1字（`kanji.json` type==='kanji' の級内＝79/166/367）** に変更。習得＝その漢字itemの `effectiveP≥0.6`（既存測定を流用）。表示「漢字 X/79」。
- 書き取り進捗「X/79」（既存）と併存し一貫。

---

## 第2弾 設計（UX・第1弾ビルド後に確定）

- ② **グリッド/速度をプルダウン**: ツールバーのチップ→軽量ドロップダウン（追加ライブラリ不要・Modal/ActionSheet風の自作 or 既存パターン）。値は `settings.kakitoriGrid/kakitoriSpeed` に保存（既存）。
- ③ **お手本とヒント統合**: 2ボタン（animate/showAnswer）→ 1ボタン「お手本」（`KW.showAnswer()`＝外形＋アニメ、救済も兼ねる）。
- ⑦ **自由練習で3モード**: 自由練習に「なぞり/見て書く/見ないで書く」選択。採点/前進なしで各モードの見え方（外形/ゴースト/leniency）だけ切替。エンジンに「前進しない練習ステップ」設定を追加 or 画面側で `complete` を無視。
- ⑧ **出題順SRS優先**: `kakitoriDrillQueue(state, level, now)` セレクタ（純関数・テスト対象）＝ ①due到来 → ②未習得(未着手・grade/頻度順) → ③苦手(低星/低best) → ④習得済(★★★)後回し。ドリルモードの `chars` をこの順に。
- ⑨ **Browseに戻るボタン**: `BrowseScreen`（modal）にヘッダ or ×戻る（`nav.goBack()`）を追加。
- ⑩(nav)+⑫ **リスト→詳細→練習**: `BrowseScreen` の漢字行を `Pressable` 化 → **漢字詳細画面 `KanjiDetailScreen`（新規）**へ。詳細＝対象レベル読み（主）＋全読み＋意味＋例語＋「書き取り練習」ボタン → 書き取り自由練習（`Kakitori{ char, mode:'free' }`）。行き来（詳細↔練習・詳細→リスト戻る）。Kakitoriパラメータに `char?: string`（単字自由練習）を追加。
- ⑪ **読み二重解消＋全漢字ふりがな**: `BrowseScreen` 漢字カードの要約行（`headReading`）を削除し詳細行のみ。例語は**語全体にふりがな**（`上手（じょうず）`）で全漢字を読める形に（対象漢字だけ→語全体）。
- ⑫ **カード=対象レベル読み**: `BrowseScreen`/詳細のカード表示を**未使用の `kanjiLevelReadings.json`（レベル絞込済＝外→がい/そと/ほか）**へ切替。全読み（げ/はず 等）は詳細画面で `kanjiCardReadings.json`（or kanji.json）から表示。
- （新）**「カード」タブ→「単語」タブ**: i18n `cards.tab` の表示ラベルを「単語/Words」に。必要ならタブアイコンも語彙寄りに。内部コンポーネント名 `CardsScreen` は据え置き。

---

## テスト / 検証（第1弾）

- 純関数/データ: `build_kakitori_strokes` のカバレッジ（612字・欠け一覧）を実行時ログで確認。`coverageBars` の 'kanji' 母数が79/166/367になることを node で実測。
- 既存テスト（10ファイル）は緑維持。`charData_url.test.ts` はDL廃止に伴い**同梱ルックアップのテスト**（存在字→strokes/mediansを返す・欠け字→フォールバック）へ差し替え。
- tsc緑。実行時: 旧state/欠け字/サイレントモードのガード。
- 実機（TestFlight/内部テスト）: 骨/海/曜 等の手本が日本字形か・音声が鳴るか（サイレントON含む）・見ないで書くで字が隠れるか・漢字カバー率が79基準か。

## リスク / 留意

- animCJKの612字カバレッジ（jōyōベースで概ね充足見込みだが**実測必須**）。欠けはCDNフォールバックで練習可能を保証しログ報告。
- バンドル約2MB増（許容）。DL/キャッシュ撤去でオフライン化・簡素化。
- CC BY-SA/Arphic 帰属表示を謝辞に必ず追加。
- 第2弾の `KanjiDetailScreen` 新規・エンジンの自由練習ステップ拡張は別spec化してもよい（第1弾ビルド後に確定）。
