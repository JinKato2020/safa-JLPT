# 面別マスタリー統合復習 実装プラン（2026-08-01）

> **For agentic workers:** 各タスクは `- [ ]` で追跡。純ロジックは `node --import tsx --test` でテスト先行。新規 `*.test.ts` は必ず `package.json` の `test` 引数へ追記（自動検出されない）。`npm run tsc` が通ること。

**Goal:** 単語・字ごとの「面別マスタリー」に苦手度を一本化し、忘却曲線で駆動する統合復習「試験問題の復習」を各タブの入口に据える。予想得点も面別マスタリー参照へ一貫させる。設計書＝`docs/superpowers/specs/2026-08-01-unified-facet-review-design.md`。

**Architecture:** 既存 `src/engine/engine.ts` の `ItemState`/`effectiveP`/`recordQuiz`/`recordMock` を**面単位で再利用**（新SRS数学は作らない）。新スライス `mastery[itemId][facet]=ItemState` を追加。既存の各記録経路（試験QUIZ/MOCK・書斎WordDrill・聞き取り・私の単語帳・書き取り）は**従来キーの記録を維持しつつ、対応する面へも合流**（additive＝既存テスト非破壊）。予想得点は `selectors.ts` の参照を面へ差し替え。React非依存の純ロジック（面写像・選抜・移行）は `src/review/` に新設しテスト可能に保つ。

**未確定点の確定（設計§12）:**
- **面ItemStateの共有** = engine の関数をそのまま面 state に適用（`recordQuiz`/`recordMock`/`effectiveP`）。選抜は `effectiveP` 昇順＋`dueAt<=now`（buildQueue の思想を面に適用、実体は新 `selectReview`）。
- **復習1回の出題数** = **10問**（私の単語帳復習 REVIEW_SIZE と同サイズ・ユーザー確定2026-08-01）。due が10超なら effectiveP 昇順で上位10。**同一面が3連続しないよう並べ替え**（活動を交互に）。due が少なければ due を全部→不足分は「一度触れた面のうち保持率が低い順」で補充（新出は出さない）。
- **移行の重み** = 認識面（read/write/mean/listen/grammar への大問キー）は **ItemState をそのまま複製**。補強系（`#produce`/`#gbuild`/`#gmeaning`/`kakitori`）は **p を 0.85 掛けで控えめに**反映し、同一面に既存の認識由来 state があれば **evidence の大きい方を優先**（補強で認識面を下げない）。

## Global Constraints
- 面 = `read | write | mean | listen | grammar`（設計§3.1）。既存 `src/ladder/mastery.ts` は**未配線のデッドコードで面定義がズレる**ため流用しない（本プランでは触らない）。
- ユニットid→(itemId, facet) の写像は**一箇所**（`src/review/facetMap.ts`）に集約。大問キーの一覧は `daimon.ts` の `MOJI_DAIMON`/`BUNPOU_DAIMON` と一致させる。
- 予想得点の算式そのものは変えない（`ladder/passRate.ts` は不変・参照元だけ面へ）。
- 移行は `state.masteryMigrated`（bool）ガードで一度きり＋再実行しても冪等。既存 `storage.loadState` の冪等移行の隣に置く。
- 永続キーは既存 `'safa-jlpt:state:v1'` を共用。`AppState.mastery?` は optional（旧state互換）。

---

## Phase 1 — 面写像と面マスタリー核（純ロジック）

**Files:** Create `src/review/facetMap.ts` + `.test.ts`, `src/review/facetMastery.ts` + `.test.ts`

**facetMap.ts（写像・純関数）:**
- `type Facet = 'read'|'write'|'mean'|'listen'|'grammar'`
- `interface FacetTarget { itemId: string; facet: Facet; weight?: number }` weight=補強の控えめ係数（既定1）
- `function facetsForUnit(unit: string): FacetTarget[]` — 大問/ドリルのユニットid → 面。写像表:
  - `#kanji_read` / `#reading` → `read`
  - `#orthography` → `write`
  - `#context` / `#synonym` / `#usage` → `mean`
  - `#grammar_form` / `#order` / `#passage_grammar`（＋バンク純id kb- で該当する文法大問）→ `grammar`
  - `#produce` → `mean`(w=0.85) ＋副 `read`(w=0.6)
  - `#gbuild` / `#gmeaning` → `grammar`(w=0.85)
  - `#`無しの素id（聞き取り出題）→ `listen`（呼び出し側が listen 文脈と分かる時のみ。曖昧回避のため聞き取りは専用の `listenFacet(itemId)` を用意）
