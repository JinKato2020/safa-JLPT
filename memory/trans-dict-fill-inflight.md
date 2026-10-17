# 辞書コンテンツ 欠落翻訳の埋め（2026-09-03・ユーザー「英語もネパール語も未翻訳がある。すべてを満たして」）

## 対象と投入先（一次データで確定）
- kanji_ne 677語（親字 N5:103/N4:190/N3:384）→ `content/lexicon/kanjigloss_N{lvl}.json` に追記（**OTA**）
- vocab_en 705件（N5:32/N4:206/N3:467）→ `src/data/dict/vocabExamplesAi.json` の en を埋める（**src=要ビルド**）
- vocab_ne 89件（N5:39/N4:15/N3:35）→ `content/lexicon/example_N{lvl}.json` に追記（**OTA**）
- orphan n3-v-1005＝vocab.json に無い幽霊 ne（表示されない）→ example_N3.json から**削除**（OTA）

## ツール・run
- ツール＝`tools/trans_dict_fill.py <kanji_ne|vocab_en|vocab_ne|orphan> [--dry-run|--apply|--write]`。キャッシュ=scratchpad/pg/dictfill_*.json。
- apply run=**`bb7cqcj0r`**（3種一括・概算¥25）。完了後: 各 `--write` → `orphan --write` → rebuild.ts → staleness種再生成 → テスト/tsc → Excel/比較xlsx更新。
- **配信**: ne=OTA(publish-content)・en=ビルド(vocabExamplesAiはsrc)。1回のビルドで en(src)＋content(OTA) を同梱可。※現在 v1.1.32(2900) が別途走行中（聴解対訳の表示コード）。

## ✅完了・OTA配信済（2026-09-03・commit 714f2702・Pages 33744241016）
- apply `bb7cqcj0r` done=677/705/89 fail0・実測¥15 → write（kanji_ne→kanjigloss overlay／vocab_ne→example overlay／vocab_en→**vocabExamplesAi(src)＋example overlayの両方**）→ orphan削除。
- **重要な設計発見**: 辞書例文の en/ne は **OTA overlay で上書き可**（index.ts:145 VOCAB_EXAMPLE ＝ 同梱vocabExamplesAi初期値＋content/lexicon/example_* の en/ne 上書き）。ゆえに **enもビルド不要でOTA配信**できた（705enを example overlayに投入）。→ **ネイティブビルドは不要**だった。
- 例文の物理2分割＝**実施済**（grammar分を `exampleGrammar_N?.json`＝kind:'example' へ移動。mergeLex(kind)で自動再結合ゆえ rehydrate変更なし・OTA安全）。vocab3524＋grammar408＝3932 保存。
- 検証: VOCAB_EXAMPLE en欠落0・KANJIGLOSS 1859・EXAMPLE 3932・rebuild(116files)・content検証20緑・staleness既知3のみ。
- 残（src未commit・次ビルド同梱でよい）: vocabExamplesAi.json の en（baseline整合用）・bundled.generated.ts（分割importの再生成）。OTAは overlay で配信済ゆえ体感差なし。
