# 問題コンテンツのファイル整理・多言語配信 設計書

- 日付: 2026-07-14
- 対象: まいにちJLPT(safa-JLPT / `app/`)の試験タブ問題データ＋語彙訳
- 状態: 設計合意済み(ユーザー確認 2026-07-14)。実装計画は別途 writing-plans で作成。

## 1. 背景と目的

現在の問題データは以下の課題を抱える。

- **複数の大問が1ファイルに同居**: `knowledgeBank.json`(用法＋文法形式＋文の組み立ての3大問)、`reading.json`(読解4大問)、`listening.json`(聴解5大問)。
- **翻訳の入り方がバラバラ**: `explainNe`/`reasonNe` をコア問題ファイルに直接埋め込み(context/synonym/orthography)。一方 meaning/example/読解パッセージ訳は別ファイル。用法・文法・漢字読みは訳フィールドすら無い。
- **翻訳は現状ネパール語(ne)のみ**。10言語化すると `explainVi` `explainEn` … がコアに並び肥大。
- **全データがJSバンドル**(実行時取得なし)。修正の度にアプリ再申請が必要。

### 目的(ユーザー要件・2026-07-14 確定)

1. **Pages簡易リリース**: 問題・訳を GitHub Pages に置き、アプリは必要分を取得→端末キャッシュ。修正はPagesへpushするだけで各端末へ反映(アプリ再申請不要)。**問題コンテンツはバンドルしない(日本語も含めて)**。
2. **10言語連動**: 問題を修正・削除・追加したとき、10言語がずれずに一緒に動く。修正時は10言語を一緒に触るので **言語別に分けない(1問に全言語を内蔵)**。
3. **大問×レベルで分割**: 編集時に他レベルの巨大ファイルを読まずに済む(トークン節約)＋ 取得を絞れる。
4. **英数字ファイル名**＋ manifest／フォルダREADMEに日本語の大問名を併記(URL配信安全＋探しやすさ両立)。

想定言語数 ≈ 10。

## 2. 全体方針

**「言語非依存のコア問題＋10言語の訳」を1問オブジェクトに内蔵(inline)し、大問×レベルで1ファイル。全ファイルを GitHub Pages で配信し、アプリは manifest 駆動で差分取得＋端末キャッシュする。**

- inline を選ぶ理由: 修正=1オブジェクト、削除=オブジェクト消去で全言語同時に消える、追加=足して訳を埋めるだけ。**取り残しゼロ＝連動が構造的に保証**される。言語別ファイルだと1問の編集で(1+10)ファイルを触るため連動が弱い。
- 代償: 各ファイルが10言語を含むため、母語1つのユーザーも10言語ぶん取得する。短い解説はごく小さいが、**読解/聴解の長文パッセージ訳は約10倍**。Pagesは一度取得すれば以後キャッシュ(オフライン)なので許容。将来 読解/聴解の通信量が問題化したら **その大問だけ言語分割** に切り替える余地を残す(下記 8.2)。

## 3. ディレクトリ／ファイル構成(Pages配信ルート)

```
pages/content/                         ← GitHub Pages で公開(https://<pages>/content/…)
  _manifest.json                       ← 全ファイルの版(sha256)・大問id⇄日本語表示名・スキーマ版・言語一覧
  problems/
    moji_goi/                          ← 文字・語彙
      kanji_read_N5.json  kanji_read_N4.json  kanji_read_N3.json     # 大問1 漢字読み
      orthography_N5.json …                                          # 大問2 表記
      context_N5.json …                                             # 大問3 文脈規定
      synonym_N5.json …                                             # 大問4 言い換え類義
      usage_N4.json  usage_N3.json                                  # 大問5 用法(N5になし)
    bunpou/                            ← 文法
      grammar_form_N5.json …                                        # 大問1 文法形式判断
      order_N5.json …                                               # 大問2 文の組み立て
      passage_grammar_N5.json …                                     # 大問3 文章の文法
    dokkai/                            ← 読解
      naiyou_tan_N5.json …             # 内容理解(短)
      naiyou_chu_N5.json …             # 内容理解(中)
      naiyou_cho_N3.json               # 内容理解(長)・N3のみ
      joho_N5.json …                   # 情報検索
    choukai/                           ← 聴解
      kadai_N5.json … point_… gaiyou_N3.json hatsuwa_… sokuji_…
    README.md                          ← ファイル名⇄日本語大問名の対応表(人間用)
  lexicon/                             ← 語彙訳(辞書/単語タブと共有・vocab/kanji id キー)
    meaning_N5.json  meaning_N4.json  meaning_N3.json                # 語意
    example_N5.json …                                               # 例文訳
    README.md
```

