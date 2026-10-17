# 骨組みパラメータ Phase-α（inflight・2026-08-18）

設計正本＝md/聴解_作問フロー.md「骨組みパラメータの最適化」節。ユーザー承認済みで着手。

## 目的（Phase-α＝¥0：作問/TTSはしない）
課題/ポイント/概要に骨組みフィールドを追加＋既存を自動タグ付け＋偏りを止める番人。ここで「実際の偏り」を数値化する。

## 実装対象
- ① 課題(kadai N3/N4/N5≈296)：`develop`（くぐり方8値）。設問型5は既存qtype_ledgerで維持。
- ② ポイント(point N3/N4/N5≈304)：`kanten`（観点）を推定→保存に格上げ。
- ③ 概要(gaiyou N3=80)：`genre`（話題8値）＋`q_type`（聞き方）。場面は均し軸から外す。
- 共通◆答え確定位置ゲート（①②③）。②③の末尾は「答え確定位置＋語彙マッチ」でカバー（末尾逐語は①専用）。
- 発話/即時応答＝変更しない（既に完備・偏りmax17-23%で健全・実測確認済）。

## backfillの方針（コスト）
- kanten・q_type＝regex決定的（¥0・エージェント不要）。
- genre＝キーワード規則で初回分類（要レビュー）。
- develop＝会話ロジック判断が要る→少数の束ねエージェント（B2）。¥0（本体クォータ内・有料APIなし）。

## 番人（build失敗条件）
- 各itemにフィールド欠落なし／値の最大シェア≤35%（偏り）／(kanten)気持ち0でない。
- 実装＝python ledger（scene_ledger同型）＋TSまたはpythonの番人テスト。ソースJSONを読む（app bundleには不要な作問メタ）。

## リスク確認（着手前）
- [確認中] 新フィールド追加が rebuild.ts / スキーマ検証 / bundled生成を壊さないか。壊すなら作問メタは source JSON+tools 限定に留める。

## 進捗（2026-08-18）
- [済] 安全確認：rebuild.tsは各JSONを丸ごと埋込＝フィールド追加は安全（tsc/検証で弾かれない）。
- [済] tools/choukai/skeleton_tag.py 作成（backfill/apply-map/census/check）。TAXONOMY=develop8/genre8/qtypeG3。番人=欠落0・最大シェア≤35%・気持ち>0。
- [済] 決定的backfill：kanten(point3ファイル)・q_type(gaiyou)付与。書式維持を git diff で確認。
  - 発見①：point観点は既に良バランス（各≈20%・気持ち有）＝直す問題なし・番人で固定。
  - 発見②：gaiyou q_type 偏り＝主張75%/何について25%（⚠・Phase-β候補・質問文=音声変更なので有料）。
- [走行中] LLM分類エージェント4体→scratchpadにmap書出し：
  - develop×3（kadai_N5/N4/N3）／genre×1（gaiyou_N3）。値は8語ちょうど。
  - 出力＝<scratchpad>/skel_develop_kadai_N{5,4,3}.json・skel_genre_gaiyou_N3.json

## Phase-α 完了（2026-08-18・¥0・有料APIなし）
- [済] 4体分類→apply-map（develop296・genre80）＋決定的backfill（kanten304・q_type80）＝全付与・未0。
- [済] TS番人 src/data/skeletonBalance.test.ts（欠落0・過半50%禁止・気持ち必須）→3/3緑。build.ps1の$testsに登録。
- [済] ビルド用テスト37/37緑（validate/manifest/rehydrate/otaDiff含む＝フィールド追加は無害）・tsc0・scratchpad掃除。
- 実測偏り（Phase-β対象）：develop kadai_N3=消去46%⚠／gaiyou q_type=主張75%⚠／genre薄い=モノサービス1・文化行事2／develop薄い=まず次・断って代案。kanten・genre最大は35%内。
- 内容ファイル(kadai×3/point×3/gaiyou)は変更済み・未コミット＝次ビルドで載る（作問メタ・アプリ動作は不変）。

## Excel記録（2026-08-18・完了）
- skeleton_tag.py に `--xlsx` 実装＝在庫Excelにシート「聴解 骨組みパラメータ分布」追加（薄める対象＝大問×レベル×薄い型が一目）。
- 更新チェーン実行済：stock_report→mock_stock→stock_excel→daimon --xlsx→skeleton_tag --xlsx。Excel=5シート。
- 薄める対象（⚠/❌の行だけ手を入れる）：課題N3 develop=消去46%→薄い型(まず次/断って代案/二者択一/追加/上書き)を増作／概要N3 q_type=主張75%→何について型を増作(質問は音声焼込み=新規分だけ有料)。genre薄い=モノサービス(1)/文化行事(2)。kanten・課題N5N4・genre最大は良好。
- 重要方針：**既存音声の焼き直しは不要。薄い型を新規追加する分だけTTS（安い）。今後の作問を薄い型に向ければ追加コストほぼゼロで自然是正**。

## 未コミット（次ビルドで載る・アプリ動作不変の作問メタ）
content: kadai×3(develop)・point×3(kanten)・gaiyou(genre+q_type)。tools: skeleton_tag.py・build.ps1(+テスト登録)。test: src/data/skeletonBalance.test.ts。md: 聴解_作問フロー.md。memory Excel。
番人3/3緑・ビルド用テスト37/37緑・tsc0・scratchpad掃除済。ビルドはまだしていない。

## 次の一手（ユーザー判断待ち）
- Phase-β（有料）：上記⚠/❌の是正＝薄い型を新規追加（着手前に本数と概算¥を提示）。今は着手しない。区切ってもよい。
