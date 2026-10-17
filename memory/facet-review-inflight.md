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
   - ✅ **P5.5 面キー統合（設計§3.1完全準拠・ユーザー確定）**=facetMapに`KB_RESOLVE`追加＝用法(kb)→語IDのmean面(stem→vocabId・81%)、文法形式/組み立て(kb)→文法pointIdのgrammar面(82%/65%)。文章の文法はpointId列が無く設問ID単位のまま。生データ(items/テレメトリ)は不変＝面(要約)だけ束ねる。「どの問題を落としたか」はitemsに全残存。全数372緑・tsc0。
   - ✅ **P6 UI入口+旧mixed撤去**=Quiz `review:true`モード追加(selectReview→unitForPick→questionForUnit・空状態)。入口=ホーム(AICoachScreenアドバイス末尾CTA)＋書斎(WordsHub桜tap/CardsScreenトップ)。試験/辞書には置かない(ユーザー方針)。試験タブ全部混ぜ撤去。ラベル→「試験問題の復習」。unitForPickはバンクid集合判定=未解決用法も描ける。runtime smoke通過。全数372緑・tsc0。
   - 〜 **P7書き取り2ターン=本質達成済み**: 現行KakitoriScreenが各字で なぞり→見て→見ないで(お手本非表示リコール)を行い、見ないで完了で`recordKakitori(char,step3)`→P2配線でwrite面へ底上げ稼働。§6の残差は「5字一括なぞり→5字一括テスト」のバッチ化(順序入替)のみ=教育効果等価・回帰リスク大につき**任意保留**。
   - ✅ **予想得点の大問重み=確認済・是正不要**: 現状すでに`DAIMON_BLUEPRINT`(本番出題数)で重み付け(`ladderPassEntries`のn＝出題数、`expectedScore`のfrac=Σ(n·μ)/Σn)。均等割りではない(N3例:文脈規定11/言い換え5/用法5/文法形式13…)。読解聴解は`categoryPct`が設問数×難易度重み。コメントにも「旧均等を出題数重みへ是正済み」と明記。
   - ✅ **ラベル変更**: 統合復習「試験問題の復習」→「今日のおすすめ」(ja.jsonのみ・コミット済・次ビルドで反映)。

## 次の一手
= **P7 書き取り2ターン化**（KakitoriScreenを学習ターン(なぞり5字)→問題ターン(見ずに5字採点)へ。合格でwrite面底上げ=P2の`facetsForKakitori`合流が受ける・既存SRS間隔1/3/7/16/35は維持）。その後P8総検証。**別途、予想得点の大問重み(設問数シェア)是正**をユーザーと相談。**実機確認未**＝復習フロー(各入口→10問→採点→AfterStudyReward)を`/run`で通したい。

## ビルド
- **ビルド2654 both dispatch=run`30700408364`（2026-08-01・監視しない）**: P1-P6反映(統合復習=ホーム/書斎入口・試験全部混ぜ撤去)。iOS→TestFlight/Android→Play alpha(App C)。build番号=2000+654commit。build.ps1は`app/`前提で古い(app/は無くrootが実体)→`gh workflow run build-jlpt.yml`を直叩き。

## 走行run
- Explore（地図取得）=完了・結果は上記に畳んだ

## 直近コミット
- 37a71e1 synonym誤答の語形統一（push済・未ビルド）＝別件・完了
