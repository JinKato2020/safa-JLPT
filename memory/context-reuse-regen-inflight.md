# 文脈規定：辞書例文の流用を新規作問で置換（進行中）

## 【第3ラウンド N3 進行中 2026-08-29】類似0.3以上のN3=1598語を差替
ユーザー指示: N4/N5同様、類似0.3以上のN3語彙例文を新例文へ差替（例文＋ルビのみ・選択肢/解説なし・文脈規定は据え置き・翻訳en/neはGemini）。
- 対象= scratchpad/vocab_swap3/target_N3.json（1598語・全件 sim≥0.3・min0.3/max0.967）
- 生成run: wf_a6367703-601（✅完了・40体0エラー）／ルビrun: wf_33a9fb72-f49（✅完了・16体0エラー）
- 翻訳: ✅完了（en80/ne80バッチ・**Gemini実費 ¥62**・gemini-2.5-flash）
- **✅焼き込み済（--write）**: vocabExamplesAi(ja1598/en1596)・vocabFurigana(1598・検算NG0)・lexicon example_N3(ne1598)。文脈規定 無変更確認。manifest再生成済。**content検証17/17 pass**。
- **未コミット・未配信**。配信境界: ne訳=content(OTA=publish-content.ps1) / ja+en+ふりがな=src/data(バンドル=次build)。**デプロイは合図待ち（勝手にpush/buildしない）**。


## 目的
文脈規定(N5/N4)のうち、辞書の例文(vocabExamplesAi/lexicon)をほぼ丸写しして〔　〕を空けただけの
低品質問題を、**辞書とは別の新しい例文**で作り直す。本番公式レベルの優良問題・ダミー設計にする。

## 確定した方針（ユーザー決定 2026-08-29）
- 対象＝**N5・N4のみ**（N3はやらない）。閾値＝辞書例文との文字bigram類似 **sim≥0.8**。
  - 件数: **N5=256 / N4=154（計410問）**
- 答えの語は**全て維持**。例文(prompt)を辞書と別物に作り直す。
- **既存の誤答(oldChoices)を参考に**。新しい文で成立しないものだけ差し替え／新規作成。
- **解説は不要**（gen_context_workflowは元々「解説は書かない」＋bakeが旧explain削除で整合）。

## 方法（既存パイプライン流用）
1. `tools/select_context_reuse.py` … sim≥0.8のN5/N4を選び scratchpad/context_regen/select_{lv}.json 出力
   （フィールド: id, word, oldPrompt, dictExample(=避ける), oldChoices）
2. `tools/gen_context_workflow.py {LV}` … 改修済: avoid/oldChoices を各語に同梱＋GEN_RULESに
   「辞書丸写し禁止・oldChoices参考」ブロックを追加。BATCHはlen/10で~10バッチに調整。
3. Workflowで wf_context_{LV}.mjs を実行（生成→反証+修正→再反証・Opus high）
4. `tools/bake_context.py <runId> --level {LV} --write` で焼込み（ふりがなMeCab・旧explain削除）
5. 監査→ _manifest.json 再生成→OTA

## 次の一手
- [ ] select_context_reuse.py 実行 → 件数確認
- [ ] N4 workflow 実行 → bake → 抜き取り確認
- [ ] N5 workflow 実行 → bake
- [ ] manifest再生成・testLevelCounts整合・commit

## 方針変更（ユーザー指示 2026-08-29）: 生成のみ（反証・修正エージェント無し）
- gen_context_workflow.py に `--gen-only` 追加済（生成の自己検算A〜Eのみで確定）。
- 旧3段N4(wf_ffe7fc43-e59)は途中停止。生成済118問を取り出し済＝
  scratchpad/context_regen/genonly_N4_partial.json（154問中118）。

## run ID
- N4-3段(停止): wf_ffe7fc43-e59 → 118問取り出し済(genonly_N4_partial.json)
- N4-残36(生成のみ): wf_73bcfcff-2c8（実行中・2体）
- N5-256(生成のみ): wf_ca8e4e0c-c71（実行中・10体）

## 生成完了: N4=154問(journal_N4_genonly.jsonl) / N5=256問(wf_ca8e4e0c-c71,255確定+1括弧で人手送り)
## ルビ（監査なし＝ユーザー指定「verify不要」）: gen_polish_workflow.py に --ruby-only 追加
- N4 ルビ: wf_18561657-a94（実行中・2体）
- N5 ルビ: wf_f5b98771-6c6（実行中・3体）
  ※ bakeはルビ必須（need & not polish → 中止）。ruby-onlyは results空→揃い監査は適用されずルビだけ入る。

## 【方針転換 2026-08-29・確定】入れ替え: 新文=語彙例題 / 文脈規定は据え置き
文脈規定(context_*.json)は一切触らない。新文は「語彙単語の例題」に投入する。
- ja例文→ src/data/dict/vocabExamplesAi.json[vid].ja（穴を正解で埋めた完成文）
- ふりがな→ src/data/dict/vocabFurigana.json[vid]（完成文のルビ）
- en訳→ vocabExamplesAi.json[vid].en / ne訳→ content/lexicon/example_{LV}.json items[vid].ne
- 対象=410語(N4 154 / N5 256)。id→vocabIdは context_*.json 由来。
- 表示ロジック確認済: BrowseScreen en=VOCAB_EXAMPLE.en, ne=exampleIn(EXAMPLE_L10N)。

