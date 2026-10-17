# safa 日本語 共有辞書（正本 / canonical）

JLPTアプリで構築した**汎用の日本語辞書**。App家族(聞いて話せるシリーズ A/B/C)が参照辞書として流用する。

## ⚠️ 既存の教材グロサリとは別物（上書き禁止）
App B/C の `vocab.json` / `dict.json` は「各レッスン本文に紐づくグロサリ」。本辞書は「どの語でも引ける汎用辞書」。
**用途が違うので置き換えず、追加（参照辞書）として読み込むこと。**

## ファイル
- `ja-vocab.json` … 語彙。配列。各要素 `{word, reading, level, gloss, senses[], pos[], pri[]}`
- `ja-kanji.json`  … 漢字。配列。各要素 `{char, on[], kun[], meanings[], grade, strokes, freq}`
- `ja-synonyms.json` … 類義語。`{ vocabId: 意味が近い語 }`（LLM検証済 N5-N3）
- `ja-examples.json` … 語彙例文。`{ "語|読み": {ja, en} }`（ja-vocab に word+reading で結合。学習語を下線表示する用）
- `ja-kanji-examples.json` … 漢字の音訓 例語(複数読み・頻度順)。`{ 漢字: {on:[{reading,word,wordReading}], kun:[…]} }`（ja-kanji に char で結合）
- `manifest.json` … version(内容ハッシュ)・件数・同期日時・出典

## 同期（強制・通信非依存）
JLPT側で `node data-build/dict/sync-dict.mjs` を実行すると、この正本と各ミラーへ push される（冪等）。
相手セッションの稼働は不要。`manifest.json.version` が変わっていなければ既に最新。

## 出典・ライセンス（表示義務あり）
- 語彙/語義: JMdict（EDRDG, CC BY-SA）
- 漢字: KANJIDIC2（EDRDG, CC BY-SA）
- 類義語候補: 日本語WordNet（NICT）
アプリの謝辞画面に EDRDG / 日本語WordNet の帰属表示を出すこと。
