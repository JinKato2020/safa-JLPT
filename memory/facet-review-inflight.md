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
   - ⬜ P3移行→P4復習エンジン→P5予想得点配線→P6 UI入口+旧mixed撤去→P7書き取り2ターン→P8検証

## 次の一手
= **P3 移行**（`src/review/migrateMastery.ts`＝`state.items`全キー＋`state.kakitori`を`facetsForUnit`/`facetsForKakitori`で面へ寄せ`mastery`構築・`masteryMigrated`ガードで一度きり＋冪等。認識面は複製・補強系はp×0.85・evidence大優先。`storage.loadState`の既存冪等移行の後段に配線）。

## 走行run
- Explore（地図取得）=完了・結果は上記に畳んだ

## 直近コミット
- 37a71e1 synonym誤答の語形統一（push済・未ビルド）＝別件・完了