## 素材（scratchpad/vocab_swap/）
- filled_N4.json / filled_N5.json = {id,vocabId,answer,ja(完成文)}
- 完成文ルビ run: N4=wf_6c6f1593-bb7(完了) / N5=wf_7f8f0194-5e5(実行中)
  ※旧・穴付きルビ(wf_18561657-a94/wf_f5b98771-6c6)は使わない
- 翻訳(Gemini2.5flash): scratchpad/vocab_swap/translate.mjs → out/{en,ne}/batch*.json
  実行=bii6ew73p(バックグラウンド)。1バッチ20文=$0.0021。実費は _usage.json。

## 【第2ラウンド 書込済 2026-08-29】類似0.3以上の語彙例文651語を差替（未コミット・未配信）
- bake_vocab_examples.py --src-dir vocab_swap2 --write 実行済。ja651/en651/ne651/ふりがな616(NG1)。
- 文脈規定 無変更を確認。入れ替えで別文化を確認。content検証11pass。_manifest再生成済。
- 翻訳Gemini実費 ¥23(vocab_swap2/_usage.json)。ルビrun N4=wf_77ba640e-e07/N5=wf_dfd3b461-5ee。
- 未コミット。OTA(ne)配信は publish-content.ps1 で（ユーザー確認後）。ja/en/furiは次build。

## 【第2ラウンド 詳細】類似0.3以上の語彙例文を作り直し（651語）
ユーザー指示: 文脈規定の問題文と類似0.3以上の語彙例文を作り直す。**例文＋ルビのみ・選択肢/解説なし**。文脈規定は据え置き。翻訳en/neもGeminiで作る。
- 対象=651語(N5 379/N4 272)。既済410は除外。表面bigram OR 読み正規化 max>=0.3。
  リスト= scratchpad/vocab_swap2/target_{N4,N5}.json（{id,vocabId,word,contextPrompt,oldExample}）
- 生成ツール(例文直接・選択肢なし)= tools/gen_vocab_examples_workflow.py
- 生成run: N4=wf_aca37ae0-3b0 / N5=wf_7a656b81-fa8（**完了**・{id,vocabId,ja}回収済）
  → scratchpad/vocab_swap2/filled_{N4,N5}.json（N4 272/N5 379）。baked_{lv}.json(prompt=ja)書済。
- ルビrun(完成文): N4=wf_77ba640e-e07 / N5=wf_dfd3b461-5ee（実行中）
- 翻訳(en/ne): node scratchpad/vocab_swap/translate.mjs --dir <abs>/scratchpad/vocab_swap2 をbg実行中
  （harness非追跡＝_trans.logで確認。out/{en,ne}/batch*.json + _usage.json）
- 焼き込み: bake_vocab_examples.py に --src-dir 追加済。実行=
  `python tools/bake_vocab_examples.py --src-dir vocab_swap2 --ruby-n4 wf_77ba640e-e07 --ruby-n5 wf_dfd3b461-5ee`（ドライラン→--write）
  → _manifest再生成 → OTA(ne)/build(ja+en+furi)
- この後: 完成文=ja(穴なし) → gen_polish --ruby-only でルビ → translate.mjsでen/ne → bake_vocab_examples.py で
  vocabExamplesAi(ja/en)・vocabFurigana・lexicon(ne) へ投入 → _manifest再生成 → OTA(ne)/build(ja+furi)。
  ※ bake_vocab_examples/translate は入力ディレクトリを vocab_swap2 に向ける必要（要小改修）。

## 【第1ラウンド完了 2026-08-29】≥0.8の410語＝書き込み済・ne訳OTA配信済(commit 9a17081e)・ja/en/furiは次build
- bake_vocab_examples.py --write 実行済。ja410/en410/ne410/ふりがな389(NG1=素のja)。
- 文脈規定(context_*.json)は無変更＝据え置き確認済。入れ替えで別物化を実機データで確認。
- content検証テスト11 pass。_manifest.json / bundled.generated.ts 再生成済。
- Gemini実費: gemini-2.5-flash ¥15(_usage.json)。ルビはClaude(サブスク)。
- 配信境界: ne訳=content(OTA=publish-content.ps1) / ja+ふりがな=src/data(バンドル=build.ps1)。
  → **デプロイは指示待ち**（勝手にpush/buildしない）。ne即時OTA可・ja/ふりがなは次のビルドで反映。

## (旧手順メモ)焼き込み（ルビ+翻訳完了後）
`python tools/bake_vocab_examples.py --ruby-n4 wf_6c6f1593-bb7 --ruby-n5 wf_7f8f0194-5e5`（ドライラン）
→ 確認 → `--write` → content変更につき _manifest.json 再生成 → commit
※ vocabExamplesAi/vocabFurigana は src/data(バンドル=OTA JS)。lexicon は content(OTA)。build指示は待つ。
