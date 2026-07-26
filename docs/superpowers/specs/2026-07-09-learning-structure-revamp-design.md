# 設計: 学習構造リニューアル Spec A（タブ再編・模試整理・単語タブ自レベル化）

- 日付: 2026-07-09
- 対象アプリ: まいにちJLPT（safa-JLPT）
- 位置づけ: ユーザー要望5件のうち**構造再編3件（①②③）**。音声系（④漢字詳細の例単語音声・⑤聞き取り学習）は**別スペック B/C**で本Aの上に乗せる。

## 決定事項（ユーザー承認済）

| 論点 | 決定 |
|---|---|
| タブ構成 | **ホーム / 単語 / 学習 / 辞書 / 設定**（テストタブ廃止・辞書タブ復活） |
| ミニ模試 | **完全削除** |
| フル模試 | **学習タブへ移設**。配置＝**学習タブの一番下**にCTA（月1ロックは現行維持） |
| 単語タブ | 3カード維持→**タブ内リスト**（自レベル固定・コアデータのみ）→詳細。辞書モーダルへ飛ばない |
| 辞書タブ | **BrowseScreen をタブのルート**に（全レベル・レベル絞り・検索・3区分・拡張辞書＝全情報の参照場所） |
| 役割分担 | **単語タブ＝自レベルの学習** ／ **辞書タブ＝全レベル・全読みの参照** |
| 対応レベル外 | 単語タブ（リスト・詳細）には**自レベルの情報のみ**表示。全レベル/全読みは辞書タブに集約 |

---

## アーキテクチャ

現状タブ（`App.tsx:45` TABS）: ホーム / カード(=単語) / 学習 / テスト / 設定。`Browse`/`Kakitori`/`KanjiDetail` は RootStack のモーダル。

変更後:

```
MainTabs (material-top-tabs, bottom)
├── ホーム      HomeScreen           (変更なし)
├── 単語        WordsStack           (新スタック: WordsHome→WordList)
│     ├── WordsHome   = CardsScreen(改)  3カード・カバー率
│     └── WordList    = 自レベル固定リスト(区分別)
├── 学習        StudyScreen(改)      最下部に信頼幅+履歴+フル模試CTA
├── 辞書        BrowseScreen(改)     タブルート化(×撤去)・全レベル参照
└── 設定        ProfileScreen        (変更なし)

RootStack(モーダル・全タブから到達可): Quiz / Flashcard / Mock / Reading / Listening / Kakitori / KanjiDetail
```

- **単語タブのスタック化**: 単語タブを単一画面から `createNativeStackNavigator`（`WordsStack`）に変更し、タブ内で `WordsHome→WordList` を push する。モーダル `Browse` へは飛ばない。
- **辞書タブ**: 既存 `BrowseScreen` をタブのルートに。モーダル用の×閉じは**タブ時は非表示**（`useRoute().params` 無し＝タブ起動と判定）。
- **KanjiDetail はモーダルのまま**（RootStack）: 単語タブ（WordList）と辞書タブ（Browse）の**両方から**開くため。`scope: 'level' | 'all'` param を追加し、単語経由＝`'level'`（自レベル読み/例のみ）、辞書経由＝`'all'`（既定・全読み）。
- RootStack のモーダル `Browse` は**辞書タブへ統合**して撤去。`Kakitori`（書き取り）は引き続きモーダル（単語カードから起動）。

### 単位（責務）
- `WordsStack`（App.tsx内）: 単語タブのタブ内遷移。
- `CardsScreen`（改）: 3カード＋カバー率。カード→`WordList{ kubun }` を**push**（従来は `Browse` モーダルへ nav していた箇所を差し替え）。
- `WordList`（新規 `src/screens/WordListScreen.tsx`）: 自レベル固定の区分リスト。行=語＋読み＋タップで詳細。**Browseの表示ロジックを流用**するが、レベル固定・検索/レベルチップ・拡張辞書なし・×なしの学習特化版。
- `BrowseScreen`（改）: 辞書タブルート。全レベル・検索・チップ・拡張辞書あり。タブ時×非表示。
- `StudyScreen`（改）: 最下部にフル模試CTA。
- 削除: `TestScreen`（タブから外し、ファイル削除）。`MockScreen` のミニ模試分岐削除。

---

## ① 模試の整理

