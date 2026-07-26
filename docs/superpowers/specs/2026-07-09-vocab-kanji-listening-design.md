# 設計: 例語音声（Spec B）＋聞き取り学習ドリル（Spec C）

- 日付: 2026-07-09
- 対象アプリ: まいにちJLPT（safa-JLPT）
- 位置づけ: ユーザー要望5件のうち音声2件（④⑤）。構造3件（①②③）は Spec A で出荷済（build 1309/2309）。本Aで作った単語タブUI＋語彙mp3資産の上に乗せる。

## 決定事項（ユーザー承認済）

| 論点 | 決定 |
|---|---|
| ④ 漢字詳細の例語 | 各例語に**▷**。`word|reading`→vocab id が一致すれば**mp3**、無ければ**TTS**（`Speech.speak(reading)`） |
| ⑤ ドリル形式 | **別々の入り口・別々の学習**。語彙カード→語彙ドリル／漢字カード→漢字ドリル |
| ⑤ 語彙ドリル | 🔊語の音声 → **意味4択**（1対1・確定） |
| ⑤ 漢字ドリル | 🔊**代表音声**（自立=代表語 mp3/TTS・拘束=音読みTTS）→ **その漢字を4択**。全612字（拘束も除外せず音読みで出題）。誤答は**同音字を除外**しつつ同レベルの近い字からランダム |
| ⑤ 漢字代表語データ | `kanjiDrillReps.json`（char→{level,bound,word,reading}）＝superpowers全612字精査済。自立511（代表語）＋拘束101（音読み）。例: 火→火(ひ)・学→学ぶ(まなぶ)・書→書く(かく)・校→音こう・館→音かん |
| ④ 例単語補完 | 自立字の代表語が漢字詳細の例単語に無い場合、詳細表示時に**代表語を例単語として追記**（カードに代表語＋▷が出る） |
| ⑤ 出題範囲 | **自レベル**（`settings.level`） |
| ⑤ 習得反映 | 回答を既存 `recordAnswer` で該当 item に反映（カバー率に寄与） |
| ⑤ 誤答(ダミー) | **単純ランダムではなく「正解に近い」候補からランダム**。毎回選び直し＋選択肢順シャッフル（同じ問題でも答えが割れない） |
| 音声基盤 | 既存 `vocabAudio.playVocab(id)`（mp3）＋`expo-speech` フォールバック（Spec A/語彙音声と同一） |

---

## Spec B（④）: 漢字詳細の例語に▷

### データ: 例語→vocab id 解決
- 実測: `KANJI_CARD_READINGS` の例語 3,516 のうち **1,706 が vocab.json と `word|reading` 完全一致**（mp3あり）。残りは vocab 無し→TTS。
- 純関数 `vocabIdForWord(word, reading): string | null`（新規 `src/words/vocabIndex.ts`）: vocab.json から `word|reading → id` の Map を構築（モジュールロード時に1回）。一致すれば id、無ければ null。
- テスト: 既知の一致語（例: 会社|かいしゃ → その id）／不一致語 → null。

### UI: KanjiDetailScreen の各例語に▷
- `KanjiDetailScreen` の読み行（`readLine` 内、各 `CardLine`）の右に小さな**▷**（Ionicons `play`・BrowseScreen行と同じ意匠）。
- `CardLine` に元の `word`/`wordReading` を持たせる（現状 `furiWord`（ルビ整形済）と `label` のみ。再生には素の `word`/`wordReading` が要る）。`fullWordReadingLines`／`levelWordReadingLines` が `word`/`wordReading` も返すよう拡張。
- ▷ onPress: `const id = vocabIdForWord(word, wordReading); if (id) playVocab(id).then(ok => { if (!ok) Speech.speak(wordReading, { language:'ja-JP' }); }); else Speech.speak(wordReading, { language:'ja-JP' });`
- KanjiDetailScreen に `Audio.setAudioModeAsync({ playsInSilentModeIOS:true })` をマウント時1回（iOSサイレント対策・他画面と同じ）。

---

## Spec C（⑤）: 聞き取り学習ドリル 2種

### 画面: `ListeningQuizScreen`（新規モーダル）— 学習→テストの2段
- RootStack にモーダル登録。param `{ kind: 'vocab' | 'kanji' }`。出題レベル＝`settings.level`。
- 1セッション既定 **10語**（自レベル語彙からランダムに選定）。**同じ10語を「学習フェーズ→聞き取りテスト」で共有**する（先に選んでから両フェーズで使う）。
- **フェーズ1: 学習（study）**: 選んだ10語をカード/リストで提示（**語＋読み＋意味＋▷音声**）。ユーザーが各語を聴いて予習できる。下部に「**聞き取りを始める**」ボタン→フェーズ2へ。
- **フェーズ2: 聞き取りテスト（quiz）**: 上部に🔊再生ボタン（大）、下に4択、回答で即フィードバック（正誤色）、次へ、末尾にスコア。出題は学習した10語（順は再シャッフル可）。既存 QuizScreen の意匠/操作感に寄せる（出題プロンプトが「音声」）。
- 状態は画面内 `phase: 'study' | 'quiz'` で切替（同一 `items` を保持）。学習フェーズはスコアに影響しない（予習のみ）。テストフェーズの回答だけ `recordAnswer` で習得反映。

