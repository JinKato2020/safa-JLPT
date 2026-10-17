# 複数問／1文章「統一プレイヤー」＋文章の文法の作り直し 設計書

**日付**: 2026-07-11
**対象アプリ**: safa まいにちJLPT（Expo/React Native + TS・gitルート `app/`）
**状態**: 方針は対話で確定（ユーザー2026-07-11）。実装前の最終spec。

---

## 1. 目的・背景

実際のJLPTでは「1つの文章に複数の設問」を**まとめて提示**する（読解の内容理解/情報検索、文法の文章の文法）。現状のアプリは**設問ごとに文章を繰り返し1問ずつ**表示しており（[ReadingScreen.tsx:44](app/src/screens/ReadingScreen.tsx#L44) が `passages.flatMap(p=>p.questions.map(...))`）、本番形式と食い違う。さらに**文章の文法(passage_grammar)は842件の単空欄断片**として保存され、綺麗に5問セットへ再グループ化できない。

本specで:
1. **複数問／1文章を1画面に一括提示する共通UI**（PassageSetPlayer）を新設し、読解・文章の文法の両方に適用。
2. **文章の文法を本番同形式のセットに作り直す**（N3/N4=1長文×空欄5、N5=2短文×2+3）＝データ構造刷新＋コンテンツ再生成。

## 2. スコープ

### やる
- A. 共通データモデル「passage set」の定義（§3）
- B. PassageSetPlayer（一括提示→一括採点→手動「次へ」）の新設と、読解・文章の文法・模試への適用（§4-5）
- C. 文章の文法の作り直し（旧撤去＋新規120セット生成、§6）

### やらない（今回対象外）
- **聴解**（1音声に複数設問のグループ化）は音声再生の絡みが違うため**別spec**。
- 読解の**コンテンツ生成**（reading.json は既に passage-set 形式で内容も十分）＝**UIのみ変更、データは現状維持**。

### 残す/前提
- 解説表示は無し（前バッチで撤去済）。my単語帳（saveRef）、全問手動「次へ」、不変id/状態移行は既存のまま活用。

## 3. データモデル「passage set」

共通型（`src/quiz` あたりに定義）:
```ts
interface PassageBlock { title?: string; body: string; } // body は 漢字（かな） 表記。文章の文法は本文に空欄マーカを含む。
interface SetQuestion {
  id: string;               // 状態キー（マスタリーは設問単位）
  q?: string;               // 設問文（読解）。文章の文法は空欄番号で代替のため任意。
  blankNo?: number;         // 文章の文法: 本文中の空欄番号(5..9 等)
  choices: string[];
  answerIndex: number;
  pointId?: string;         // 文法: grammar.json id（my単語帳/saveRef用）
}
interface PassageSet {
  id: string;               // セット固有id
  level: 'N5'|'N4'|'N3';
  kind: 'reading' | 'passage_grammar';
  subtype?: string;         // 読解: naiyou_tan/naiyou_chu/joho/choubun
  passages: PassageBlock[]; // 通常1つ。N5文章の文法は2つ。
  questions: SetQuestion[];  // 1..5問。順序＝提示順。
}
```

### 3.1 読解（reading.json・現状維持）
- 既に `{id,level,subtype,title,body,questions[]}` 形式。`questions[]` に `{id,q,choices,answerIndex}`。
- `reading.json` を `PassageSet` へ写像するアダプタを1つ用意（`passages:[{title,body}]`, `questions` はそのまま、`kind:'reading'`）。データ改変なし。

### 3.2 文章の文法（新規 `src/data/exam/passageGrammar.json`）
- `PassageSet[]`。本文 `body` に**空欄マーカ `【5】`..【9】**（N5は各文でその文の問番号）を埋め込む。`questions[i].blankNo` が対応。
- 各設問: `choices`(4), `answerIndex`, `pointId`(grammar.json id)。id 例 `pg-N3-001-q5`。
- **旧 passage_grammar（knowledgeBank内842件）は撤去**：daimon.ts の passage_grammar 経路を新ファイルに差し替え、BANK からは passage_grammar を除外。knowledgeBank.json からの物理削除は任意（当面フィルタで無効化＝休眠、後で pruning 可）。

## 4. PassageSetPlayer（新規共通UI）

`src/components/PassageSetPlayer.tsx`（または screens 配下）。props = `PassageSet` ＋ 完了コールバック。

### 挙動（確定・ユーザー指示）
1. 文章（`passages[]` を順に）を上部に表示。**ruby by level**（§7）。文章の文法は本文中の `【N】` を空欄チップ（番号）として描画。
2. その下に**全設問を番号付きで縦に列挙**（読解=設問文＋4択、文章の文法=「問N」＋4択）。
3. ユーザーが各設問の選択肢をタップ→**選択を保持するが正誤は出さない**（選択済みはハイライトのみ）。回答順は自由。
4. **全設問に回答した瞬間に、全設問の正誤を一括表示**（正解=緑・誤り=赤、各設問に正解位置を示す）。この時点で各設問について `actions.quizAnswer(q.id, correct)` を**1回ずつ記録**（マスタリー設問単位）。
5. **「次へ」ボタンを表示して待機**（最終セットなら「結果へ/終了」）。押下でコールバック→次セット。
6. 文章の文法など `pointId` を持つ設問には、一括表示後に各設問行へ「**＋my単語帳**」（既存 saveRef `{type:'grammar',id:pointId}`）を出す。読解設問（saveRefなし）は出さない。
7. 単発（1設問）セットも同じ流れ（回答→一括表示→次へ）。

### 状態
- 内部 `answers: (number|null)[]`（設問数ぶん）、`revealed: boolean`。`revealed` 化は「全 answers が non-null」で発火。冪等（記録は1回）。

## 5. 出題・状態・模試統合

### 5.1 試験タブ（Quiz）
- 読解Quiz・文章の文法Quiz は、対象 `PassageSet[]` のキューを作り、1セットずつ PassageSetPlayer で提示。
- セット選択（学習）: そのセットに**未習得(p<0.6)の設問が1つ以上**あるセットを優先（既存 ReadingScreen の needy 方式に準拠）。セッション上限数はセット単位で設定。
- マスタリーは設問 `q.id` 単位（§4-4）。セット単位の relearn 再挿入はしない（SRS/セッション横断で反復）。

### 5.2 模試（MockScreen）
- 模試は passage-set を**1ステップ＝K設問**として扱う。PassageSetPlayer で一括提示→一括採点→「次へ」。
- 採点は**設問ごと**に加算（正答数/総設問数）。制限時間タイマーは維持（タイムアウト時は未回答を不正解として結果へ）。
- 本番構成に合わせ、文章の文法は1セット(5問)、読解は各サブタイプ規定数を出す（examBlueprint に従う）。

## 6. 文章の文法の作り直し（コンテンツ）

### 6.1 生成量
- **各級40セット（N5/N4/N3＝計120セット・約600問）**。N3/N4=1長文×空欄5、N5=2短文×(2+3)。

### 6.2 生成規約（必須）
- **級相応の漢字/語彙/文法**。過度に難しい漢字（対象級を超える漢字）を混ぜない。
- 本文は `漢字（かな）` 表記（全漢字に読みを内包。表示時に §7 で下位語彙のルビは自動的に隠れる）。
- **国際ボーダーレス**（個人名を使わず役割ベース＝先生/学生・店員/客等。CLAUDE.md方針）。
- 各空欄: 文法項目を1つ問い、`pointId` を grammar.json の実idに対応させる。4択（正解1＋非競合誤答3）。
- 空欄は本文中に `【N】` で埋め込み、他の空欄は**空欄のまま**（旧データのように正解で埋めない）。
- 一意性：★並べ替えではないので空欄の答えは一意（曖昧化しない）。自己検証（各セット：空欄数・pointId解決・4択重複なし・答えが本文文脈に整合）をプロンプトに内包。

### 6.3 生成方法・コスト
- **セッション内サブエージェント＝実費¥0**（CLAUDE.md #9準拠：少数の大きめエージェント・read廃止・args/自己Write・gen内自己検証）。120セットは小規模。
- 生成物を `src/data/exam/passageGrammar.json` に統合し、bake検証（node走査で構造/ id一意/ pointId解決）後にビルド。

## 7. 表示規約（ふりがな・確定）
- **ルビは「ユーザーの級と同じ、またはそれより上（難）の漢字」だけに表示**。下位（易）の漢字はルビ非表示。未収録漢字はN1相当で常時表示。既存 `rubyNeeded(run, level)`（[index.ts:71-77](app/src/data/index.ts#L71-L77)・`LV_RANK{N5:0..N1:4}`, `漢字級ランク>=ユーザー級ランク`）をそのまま使用。本文・設問文・選択肢すべてに適用。

## 8. 非対象・既知の限界
- 聴解のグループ化は別spec。
- 旧 passage_grammar 842件は当面フィルタ無効化（物理pruningは後日任意）。
- 読解コンテンツは現状維持（UIのみ変更）。

## 9. テスト
- **モデル/アダプタ**: reading.json→PassageSet 写像が全 passage で questions を保持（件数一致）。passageGrammar.json が `PassageSet` 型に適合（各セット: passages≥1, questions長=空欄数, answerIndex∈範囲, pointId∈grammar.json）。
- **一括採点ロジック**（純関数抽出）: 全回答で revealed 発火、各設問正誤判定、quizAnswer 記録が設問数回・冪等。
- **saveRef**: 文章の文法設問→`{type:'grammar', id:pointId}`。
- **回帰**: 既存テスト（passRate/readiness/bankId/saveRef/myList 等）green。passage_grammar 撤去で BANK/daimon が壊れない（tsc green）。
- **生成物検証**: 120セット・各級40・N3/N4空欄5・N5空欄2+3・pointId全解決・4択重複なし（node走査テスト）。
- 新規 `*.test.ts` は `package.json` `test` に追加。

## 10. 実装順序（依存）
1. `PassageSet` 型＋reading アダプタ＋一括採点純関数＋テスト。
2. PassageSetPlayer コンポーネント（挙動§4）。
3. 読解Quiz（ReadingScreen）を PassageSetPlayer に載せ替え（1問ずつ→セット単位）。
4. 文章の文法データ生成（§6・in-session）→ passageGrammar.json ＋ bake検証。
5. daimon/blueprint の passage_grammar を新データ経路へ差し替え、旧 passage_grammar を BANK から除外。文章の文法Quiz を PassageSetPlayer に接続。
6. 模試（MockScreen）を passage-set 対応（一括提示・設問単位採点・タイマー維持）。
7. 全 tsc/テスト green＋生成物検証を確認。