### ミニ模試 削除
- `App.tsx` TABS から **テスト**エントリ削除（TestScreen import/登録も削除）。`src/screens/TestScreen.tsx` 削除。
- **ミニの入口を断つ**: ミニ模試は `nav.navigate('Mock')`（full無指定＝false）でのみ起動していた。TestScreen 削除でこの唯一の入口が消える。**MockScreen 内部の出題ビルダー（`buildExam`/`blueprintCounts`/`daimonCounts` の full 分岐）は変更しない**（full=true でのみ呼ばれるようになり、mini(÷3)経路は到達不能になるが、出題ロジックに手を入れるリスクを避ける）。`mock.mini_exam` 文言は到達しないが残置可（YAGNI・削除は任意）。
- i18n: `test.mini_title/mini_time/mini_note` を ja/en から削除（学習タブへ移す模試ブロックはミニを含まないため）。既存の `test.full_*`/`test.jft_*`/`test.band_*`/`test.history_*`/`test.locked_*`/`test.start_btn` は**学習タブで流用するため残す**。`test.title/sub/foot/tab` は不要になれば削除可（実装時に他参照が無いか grep）。
- `navigation/types.ts`: `Mock` の `full` は残す（学習タブから常に `full:true` 指定）。`Test` 専用ルートは無い（TestはTab.Screenのみ）ので types 変更は `Browse` 撤去・`KanjiDetail` に `scope` 追加・`Words`/`WordList` 追加のみ。

### フル模試＋信頼幅＋履歴 → 学習タブ（最下部）
テストタブ廃止に伴い、TestScreen が持つ**模試ブロック一式**（①信頼幅 `±band`、②模試履歴グラフ、③フル模試CTA）を **StudyScreen の `ScrollView` 末尾へまとめて移設**する（ミニ模試だけ捨てる）。
- **信頼幅カード**（`readinessFor(state,now).band` を `±N` 表示・`band_hint_*`）を移設。
- **模試履歴カード**（`state.mockHistory` の直近12件バー・最新pct・平均）を移設（`hist.length>0` の時だけ）。
- **フル模試CTA**（月1ロック）:
  - JLPT時＝フル模試カード（`test.full_*`）、JFT時＝jft模試カード（`test.jft_*`）の**現行分岐をそのまま移植**（`isJft = settings.targetExam==='jft'`）。可なら `nav.navigate('Mock', { full:true })`、ロック時は次回可能日表示。
  - **ミニ模試カード（`test.mini_*`・`nav('Mock')` 無印）は削除**。
  - **月1ロック判定を純関数へ切り出す**: `src/mock/fullMockLock.ts` の `fullMockLocked(history, now): { locked: boolean; next: { y:number; m:number; d:number } }`。TestScreen の `thisMonth/lastFull/fullLocked/nextAvail` ロジック（`state.mockHistory` の各要素 `{ day, pct, full }`・`dayStr`）を移植しテスト可能に。StudyScreen はこの純関数を使う。
- 文言は既存 `test.*` キーを流用（`test.mini_*` のみ削除）。新規キーは増やさない（YAGNI）。
- `Mock` はモーダルのまま（学習タブから起動）。`nav.navigate('Mock', { full:true })`。

---

## ② 辞書タブ（BrowseScreen のタブ化）

- `App.tsx` TABS に **辞書**（`BrowseScreen`・icon `library`/`library-outline`・label `dict.tab`）を追加（テスト枠の位置）。
- `BrowseScreen` を**タブ起動でも動く**ように:
  - ×閉じ（`nav.goBack()`）は**タブ時は非表示**。判定＝`useRoute().params` が無い（タブルート）なら非表示、モーダル起動時のみ表示。安全側に `canGoBack()` でも可。
  - それ以外（全レベル・検索・レベルチップ・3区分・拡張辞書）は現状維持＝全情報の参照場所。
- 既存でモーダル `Browse` を開いていた箇所（CardsScreen等）は単語タブ内遷移へ差し替えるため、モーダル `Browse` 登録は撤去。**もし他からモーダルBrowseを使う箇所が残る場合は洗い出し**、辞書タブへ `navigation.navigate('辞書')` に置換 or モーダル登録を残す（実装時にgrepで確認）。

---

## ③ 単語タブ（自レベル限定の学習ビュー）