- `function facetsForKakitori(char: string): FacetTarget[]` → `write`(w=1) ＋副 `read`(w=0.6)
- 対応不明は `[]`（初期化＝面を作らない）。

**facetMastery.ts（面 state の CRUD・engine 再利用）:**
- `type MasterySlice = Record<string, Partial<Record<Facet, ItemState>>>`
- `function getFacet(m, itemId, facet): ItemState | undefined`
- `function recordFacet(m, targets: FacetTarget[], correct, signal:'practice'|'mock', now): MasterySlice` — 各 target に engine の `recordQuiz`/`recordMock` を適用。weight<1 の補強は「正解時のみ・p 上げ幅を weight 掛け」「不正解時は減点しない」（設計§3.3 産出は失敗で認識面を下げない）。
- `function facetEffectiveP(m, itemId, facet, now): number | null`（無ければ null）

**Tests:** 写像網羅（各大問→正しい面）・補強は正解のみ底上げ/失敗で下げない・engine 再利用で dueAt/reps が進む・未知idは空。

- [x] facetMap.ts + テスト
- [x] facetMastery.ts + テスト
- [x] package.json test 引数へ2ファイル追記・tsc緑（全数346緑）

## Phase 2 — 状態への面スライス追加＋記録経路の合流

**Files:** `src/store/state.ts`, `src/store/store.tsx`

- `AppState` に `mastery?: MasterySlice` と `masteryMigrated?: boolean` を追加（INITIAL_STATE は `{}`/false）。
- reducer の既存 case に面反映を**合流**（従来の `state.items[unit]` 記録は残す＝additive）:
  - `QUIZ_ANSWER`（試験タブ大問別練習）→ `recordFacet(facetsForUnit(unit), correct,'practice')`
  - `MOCK_ANSWER`（模試）→ `recordFacet(..., 'mock')`
  - `KAKITORI_PROGRESS`（合格時）→ `recordFacet(facetsForKakitori(char), passed,'practice')`
  - 私の単語帳復習・聞き取りの記録 case → 対応面へ（listen/read/mean）
- action は既存 `useAppActions` の各関数内で合流（新 public action は増やさない）。

**Tests:** reducer 単体（各 answer が対応面を更新・書き取り合格で write が上がる・従来 `state.items` も従来通り）。

- [x] state.ts 拡張（`mastery?`/`masteryMigrated?`・INITIAL_STATEは`{}`/true）
- [x] store.tsx QUIZ_ANSWER/MOCK_ANSWER/KAKITORI_PROGRESS 合流 + テスト6件・tsc緑（全数352）

## Phase 3 — 一度きり冪等マイグレーション（旧キー→面）

**Files:** `src/review/migrateMastery.ts` + `.test.ts`, `src/store/storage.ts`（loadState 内で呼ぶ）

- `function migrateMastery(state): AppState` — `masteryMigrated` が真なら無変更。偽なら `state.items` の全キーと `state.kakitori` を `facetsForUnit`/`facetsForKakitori` で面へ寄せ、`mastery` を構築し `masteryMigrated=true`。
- 認識面は ItemState 複製、補強系は p×0.85＋evidence 大優先（Global Constraints）。曖昧キーはスキップ。
- 冪等: 再実行しても（フラグ真で）同一。フラグを外して再実行しても同じ mastery を再生成（構造的冪等）。

**Tests:** 旧キー集合→期待面・補強が認識面を上書きしない・二度実行で不変・フラグの効き。

- [ ] migrateMastery.ts + テスト
- [ ] storage.loadState へ配線（既存冪等移行の後段）・テスト・tsc緑

## Phase 4 — 統合復習エンジン「試験問題の復習」

**Files:** `src/review/selectReview.ts` + `.test.ts`, `src/review/reviewQuestion.ts` + `.test.ts`

- `interface ReviewPick { itemId: string; facet: Facet; unit: string }`
- `function selectReview(mastery, now, size=10, rng): ReviewPick[]` — **既習(面 state 有)かつ dueAt<=now** を effectiveP 昇順、size 上限、**同一面3連続回避**の並べ替え。due 不足時は「面 state 有で保持率低い順」で補充。新出（面 state 無）は出さない。各 pick の `unit` は面→代表ユニットへ逆写像（`reviewQuestion` が使う）。
- `function reviewQuestion(pick, rng): Question | null` — 面に応じて既存出題を呼ぶ:
  - `read` → `questionForUnit(<vid>#kanji_read)` 無ければ `makeQuestion(item, VOCAB, ['reading'])`
  - `write` → `questionForUnit(<vid>#orthography)`（漢字は将来 書き取り出題も可＝Phase7と連携）
  - `mean` → `questionForUnit` の context/synonym/usage のいずれか（rngで）
  - `listen` → 既存 ListeningQuiz 形式（`src/listening/` の単問生成を利用）
  - `grammar` → grammar_form/order/passage 系（passage はセット形式のため単問化できる大問のみ）