### 出題生成（純関数・テスト対象）
新規 `src/listening/listeningQuiz.ts`:

- `type LQItem = { id: string; word: string; reading: string; meaning: string };`
- `type LQQuestion = { answerId: string; audioWord: string; audioReading: string; choices: { key: string; label: string }[]; answerKey: string };`
  - `kind==='vocab'`: `choices[].label` = 意味。`kind==='kanji'`: `choices[].label` = 表記（word）。
- `pickQuizItems(pool: LQItem[], count, rng): LQItem[]`：自レベル pool から count 語をランダム抽出（重複なし）。**学習フェーズとテストで共有する10語**。
- `buildListeningQuiz(kind, items: LQItem[], pool: LQItem[], rng): LQQuestion[]`
  - `items` = `pickQuizItems` で選んだ出題語（＝学習した10語）。`pool` = 自レベル語彙全体（ダミー供給源）。
  - 各出題語に対し **3ダミーを「近い候補」から**選ぶ（下記 `nearDistractors`・`pool` から）。
  - 正解＋3ダミーの選択肢を作り、**順をシャッフル**（`rng`）。`answerKey` は正解の key。
  - `pool` = 自レベル語彙（呼び出し側が `levelListFor('vocab', level)`＋意味付与で作る）。
- `nearDistractors(correct: LQItem, pool: LQItem[], count, rng): LQItem[]`
  - **近さスコア**（correct と候補 cand、cand≠correct・同一表記/意味除外）:
    - 共通漢字を1字以上含む: +3/共通字（視覚的に紛らわしい＝最優先）
    - 読みの長さが同じ: +1
    - 読みのかなを共有（先頭/末尾一致など）: +1
  - スコア>0 の候補を「近いプール」とし、スコア降順に上位 K（既定20）を取り、そこから `rng` で count 個サンプル。
  - 近い候補が count 未満なら、不足分は pool 全体からランダム補充（安全網・必ず4択を満たす）。
- `rng: () => number`（0..1）を注入し**テスト可能**（本番は `Math.random`）。同じ問題でも呼ぶ度にダミー・順が変わる。

### 音声
- 各問の再生: `playVocab(answerId)`（mp3）→ 失敗時 `Speech.speak(audioReading, { language:'ja-JP' })`。`Audio.setAudioModeAsync` をマウント時1回。

### 習得反映
- 回答時に既存 `recordAnswer`（or 該当の回答記録アクション）を `answerId` に対し正誤で呼ぶ＝カバー率/習得に反映（他ドリルと一貫）。実装時に QuizScreen が使う記録関数を確認し同じものを使う。

### 入り口（単語タブのカード）
- `CardsScreen` の**語彙カードに「聞き取り」ボタン**→ `nav.navigate('ListeningQuiz', { kind:'vocab' })`。
- **漢字カードに「聞き取り」ボタン**（既存の書き取りボタンの隣）→ `{ kind:'kanji' }`。
- ナビ型は Spec A 同様 `WordsStackParamList & RootStackParamList`（カードから RootStack モーダルへ）。

---

## テスト / 検証
- `vocabIdForWord`: 一致→id・不一致→null。
- `buildListeningQuiz`: 指定 count 問・各問4択・正解を必ず含む・選択肢重複なし・kind で label が意味/表記に切替・`rng` 固定で決定的。
- `nearDistractors`: 共通漢字を持つ候補が優先される・count を必ず満たす（近い候補不足時の補充）・correct 自身を含まない。
- tsc 緑・全テスト緑・新規テストは `app/package.json` に登録。
- 実機: 漢字詳細の例語▷が鳴る（mp3/TTS両方）・語彙/漢字の聞き取りが自レベルで4択出題・ダミーが毎回変わる・音が鳴る（サイレント含む）・スコアと習得反映。

## リスク / 留意
- 例語の約51%は mp3 が無く TTS になる（想定内・無音にはしない）。
- `nearDistractors` の「近さ」は共通漢字優先の簡易スコア（意味ベクトルは持たないため表層特徴で近似）。4択が必ず成立するよう補充路を必ず持つ。
- 語彙 pool の意味は母語（`l1`）優先で既存 `meaningIn` を使い、無ければ英語。表示は既存パターンに合わせる。
- `recordAnswer` の正確な関数名/引数は QuizScreen を実測してから使う（取り違え防止）。

## スコープ外（YAGNI）
- 聞き取りドリルのSRSスケジューリング独自化（既存 recordAnswer 反映のみ）。
- 音声速度変更・連続再生・難易度調整。
- 漢字ドリルを「漢字1字プール」にする案（今回は自レベル語彙プールで統一）。
