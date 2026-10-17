# 聴解「課題理解(kadai)」本文対訳(en/ne)付与 — inflight

## 目的（ユーザー確定 2026-09-02）
翻訳プロジェクト③聴解フェーズ開始。まず**課題理解(kadai)**から。
- 範囲（ユーザー選択A）= **台本(script)＋設問(q)＋選択肢(choices) 全部**を en/ne 化。
- 表示 = **回答後のみ**（聴解なので答える前に台本訳が見えたら試験にならない）。
- 正本フロー = `memory/trans-daimon-inflight.md`「★次の大問の進め方」。

## 対象（一次情報）
- files: `content/problems/choukai/{,mock/}kadai_N{3,4,5}.json` 計6ファイル。
- items=660（通常150×3＋模試60/80/70）。1item=1設問(questions[0])。選択肢4×660=2640。
- 文字数: 台本340k＋設問21k＋選択肢48k = **約409k字**。i18n は全件空。
- 概算費用 ≈ **¥150〜250**（Gemini2.5Flash・en+ne・出力$2.50/Mが主）。¥1000未満。

## スクリプト実装（tools/trans_daimon.py）
- `kadai_texts(it)`: script(ruby除去・改行→` ⏎ `マーカ退避)＋q＋c0..c3 を返す struct。
- DAIMON['kadai'] = choukai/**/kadai_*.json・kind=struct。
- `_shape` を script/q パススルー対応＋script の ⏎→改行 復元に拡張。
- cache = `scratchpad/pg/trans_kadai_cache.json`。

## 進め方（この節から再開）
1. [x] dry-run(¥127見積) → --apply **走行中(bg id=byaidpzhz)**。再開可(cache=trans_kadai_cache.json)。完了後 `--write`。
   - ※Geminiは台本の改行(話者ターン)を実際の \n で保持(⏎マーカ不要と判明)→writerは \n 分割で body 行配列化。
2. [x] **表示結線 完成(tsc緑)**: 読解と同型に統一で表示インフラ再利用。
   - rehydrate.ts listeningMap: 台本 i18n.body→PASSAGE_TRANS / 設問 i18n.q,choices→Q_TRANS(readingMapと同型)。
   - ListeningScreen.tsx: useNe/scriptTrans/qtr/hasTrans・回答後(allDone/reveal)に台本訳(scriptブロック内)・設問訳・選択肢訳(元順で対応)・「訳を見る」トグル(passage.showTrans流用=新i18nキー無し)。
   - trans_daimon.py: do_write_kadai(item.i18n.body=台本行配列 / questions[0].i18n=q,choices・jaは温存)。
3. [x] **完了(未commit/未配信)**: apply 3960/3960失敗0・実測**¥170**(Gemini2.5Flash) → `--write` 660件投入(欠0・languages=en/ne) → rebuild.ts で manifest+barrel再生成(113files) → 番人更新(passageTransNe に聴解kadai許可＋完全性テスト新設 / trans_staleness item_source に script フォールバック・TS番人も同期・種再生成でkadai3960をbaselineへ・既知借金3件は保持) → **関連49テスト緑**(rehydrate/validate/manifest/passageTransNe/transStaleness/listeningMock/explainTransPolicy/listeningQuiz/parity)・tsc緑 → ④Excel「⑥翻訳状況」行54 en/ne=100%。
4. [x] **配信済み（2026-09-03）**: content(kadai_*.json訳)=commit 379910c2 で push 済み(OTA)。表示コード(ListeningScreen/rehydrate/番人)＋音声不良20件の作り直し=**ビルド v1.1.31(2898) dispatch 済み**（commit 1c8722f0・iOS+Android・-NoWatch）。これで課題理解の対訳が実機で出る（OTAデータのdormant解消）。※ビルド結果は監視しない運用。

## ★ポイント理解(point)＝準備完了（2026-09-03・次セッションはここから）
- **コード実装済**: `tools/trans_daimon.py` に `'point'` 追加（kadai_texts流用）＋ `do_write_kadai(daimon)` 汎用化＋ do_write 分岐に point。表示結線は不要(listeningMap汎用)。
- **dry-run済**: point=6ファイル/640問/3840文/242,739字 → **概算 $0.80≈¥124**（Gemini2.5Flash・en/ne）。¥1000未満。
- **[x] 完了（2026-09-03・point・未commit/未配信）**:
  1. [x] `--apply` bg id=`bz4oe8glu` → done=3840 failed=0・実測 **¥167**（Gemini2.5Flash・in173,914/out410,046tok）。
  2. [x] `--write` 640件投入・欠0（i18n.body/q/choices・jaは温存）。
  3. [x] `rebuild.ts` で _manifest+barrel 再生成（113files）。
  4. [x] 番人: passageTransNe.test.ts を kadai+point 兼用に拡張（scriptTransSubs Set）／transStaleness 種再生成でbaseline 14466→18306（+3840）・knownStale=3のまま（既知借金dokkai3件保持）→ **関連テスト緑**（passageTransNe/transStaleness 8・rehydrate/listeningMock/manifest 18）・tsc緑。
  5. [x] Excel「⑥翻訳状況」行55 ポイント理解 → en/ne=100%・注記/日付更新。
  6. [ ] **配信=ユーザー明示指示待ち**（content=OTA push＋番人/baseline変更は次ビルドに同梱でよい・表示コードは課題理解で既出のため基本ビルド不要）。
- その後の大問順: gaiyou → hatsuwa → sokuji。※gaiyou/hatsuwa/sokuji は audioChoices=True（選択肢は音声・画面は番号）＝訳す対象が script/q のみで choices は画面非表示 → point完了後に再設計（kadai_texts の choices 抽出をどうするか要判断）。

