# 設計: 語彙リスト全語の読み上げ音声（事前生成mp3・Neural2-B）

- 日付: 2026-07-08
- 対象アプリ: まいにちJLPT（safa-JLPT）
- 目的: 単語（語彙）タブの**全3,526語**を、各行のシンプルな再生アイコン「▷」で**正しい読み・正しいアクセント**の音声再生できるようにする。

## 決定事項（ユーザー承認済）

| 論点 | 決定 |
|---|---|
| 音声の出所 | **事前生成mp3**（端末TTSではなく高音質固定音源）。既存の聴解mp3配信基盤を流用 |
| 声 | **Google Neural2-B 女声**・ja-JP（辞書アクセントが正確で安定。比較で採用） |
| 入力テキスト | **漢字表記を送信**（アクセント辞書を効かせる）。ただし後述の上書き対象は「かな入力」 |
| 再生範囲 | **単語（語彙）タブの各語行**のシンプルな再生アイコン「▷」 |
| 失敗時 | mp3未生成/DL失敗時は **expo-speech（端末TTS）へ即フォールバック**（無音にしない） |
| 自動再生 | しない（一覧なので手動タップのみ） |

## 実測前提（app/src/data/vocab.json）

- 総語数 **3,526**（N5 718 / N4 668 / N3 2,140）。ユニーク表記 3,451。
- **同表記で複数読みを持つ語 = 68表記**（漢字入力だと誤読リスク。例: 上=うえ/じょう/うわ/かみ、辛い=からい/つらい、今日=きょう/こんにち、明日=あした/あす）。
- 漢字を含まない語（かな/カナのみ）= 523（そのまま送ればよい）。

---

## アーキテクチャ（3層＋生成パイプライン）

```
[生成: 問題/tools/build_vocab_audio.py]  ── 1回・手動 ──> app 配下に mp3 3,526本
        │  Neural2-B / 漢字入力 / kana上書き / -20dBFS正規化
        ▼
[配信: GitHub Pages  assets/audio/vocab/<id>.mp3]  <── ビルド時 publish
        ▼
[アプリ: src/data/vocabAudio.ts]  ── オンデマンドDL＋FSキャッシュ＋expo-av再生 ──> 単語タブ▷
        │  失敗時 ▼
[フォールバック: expo-speech で読みを即時合成]
```

各ユニットは単一責務・独立にテスト可能:
- **生成スクリプト**: 入力決定（漢字/かな上書き）＋TTS＋正規化＋Excel更新。アプリコードから独立。
- **入力決定ロジック（純関数）**: `ttsTextForVocab(word, reading, overrideSet)` → 送信テキスト。node テスト対象。
- **vocabAudio.ts**: id→URL解決・DL・キャッシュ・再生・停止。`listeningAudio.ts` を範に。
- **UI（単語タブ行の🔊）**: vocabAudio を呼ぶだけ。

---

## ① 生成パイプライン `問題/tools/build_vocab_audio.py`

既存 `問題/tools/build_choukai_audio.py` と同じ認証（`多言語教材/00_共通/tools/gtts_google._load_key`）・同じ Neural2/Chirp 呼び出し形・同じ -20dBFS RMS正規化を再利用する。

- **入力データ**: `app/src/data/vocab.json`（id/word/reading/level）。
- **送信テキストの決定**:
  - 既定 = `word`（漢字表記）を送信。
  - **かな上書き対象**（`reading` を送信）:
    1. 同表記で複数読みを持つ 68表記（vocab.json から動的算出＝表記→読み集合が2以上）。
    2. `問題/tools/vocab_tts_kana_override.json`（id または 表記 のリスト）に列挙した熟字訓・既知の誤読語。**初期値は空配列でよい**（68語は動的算出で自動カバー。運用で誤読を見つけたら id を追記）。
  - かな/カナのみの語は `word == reading` 相当なのでそのまま送信（漢字入力の判定に影響しない）。
- **出力**: `app/assets/audio/vocab/<id>.mp3`（id は vocab.json の id、例 `n5-v-1`）。ディレクトリは新規。
- **音量**: 全ファイル -20dBFS RMS正規化・ピーク -1dBFS（既存聴解と同基準で他音源と音量統一）。
- **冪等**: 既存 mp3 はスキップ。`--force` で作り直し。`--ids n5-v-1,...` で指定生成。`--limit N` で先頭N件だけ（試験生成用）。
- **カバレッジログ**: 生成/スキップ/失敗を集計し、`3526/3526・欠け0` を末尾に出力。失敗idを列挙。
- **規約#9**: 生成後 `問題/語彙音声.xlsx`（列: id / level / 表記 / 読み / 送信テキスト / 入力種別(漢字|かな) / 声 / 備考）を `build_vocab_xlsx` 相当で最新化。

