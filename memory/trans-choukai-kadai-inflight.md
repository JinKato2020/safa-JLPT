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
4. [ ] **push/build/OTA は別途明示指示待ち**（勝手にやらない）。配信境界: content(kadai_*.json)＝**OTA**(publish-content.ps1)／表示コード(ListeningScreen/rehydrate/番人)＝**ビルド**。片方だけだと課題理解の対訳が実機で出ない(OTAデータはビルドが出るまで dormant)。
   - ※次の大問=ポイント理解(point)。kadaiと同構造(script+q+choices)ゆえ trans_daimon.py に 'point' 追加＋listeningMapは既に汎用(全聴解subtypeでPASSAGE/Q_TRANS拾う)＝表示結線は追加不要。dry-run→apply→write→rebuild→Excel の繰り返し。

## 表示側メモ（一次情報）
- 聴解描画 = `src/screens/ListeningScreen.tsx`。台本は showScript トグルで RubyText 表示（L225/229）。q=L306, choices=L321-324。`reveal = picked[qi]!=null`。
- 翻訳(en/ne)を出す仕組みは聴解に**一切なし**＝新設。データは step.clip.script / q.q / choices 経由。clip の供給元(i18n搬送)を要調査。

## 順序（③聴解の残り）
課題理解 → ポイント理解(point) → 概要理解(gaiyou) → 発話表現(hatsuwa) → 即時応答(sokuji)。
※発話/即時は本文＝音声のみ・選択肢も音声(audioChoices)で画面は番号 → 訳す対象が違う。着手時に再設計。
