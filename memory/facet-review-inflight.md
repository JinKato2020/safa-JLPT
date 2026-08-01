# inflight: 面別マスタリー統合復習（最重要ミッション）

## 正本
- 設計書=`docs/superpowers/specs/2026-08-01-unified-facet-review-design.md`（完成）
- 実装プラン=未作成（superpowers流: spec→plan→実装。今ここ=plan作成前の現状把握）

## 目的（1行）
単語×面(read/write/mean/listen/grammar)のマスタリーに苦手度を一本化し、忘却曲線駆動の統合復習「試験問題の復習」を中核に据える。UIの「今日のおすすめ＝復習」を各タブ入口に。

## 進捗
1. ✅ 現状コード地図取得（Explore・結論のみ）。要点=苦手度の実体は`state.items`1スライス＋`state.kakitori`／`ladder/mastery.ts`は未配線デッド・流用不可／予想得点接点=selectors.ts `unitMasteryWithTransfer`/`ladderPassEntries`/`readinessFor`／移行前例=storage.loadState冪等書換。
2. ✅ 実装プラン作成=`docs/superpowers/plans/2026-08-01-unified-facet-review.md`（8フェーズ・§12未確定を確定＝面はengine ItemState再利用/復習12問・同面3連続回避/移行は認識面複製・補強p×0.85）。→ユーザー承認待ち
3. 実装（プラン承認済・復習=10問）：
   - ✅ **P1**（純ロジック）=`facetMap.ts`＋`facetMastery.ts`＋test16。コミット`18bce99`。
   - ✅ **P2**（状態合流）=state.tsに`mastery?`/`masteryMigrated?`（INITIAL=`{}`/true）＋store.tsx 3case合流（QUIZ→practice/MOCK→mock初見のみ/KAKITORI step3合格→write補強）＋test6。全数352緑・tsc0。
   - ✅ **P3 移行**=`migrateMastery.ts`（`buildMasteryFromLegacy`＝items/kakitori→面・認識面複製/補強p×weight/認識面を下げない/冪等）＋`storage.loadState`配線＋test8。全数360緑・tsc0。
   - ✅ **P4 復習エンジン**=`selectReview.ts`(既習due弱い順・非due補充・size10・同面3連続回避・新出除外)＋`reviewQuestion.ts`(面→unit逆写像→questionForUnit。unitForPick: kb-はそのまま/vocab read→#kanji_read・write→#orthography・mean→#context|#synonym/grammar id→#grammar_form。listen・漢字char・passageは当面null=読み飛ばし)＋test7。全数367緑・tsc0。
   - ✅ **P5 予想得点の面参照化**=`selectors.ts unitMasteryWithTransfer`を面優先(facetsForUnit→facetEffectiveP)、面未構築時のみ従来items＋vProduce持ち込みへフォールバック。context/synonym=同mean面で一貫。回帰(ladderWeighting/wordTabTransfer)は面未設定でフォールバック→緑。新test3。全数370緑・tsc0。コミット予定。
   - ⬜ **P6 UI入口+旧mixed撤去（見た目が変わる=ユーザー確認ポイント）**→P7書き取り2ターン→P8検証

## 次の一手
= **★ここでユーザーに一度報告（P1-P5=内部完了・push済・未ビルド・見た目不変）**。承認後P6着手：ホーム(HomeCoach横)/書斎(StudyHome)/辞書(私の単語帳)に「試験問題の復習」入口＝新route or Quiz mode:'review'（selectReview→reviewQuestion→null読み飛ばしで10問揃え→既存AfterStudyReward）。ラベル`cards.reco`/`study.reco`「今日のオススメ」→「試験問題の復習」(ja.jsonのみ)。旧`category:'all'`(QuizScreen buildAllQueue)＋書斎`WordDrill mixed`(CardsScreen)撤去。参照stock.ts整理。

## 走行run
- Explore（地図取得）=完了・結果は上記に畳んだ

## 直近コミット
- 37a71e1 synonym誤答の語形統一（push済・未ビルド）＝別件・完了