## ★概要理解(gaiyou)＝走行中（2026-09-03）
- **重要な訂正**: 旧メモの「gaiyou/hatsuwa/sokuji は choices 画面非表示ゆえ訳す対象は script/q のみ」は**誤り**。ListeningScreen:334 で audioChoices も**回答後は choices テキスト＋訳を表示**（回答前だけ番号）。よって訳す対象は kadai/point と同じ **script＋q＋choices**・表示コードも既出流用（変更不要）。
- **コード**: DAIMON に 'gaiyou'（kadai_texts流用）＋ do_write 分岐に gaiyou 追加＋ passageTransNe scriptTransSubs に gaiyou。gaiyou は**N3のみ**（gaiyou_N3.json 80＋mock/gaiyou_N3.json 30＝110問）。
- **[x] 完了（2026-09-03・未commit/未配信）**: apply bg=`bwbn1xih8` done=660/660・実測**¥26** → write 110件欠0 → rebuild(113files) → staleness種再生成 baseline 18306→18966(+660)・knownStale=3維持 → テスト26緑・tsc緑 → Excel行56 en/ne=100%。**配信=ユーザー指示待ち**（表示コード既出・番人/baseline変更は次ビルド同梱でよい）。
- ※発話(hatsuwa)/即時(sokuji)も同様に choices は回答後表示されるはず（着手時に ListeningScreen で最終確認）。

## ★発話表現(hatsuwa)＝走行中（2026-09-03）
- **一次情報確認済**: hatsuwa全740問(通常N3/N4/N5=200×3＝600＋mock N3=40/N4=50/N5=50＝140)。**q は全て空**・choices=3固定・script(場面文)有。audioChoices=True。ListeningScreen: isAudioChoices経路(L271)→回答後 script訳(scriptBlock)＋選択肢訳(L334)を表示ゆえ**表示コード変更不要**。
- **コード変更(3点・実装済)**:
  1. `tools/trans_daimon.py`: DAIMON に 'hatsuwa'(kadai_texts流用)＋do_write分岐に hatsuwa＋`do_write_kadai` を**q空でも書ける**よう改修(has_q判定・q無しは questions[0].i18n に choices のみ)。
  2. `src/data/content/rehydrate.ts` listeningMap: Q_TRANS の取り込みを `q OR choices` に緩和(q空のhatsuwaでも選択肢訳を Q_TRANS へ)。
  3. `src/data/exam/passageTransNe.test.ts`: scriptTransSubs に 'hatsuwa' 追加。
- **[x] 完了（2026-09-03・未commit/未配信）**: apply bg=`b2k4drpfn` done=2960/2960 fail=0・**実測¥59** → write 740件欠0（qは空ゆえ questions[0].i18n は choices のみ・body=場面文訳） → rebuild(113files) → staleness種再生成（git-stale en=2/ne=1＝knownStale=3維持・新規借金なし） → テスト33緑(passageTransNe/transStaleness/rehydrate/listeningMock/pool/manifest)・tsc緑 → Excel行57 en/ne=100%＋行61脚注更新（残=即時応答のみ）。**配信=ユーザー指示待ち**。
- 次＝即時応答(sokuji)。※「返し」1文の性質ゆえ訳す妥当性を着手時に確認（handoff注記どおり）。

## ★即時応答(sokuji)＝走行中（2026-09-03・ユーザー「即も訳す」で着手）
- **一次情報確認済**: sokuji全950問(6ファイル)。**hatsuwaと完全同構造**＝q全空・choices=3固定・script(場面文=最初の一言)有・audioChoices=True。ゆえに do_write_kadai(q空対応済)/rehydrate(Q_TRANS `q OR choices`済)は流用のみ。
- **コード変更(3点・実装済)**: trans_daimon.py DAIMONに'sokuji'＋do_write分岐に'sokuji'／passageTransNe scriptTransSubsに'sokuji'。
- **[x] 完了（2026-09-03・未commit/未配信）**: apply bg=`br2x2wnnp` done=3800/3800 fail=0・**実測¥71** → write 950件欠0 → rebuild(113files) → staleness種再生成（git-stale en=2/ne=1＝knownStale=3維持・新規借金なし） → テスト39緑・tsc緑 → Excel行58 en/ne=100%（信号色フックが自動で緑）＋行61脚注「全5大問完了」。**配信=ユーザー指示待ち**。

## ✅③聴解の対訳＝全5大問 完了（2026-09-03）
課題理解(kadai)✅ / ポイント理解(point)✅ / 概要理解(gaiyou)✅ / 発話表現(hatsuwa)✅ / 即時応答(sokuji)✅。**全て未commit・未配信**（配信=明示指示待ち）。聴解対訳の実費合計＝point¥167＋gaiyou¥26＋hatsuwa¥59＋sokuji¥71（kadaiは前）。次の大問プロジェクトは無し＝各大問対訳は文字語彙/文法/読解/聴解すべて完了。残作業はユーザー指示での **コミット＋push＋OTA配信** のみ。

## 表示側メモ（一次情報）
- 聴解描画 = `src/screens/ListeningScreen.tsx`。台本は showScript トグルで RubyText 表示（L225/229）。q=L306, choices=L321-324。`reveal = picked[qi]!=null`。
- 翻訳(en/ne)を出す仕組みは聴解に**一切なし**＝新設。データは step.clip.script / q.q / choices 経由。clip の供給元(i18n搬送)を要調査。

## 順序（③聴解の残り）
課題理解 → ポイント理解(point) → 概要理解(gaiyou) → 発話表現(hatsuwa) → 即時応答(sokuji)。
※発話/即時は本文＝音声のみ・選択肢も音声(audioChoices)で画面は番号 → 訳す対象が違う。着手時に再設計。