### コスト（規約#2）
- 送信文字数 ≈ 漢字表記合計 約12,000 ＋ かな上書き分。**Neural2 ≈ $16/1M文字**換算で **約¥30〜50（1回きり）**。1000円ルール内・事前承認不要の範囲。
- 生成物 50〜70MB（各 mp3 ~15KB × 3,526）。

---

## ② 配信とキャッシュ

- 配置: GitHub Pages `assets/audio/vocab/<id>.mp3`。既存 `listeningAudio.ts` の `AUDIO_BASE_URL = https://jinkato2020.github.io/safa-JLPT/assets/audio/` の下に `vocab/` を新設。
- ビルド時 publish: 既存の Pages 統合ワークフローが `app/assets/audio/` 配下を配信する構造なら追加不要。`vocab/` が配信対象に含まれることをワークフロー定義で確認し、含まれなければ追加する。**既存の聴解音声URL構造は壊さない**。
- **アプリ同梱はしない**（70MB肥大回避）。オンデマンドDL＋端末FSキャッシュで初回タップ後オフライン可。

---

## ③ アプリ再生 `app/src/data/vocabAudio.ts`

`app/src/data/listeningAudio.ts` を範に新規作成（SDK54のため `expo-file-system/legacy` を使用）。

- `vocabAudioUrl(id: string): string` → `${AUDIO_BASE_URL}vocab/${id}.mp3`。
- `playVocab(id: string): Promise<'played' | 'missing'>`:
  - キャッシュ（`cacheDir/vocab/<id>.mp3`）にあれば再生。無ければDL→キャッシュ→再生。
  - 直前の再生があれば停止してから再生（多重再生防止）。
  - HTTP 404 / DL失敗時は `'missing'` を返す（UI がフォールバック）。
- `expo-av` の `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` をマウント時に1回（既存 KakitoriScreen と同じ・iOSサイレントでも鳴らす）。

### UI（単語タブ行）
- 単語タブ（`BrowseScreen` の `kubun === 'vocab'` 行）の各行右端に **シンプルな再生三角「▷」アイコン1つだけ**（枠・背景・境界線なし・色は控えめ）。余計なラベルやチップは置かない。
- タップ → `playVocab(item.id)`。戻り値が `'missing'` なら **`Speech.speak(item.reading, { language: 'ja-JP' })`** でフォールバック（無音回避）。
- 再生中のみ▷を一時的にハイライト（任意・軽微）。行の他領域タップと▷タップは独立の hit 領域にして競合させない。
- アイコンは既存アイコンセット（`@expo/vector-icons` Ionicons 等・追加依存なし）の `play`/`play-outline` を用いる。

---

## ④ テスト / 検証

- **純関数テスト**（node `--import tsx --test`、`app/package.json` の test スクリプトに新規登録）:
  - `ttsTextForVocab`（新規 `app/src/vocabAudio/ttsText.ts`）: 一意表記→漢字を返す / 68同表記→かなを返す / override id→かなを返す / かなのみ語→そのまま。
  - `vocabAudioUrl`: id→正しいURL。
- **生成カバレッジ**: スクリプトのログで 3,526/3,526・欠け0 を確認。68上書き語が全て「かな入力」になることをスクリプトのドライラン（`--dry-run` で送信テキスト一覧を出力）で確認。
- tsc 緑。既存テスト全緑維持。
- **実機（TestFlight/内部テスト）**: 単語タブで▷が鳴るか（サイレントON含む）・アクセントが自然か・68語（上/今日/明日等）が正しい読みか・DL失敗時にTTSフォールバックするか。

---

## リスク / 留意

- **単一読み表記でも Google が誤読する熟字訓**が残りうる（例: 五日=いつか を ごにち と読む等）。→ `--dry-run` の送信テキスト一覧を人手スポットチェックし、疑わしい語を `vocab_tts_kana_override.json` に追記して再生成。override は運用で育てる前提。
- **配信サイズ 50〜70MB**: オンデマンドDLなので初期アプリサイズ増はゼロ。Pages 帯域は許容。
- **Neural2 のアクセント**: Chirp3-HD より辞書準拠で安定だが完璧ではない。致命的誤アクセント語が見つかれば override（かな）で緩和 or 個別調整。
- 既存の聴解音声URL構造・統合ビルドワークフローを壊さないこと（別ディレクトリ `vocab/` に隔離）。
- 帰属: Neural2 は Google Cloud TTS。既存謝辞に音声生成元の追記は不要（既に聴解で Google TTS 使用済）。ただし変更するなら `profile.dataSourceBody` を確認。

## スコープ外（YAGNI）

- 例文・漢字詳細など単語タブ以外への🔊展開（今回は単語タブのみ。mp3は id 単位なので将来流用可）。
- 男声/声切替設定（今回は Neural2-B 固定）。
- 連続再生・読み上げキュー・速度調整。
