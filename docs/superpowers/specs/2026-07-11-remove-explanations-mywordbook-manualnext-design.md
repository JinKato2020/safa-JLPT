# 解説撤去 ＋ my単語帳 ＋ 全問手動「次へ」 設計書

**日付**: 2026-07-11
**対象アプリ**: safa まいにちJLPT（Expo/React Native + TS・gitルート `app/`）
**状態**: 設計方針は対話で確定済み（ユーザー2026-07-11）。実装前の最終spec。

---

## 1. 目的・背景

ユーザー方針の転換:
1. **解答後の解説は全大問で不要** → 文字語彙/文法（knowledgeBank）＋読解/聴解、**すべての解説表示を撤去**。先日マージした多言語解説アーキテクチャ（explain L10n）も撤去する。
2. その代わり **my単語帳** を新設。解答語（語daimon）／文法項目（文法daimon）を個人リストに保存し、既存の復習で反復。
3. **解答後に自動で次問へ進む挙動を廃止**し、**全問に手動「次へ」ボタン**を置く。フル模試も含めて全問手動（正解を確認・学習してから進む）。

## 2. スコープと「残すもの」の線引き

### やる
- A. 解説表示・解説L10nアーキテクチャの撤去（§3）
- B. 自動送り廃止＋全問手動「次へ」（§4）
- C. my単語帳の新設（§5）

### 残す（解説と無関係・撤去すると二次被害）
- **不変id `kb-NNNNNN`／`bk:→kb-` 状態移行（storage.ts）／daimon BANK の id化／selectors の `bankLevelOf`**。既にmainで稼働・ユーザー移行済み。撤去すると逆移行が必要で**学習進捗を壊す**。→ 手を付けない。

### やらない（対象外）
- 読解/聴解データ（reading.json/listening.json）内の `explain`/`explainNe` フィールド自体の物理削除（表示を止めれば機能的に達成。データ除去は churn 大で便益なし＝休眠のまま放置）。
- 各バンク（orthography/context/synonym）の inline `explain`/`explainNe` フィールドも同様に休眠放置（非表示にするだけ）。

## 3. 解説撤去（A）

### 3.1 削除するファイル（先日の多言語解説の産物）
- `app/src/components/ExplainL10n.tsx`
- `app/src/data/exam/explainL10n.ts`
- `app/src/data/exam/explainJa.ts`
- `app/src/data/exam/explain.ja.json`
- `app/src/data/exam/l10n/`（explain.<lang>.json 全部）
- `app/src/data/exam/explainJa.test.ts`
- `app/src/data/audioBase.ts` の `L10N_BASE_URL`/`explainL10nUrl`（＋ `audioBase.test.ts` の該当テスト）
- `.github/workflows/ios-build-jlpt.yml` の `_site/assets/l10n` コピー2行（Task8で足したもの）

### 3.2 コード変更
- `app/src/data/daimon.ts`: `import { explainJa }` を削除。`questionForUnit` の BANK_INDEX 分岐と `learnCardFor` から `explain: explainJa(bank.id)` を除去（`explain` を付与しない）。他バンク分岐（og/cx/sy/ex）の `explain`/`explainNe` は**残置**（表示側で描画しないだけ）。
- 解説ボックスの描画を削除:
  - `app/src/screens/QuizScreen.tsx`: `explainBox`（`question.explain` の View）と `<ExplainL10n>` 行、`settings.l1==='ne'…` の残置行、関連 style（`explainBox/explainLabel/explainTxt/explainNe/learnHit/learnRuby`）。
  - `app/src/screens/MockScreen.tsx`: `{cur.explain ? <explainBox> …}` と `<ExplainL10n>` 行、関連 style。
  - `app/src/screens/ReadingScreen.tsx`・`app/src/screens/ListeningScreen.tsx`: `explainBox`（`explain`/`explainNe` 描画）を削除。
- `Question.explain`/`explainNe`（quiz.ts）の型フィールドは、他バンクが値を詰めているので**残置可**（描画しないので無害）。ただし未使用となる。撤去は任意（YAGNIで残置）。

## 4. 自動送り廃止＋全問手動「次へ」（B）

実測: 自動送りは **MockScreen のみ**（`setTimeout(advance)` 付近）。QuizScreen・ListeningQuizScreen・WordDrillScreen は既に手動ボタン。

### 変更
- `app/src/screens/MockScreen.tsx`:
  - 解答確定後の `setTimeout(() => advance(), delay)` を撤去し、**手動「次へ」ボタン**を表示（最終問は「結果を見る」）。ボタン押下で `advance()`。
  - `mock.auto_next`/`mock.auto_result` の自動遷移テキスト表示を、押下式ボタンのラベル（`mock.next`/`mock.see_result`）に置換。i18n キーを追加（ja/en 最低限、他言語は既存fallback）。
  - **フル模試のタイマー自体は維持**（制限時間の計測・タイムアウト処理は従来どおり）。ただし**問題間の自動送りはしない**＝ユーザー操作で進む。