- ファイル数 ≈ 45〜50(problems)＋6(lexicon)。フォルダで大問一覧・ファイル名で特定が容易。
- 大問→ファイル対応は `README.md` と `_manifest.json` の `daimonLabels` に日本語で併記(例 `kanji_read` → 「大問1 漢字読み」)。

## 4. スキーマ

### 4.1 問題ファイル(例: `context_N4.json`)

```jsonc
{
  "schema": 1,
  "daimon": "context",
  "level": "N4",
  "languages": ["ja","ne","vi","en", …],   // このファイルが持つ訳言語
  "items": [
    {
      "id": "cx:n4-v-123",                  // 安定id(既存採番を踏襲)
      "prompt": "…", "question": "…",
      "answer": "…", "choices": ["…","…","…"],
      "i18n": {                              // 訳は言語コード→翻訳可能フィールドのみ
        "ne": { "explain": "…" },
        "vi": { "explain": "…" },
        "en": { "explain": "…" }
      }
    }
  ]
}
```

- **言語非依存フィールド**(全ユーザー共通): 各大問の設問本体(sentence/prompt/question/stem/answer/choices/underline/body/script/audio 等)。
- **`i18n.<lang>`**: その大問で翻訳する項目のみ。大問ごとの翻訳可能フィールド:

| 大問 | 翻訳する i18n フィールド | 言語非依存(訳さない) |
|---|---|---|
| 漢字読み(kanji_read) | `explain`(任意・任意追加) | sentence/underline/answer/choices |
| 表記(orthography) | `explain` | sentence/underline/answer/choices |
| 文脈規定(context) | `explain` | prompt/question/answer/choices |
| 言い換え類義(synonym) | `explain`(現 `reason` を改名統一) | sentence/underline/word/answer/choices |
| 用法(usage) | `explain`(将来) | stem/question/choices |
| 文法形式/組み立て | `explain`(将来) | stem/question/choices |
| 文章の文法(passage_grammar) | `explain` | passages/questions |
| 読解(naiyou_*/joho) | `body`(パッセージ訳)＋ 各設問 `explain` | title/body(JA)/questions.q/choices |
| 聴解(kadai/…) | `script`(台本訳)＋ 各設問 `explain` | audio/audioChoices/questions |

  読解・聴解の設問文と選択肢は「日本語の読解/聴解力」を測るため **JAのまま**。訳すのは理解補助(パッセージ訳・解説)のみ。

### 4.2 語彙訳ファイル(例: `meaning_N4.json`)

```jsonc
{ "schema": 1, "kind": "meaning", "level": "N4", "languages": [ … ],
  "items": { "n4-v-123": { "ne":"…","vi":"…","en":"…" }, "…": { … } } }
```

- vocab id / kanji char キー。**辞書タブ・単語タブ・試験の語意表示で共有**。例文訳も同形式(`example_*.json`)。

### 4.3 manifest(`_manifest.json`)

```jsonc
{
  "schema": 1,
  "contentVersion": "2026-07-14T…",     // 全体版(表示用)
  "languages": ["ja","ne", …],
  "daimonLabels": { "kanji_read": "大問1 漢字読み", "orthography": "大問2 表記", … },
  "files": {
    "problems/moji_goi/context_N4.json": { "sha256": "…", "bytes": 12345, "count": 646 },
    "lexicon/meaning_N4.json": { "sha256": "…", "bytes": … }
  }
}
```

## 5. アプリ側: 取得・キャッシュ・読み込み