- 出題後は既存の統一テンプレ（貝・単語帳チェック＝AfterStudyReward）を流用。

**Tests:** 既習の苦手のみ・未習は出ない・忘却曲線順・同一面3連続なし・面→出題形式の対応・size上限。

- [ ] selectReview.ts + テスト
- [ ] reviewQuestion.ts + テスト・tsc緑

## Phase 5 — 予想得点の面参照化（配線差し替え）

**Files:** `src/store/selectors.ts`

- `unitMasteryWithTransfer(state, now, unit)` を **面マスタリー参照**へ: 大問→面を `facetsForUnit` で解決し `facetEffectiveP` を返す（従来の `state.items[unit]`＋WORDTAB_TRANSFER フォールバックは移行期の保険として残すが、mastery 有を優先）。
- `ladderPassEntries`/`readinessFor`/`expectedScoreFor` は上記を経由するso自動追従。算式（passRate.ts）は不変。

**Tests:** 既存 `store/ladderWeighting.test.ts`・`store/wordTabTransfer.test.ts` を面参照でも緑に更新（回帰線）。面が上がると予想得点が上がる単調性。

- [ ] selectors.ts 差し替え + テスト更新・tsc緑

## Phase 6 — UI入口＋ラベル改称（撤去含む）

**Files:** `src/screens/HomeScreen.tsx`(HomeCoach周辺), `StudyHomeScreen.tsx`, `CardsScreen.tsx`, `DictHomeScreen.tsx`, `WordsHubScreen.tsx`, `QuizScreen.tsx`, `src/navigation/types.ts`, `src/i18n/ja.json`

- 新ルート `Review`（面駆動）を追加、または既存 Quiz を `mode:'review'` で流用。復習ボタンを **ホーム(AIコーチ横)・書斎(目立つ)・辞書(私の単語帳の復習=面駆動)** に設置。
- ラベル `cards.reco`/`study.reco`「今日のオススメ」→「**試験問題の復習**」に改称（**ja.json のみ**＝他言語は自動フォールバック。i18n厳命遵守）。
- 撤去/吸収: 試験タブ `category:'all'` 全部混ぜ（StudyHome StartCard→QuizScreen `buildAllQueue`）を削除、書斎 `WordDrill kind:'mixed'`（CardsScreen reco）を統合復習へ吸収。個別フォーカス練習（聞き取り/書き取り/産出）は任意として残す。

**Tests:** ナビ型のtsc・スモーク（起動して各入口が復習へ遷移＝`/run` で実機確認は最後にまとめて）。

- [ ] 入口3箇所 + ラベル改称
- [ ] 旧mixed/全部混ぜ撤去・参照(stock.ts等)整理・tsc緑/test緑

## Phase 7 — 書き取り新フロー（学習ターン/問題ターン分離）

**Files:** `src/screens/KakitoriScreen.tsx`, `src/kakitori/`（必要なら queue/progress 調整）

- 学習ターン=5字を「なぞり書き」トレース → 問題ターン=お手本を**見ずに**5字書き取り採点 → 合格で `write`(副 `read`) 面を底上げ（Phase2の合流が受ける）。
- 書き取り自身の SRS 間隔 1/3/7/16/35 日は維持（`kakitori/srs.ts`）。面へは合否のみ反映。

**Tests:** 学習/問題ターンの分離・合格で write 面が上がる（Phase2テストと連携）。

- [ ] KakitoriScreen 2ターン化 + テスト・tsc緑

## Phase 8 — 総仕上げ・検証

- [ ] `npm test`（全数）緑・`npm run tsc` 緑
- [ ] 実機/エミュで各入口→復習→採点→貝/単語帳チェックまで通し（`/run`）
- [ ] 予想得点が面から再計算されることを実データで確認
- [ ] handoff.md 更新・未ビルドで停止（ビルドはユーザー指示時のみ）

## スコープ外（YAGNI・設計§11）
- 読解・聴解（長文）の復習統合／新ゲーミフィケーション／予想得点算式変更／AIコーチ文言高度化。