### 単語ホーム（CardsScreen 改）
- 現行の3カード（漢字/語彙/文法・カバー率バッジ・漢字カードの書き取り入口）は維持。
- カード本体タップの遷移先を **モーダル`Browse` → タブ内`WordList{ kubun }`（push）** に差し替え。

### WordList＝BrowseScreen を `mode` param で再利用（新規ファイルを作らない・DRY）
Browse の行レンダリング（vocab のルビ/例文・kanji の音訓・grammar）は複雑なので**複製せず、BrowseScreen に `mode` を足して兼用**する。
- `BrowseScreen` に param `mode?: 'dict' | 'study'`（既定 `'dict'`）を追加。
- **`mode==='study'`（単語タブから push）**:
  - レベル＝`settings.level` に**固定**（レベルチップ非表示・検索バー非表示・×非表示）。
  - データ＝コア（`KANJI`/`VOCAB`/`GRAMMAR`）の当該レベルのみ。**拡張辞書（`DICT_EXT_*`）は混ぜない**。
  - `kubun` は param 指定（カードから `kanji`/`vocab`/`grammar`）。区分チップも隠す（単一区分固定）。
  - 漢字行タップ→`KanjiDetail{ char, scope:'level' }`（モーダル）。語彙/文法は行内表示で完結（タップ遷移なし）。
  - ヘッダに区分名＋戻る（タブ内 `nav.goBack()`）。
- **`mode==='dict'`（辞書タブ・既定）**: 現状維持（全レベル・チップ・検索・拡張辞書・区分切替）。×はタブルート時のみ非表示。
- 単語タブのスタックには `WordsHome`（Cards）と `WordList`（＝BrowseScreen・`mode:'study'`）を登録。辞書タブは同じ BrowseScreen を別名でルート登録（`mode:'dict'`）。

### 詳細（自レベルスコープ）
- 漢字詳細: 既存 `KanjiDetailScreen` を**単語タブ内スタックへも登録**し、単語タブ経由では**自レベルの読み/例のみ**表示するモードにする（`route.params` に `scope: 'level'` を渡す。既定＝全読み＝辞書タブ経由）。
- 語彙詳細: 語彙は行内で読み・意味・例が出るなら**専用詳細は作らない（YAGNI）**。必要になったら B/C で追加。

### 共有ロジック（テスト対象）
- `src/words/levelList.ts`: `levelListFor(kubun, level)` → コアデータの当該レベル配列（安定順）。純関数・node テスト。
- 対応レベル外を出さないことをテストで担保。

---

## データ / 既存資産の確認（実装時に実施）

- モーダル `Browse` の全呼び出し箇所を grep（`navigate('Browse'`）→ 単語タブ内遷移 or 辞書タブへ移行。
- フル模試ロックの履歴ソース（`state.mock` 等）を確認し純関数へ移植。
- `KanjiDetailScreen` の現行 params と読み表示ロジックを確認し `scope` 分岐を追加。

## テスト / 検証

- 純関数: `levelListFor`（自レベルのみ・区分別・件数）／`fullMockLocked`（同月ロック・翌月解除）を node テスト（`app/package.json` test に登録）。
- tsc 緑・既存テスト全緑。
- 実機: タブが ホーム/単語/学習/辞書/設定 になっているか・ミニ模試消滅・学習タブ最下部にフル模試（月1ロック）・単語タブが自レベルのリストをタブ内表示・辞書タブが全レベル参照・単語タブ詳細が自レベルのみ。

## リスク / 留意

- **タブのスタック化**で単語タブ内の戻る挙動（Androidバックキー）が自然か要確認。material-top-tabs のタブ内に native-stack をネストする構成。
- モーダル`Browse`撤去で参照切れが出ないよう全呼び出しを洗い出す。
- フル模試ロックの状態ソースを取り違えないこと（実測してから移植）。
- 既存の学習/評価指標・カバー率計算には手を入れない（表示位置の移動のみ）。

## スコープ外（別スペック）

- **Spec B**: ④漢字詳細カードの例単語を音声再生（語彙mp3再利用・例語→vocab id マッピング＋TTSフォールバック）。
- **Spec C**: ⑤語彙カード・漢字カードからの「漢字・語彙の聞き取り学習」新モード（vocab mp3を使う聴解ドリル）。
- 語彙専用詳細画面（必要になれば B/C で）。