- **起動時**: `_manifest.json` を取得(小さい)。前回キャッシュの manifest とハッシュ比較 → **変わったファイルだけ再取得**。差分がなければ通信なし。
- **取得対象の絞り込み**: ユーザーの学習レベル(と近接レベル)＋選択中の母語で必要なファイルのみ。全レベル一括は要求時のみ。
- **キャッシュ**: `expo-file-system`(SDK54は `expo-file-system/legacy` を使用。既知の罠 [expo-fs-legacy-sdk54])。ダウンロード→端末保存→以後はローカル読み。
- **オフライン**: 初回は選択レベル＋母語ぶんの取得にネット必須。以後キャッシュでオフライン動作。ネット不可＆未キャッシュ時は「学習データの取得が必要」を明示。
- **読み込み層**: 現在 `data/index.ts` が `import` で束ねている問題バンクを、**キャッシュ済みJSONを読み込んで同じ内部形(BANK/KANJI_READ_BANK 等)に組み立てる**ローダに差し替える。既存の出題ロジック(daimon.ts 等)のインターフェースは変えない。
- 既存Pagesインフラ: `ios-build-jlpt.yml` の deploy-pages が push時に `assets/audio`・`dict/` を公開済み。`_site/content` を追加するだけで配信可能。

## 6. 連動を保証する仕組み(構造＋ツール)

- **安定id**: 全問に既存採番(`cx:…`/`kr:…`/`kb-…`/読解聴解のscript id)を維持。訳は id で紐づく。
- **検証(node テスト＋ CI)**: ①id一意 ②全問が `languages` の全言語ぶんの必須訳を持つ(欠けを列挙) ③孤児訳(対応問題なしのi18nキー)なし ④manifest の sha256 と実体一致 ⑤語彙訳のキーが実在 vocab/kanji を指す。**欠け・ずれは即失敗**。
- **翻訳パイプライン**(`tools/`): 追加/変更された問題(idまたはJA本文のハッシュ変化)だけを検出→その `i18n` を差分生成(LLM)。全文再翻訳しない=低コスト。生成後 4.3 の manifest ハッシュを更新。
- **編集運用**: 1問の修正=そのファイルの該当オブジェクトを直す→(JA本文を変えたら)翻訳パイプラインで i18n を更新→検証→Pagesへpush。削除=オブジェクト削除(全言語同時消去)。

## 7. 現状からの移行(1回きり・`tools/migrate_content.py`)

1. 既存 `knowledgeBank.json` を daimon で3分割(usage/grammar_form/order)、`reading.json`/`listening.json` を subtype×level で分割。文字語彙4バンクも level 分割。
2. 各問を新スキーマへ: `explainNe`/`reasonNe` を `i18n.ne.explain` へ移設(**既存neはそのまま流用・作り直さない**)。`reason`→`explain` に名称統一。
3. `meaningL10n.json`/`exampleL10n.json`(ne-only)を `lexicon/meaning_*.json`/`example_*.json` へ、id×level で再配置。`passageTransNe.json` を該当読解ファイルの `i18n.ne.body` へ。
4. `_manifest.json` を生成(sha256/count)。`README.md`(日本語対応表)を生成。
5. 検証を通す。アプリのローダを新形式へ切替。

## 8. スコープ外・将来

### 8.1 スコープ外(この設計に含めない)
- **9言語ぶんの訳の実生成**: 現状 ne のみ。ja/ne 以外は **空(または欠け)** で箱だけ用意。実際に埋めるのは別作業。
  - コスト: 9言語 × 約15,000問の解説＋読解/聴解パッセージ＋語意 = **数千〜万円規模**。CLAUDE #2 に従い **着手前に円見積り→承認**。レベル/大問/言語単位で分割見積り。
- 音声(TTS)配信は既存パイプラインのまま(本設計は問題テキスト＋訳のみ)。

### 8.2 将来の拡張余地
- 読解/聴解のパッセージ訳の通信量が問題化したら、**その大問だけ** `i18n` を言語別サイドカーファイル(`naiyou_cho_N3.ne.json` 等)へ分離。他大問の inline 方針は不変。
- manifest に per-file `minAppVersion` を持たせ、スキーマ変更時の後方互換を制御。

## 9. リスクと対策
- **初回オフライン不可**: 初回のみ取得にネット必須。→ オンボーディングで明示、選択レベル＋母語を最小取得。
- **日本語ファイル名の文字化け**: 英数字ファイル名で回避。日本語名は manifest/README に限定(表示専用・配信経路に日本語を載せない)。
- **キャッシュ不整合**: sha256 照合で検出、不一致は再取得。
- **ビルド緑≠実行時安全**([verify-runtime-not-just-build]): ローダ・検証は node で実データを走らせて確認(型/ビルドだけで満足しない)。