- 他画面（Quiz/Listening/WordDrill）は既に手動のため変更不要（確認のみ）。

## 5. my単語帳（C）

### 5.1 保存参照 saveRef の解決（大問別）
各問題に「保存対象」を1つ持たせる。`Question.saveRef?: SaveRef` を付与。
```ts
type SaveRef = { type: 'vocab' | 'grammar'; id: string };
```
| 大問 | saveRef の求め方 | 解決可否 |
|---|---|---|
| 漢字読み/表記/文脈規定/言い換え | `itemId` は `<vocabId>#daimon` → `{type:'vocab', id: vocabId}` | ほぼ全件 |
| 用法(usage) | bank stem 語 → 既存 `vocabIdForWord`/語→id 逆引きで vocab id。解決不能なら saveRef なし | 大半 |
| 文法形式/組み立て/文章の文法 | bank `pointId`（grammar.json id・2201/2413が解決）→ `{type:'grammar', id: pointId}` | 2201件 |
| JFT会話と表現/読解/聴解 | 明確な単一語がない → saveRef なし（ボタン非表示） | 対象外 |

- `questionForUnit`（daimon.ts）で saveRef を計算し `Question.saveRef` に載せる。解決不能な問題は `saveRef` を付けない＝**その問題ではボタン非表示**（既知の限界・§7に明記）。

### 5.2 保存（state）
- `AppState.myList?: SaveRef[]`（旧stateには無い→省略可・初期 `[]`）。
- `actions.addToMyList(ref)`: 同一 `type+id` は重複排除（追加済みなら no-op / トグルで削除も可）。
- storage は既存の JSON 永続化に自然に乗る（新フィールドなので `STATE_VERSION` 変更不要）。

### 5.3 UI
- **解答後**（正誤表示後、旧解説の位置）に「**＋my単語帳**」ボタン（`saveRef` がある時のみ）。既に登録済みなら「登録済み ✓」（トグルで解除可）。i18n: `mywords.add`/`mywords.added`。
- **単語タブ**（CardsScreen）に「**my単語帳**」カード（件数表示）。タップで一覧画面へ。
- **一覧画面**（新規 `MyWordsScreen`・RootStack modal）: 保存項目を vocab/grammar 別、または混在リストで表示。各行タップで既存の辞書詳細（KanjiDetail/Browse detail 等）へ。空なら空状態メッセージ。
- **復習**: 一覧上部に「復習する」＝**既存 FlashcardScreen を myList の id 集合で起動**（FlashcardScreen が任意 id リストを受け取れるよう route param を追加。受け取れない場合は最小の対応を実装）。

### 5.4 ナビゲーション
- `navigation/types.ts` に `MyWords: undefined`（RootStack）を追加。App.tsx に modal 登録。CardsScreen から `navigate('MyWords')`。

## 6. i18n（最小）
- 追加: `mywords.add`/`mywords.added`/`mywords.title`/`mywords.empty`/`mywords.review`/`mywords.card`、`mock.next`/`mock.see_result`。ja/en を実値、他9言語は暫定（既存fallbackで可・後日精査）。

## 7. 既知の限界（明記）
- saveRef が解決できない問題（用法の一部・pointId欠落212件の文法・JFT/読解/聴解）では「＋my単語帳」ボタンは出ない。全問ではなく「解決できた問題」で出る。ユーザーの「全大問に追加」は**解決可能な範囲で最大化**する方針。
- 解説データ（各バンク/読解/聴解の explain 系フィールド）は物理削除せず休眠放置。

## 8. テスト
- **saveRef 解決**（daimon.ts）: 語daimonの代表unit→vocab saveRef、文法daimon→grammar saveRef（pointIdあり）、pointId無し→saveRef無し、をユニットテスト。
- **addToMyList**（store/actions）: 追加・重複排除・トグル削除の冪等をテスト。
- **回帰**: 解説撤去後も BANK/questionForUnit が壊れない（既存 passRate/readiness/bankId テスト green）。`explainJa` 削除で参照切れが無い（tsc green）。
- 新規 `*.test.ts` は `package.json` の `test` に追加。全 tsc green・全テスト pass。

## 9. 実装順序（依存）
1. 解説撤去（§3・ファイル削除＋各画面の解説描画除去＋daimon.ts の explain 除去＋workflow/audioBase/テストの後始末）。
2. 自動送り廃止＋MockScreen 手動「次へ」（§4）。
3. saveRef 計算（daimon.ts §5.1）＋ state/actions（§5.2）＋テスト。
4. my単語帳 UI（解答後ボタン・単語タブカード・一覧画面・復習起動・ナビ・i18n §5.3-6）。
5. 全 tsc/テスト green を確認。
