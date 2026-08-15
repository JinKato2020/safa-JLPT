# 聴解ポイント理解 0081-0100 作問＋音声 (走行中)

開始: 2026-08-14 / 目的: 各レベル(N5/N4/N3)のポイント理解を +20問(0081-0100)=計60問 作問して音声生成まで。

## 作業ディレクトリ
`C:/Users/jwpsa/AppData/Local/Temp/claude/c--Users-jwpsa-Documents-desktop-claude-JLPT---/01d6ef67-5e52-41ec-a87d-fecd9fab207f/scratchpad/choukai_point_81_100`
- batches/ … build_batches --scope existing の参照
- newq/parts/point_{N5,N4,N3}.json … 各エージェントの出力(素・ふりがな無し)
- newq/new_point.json … 3体を束ねた統合(merge_and_gate入力)

## 走行中エージェント(作問・素で20問ずつ・自己モーラ検証まで)
- N5: agentId ab337b835c300cd9a
- N4: agentId ac365f8ba8ecd9d51
- N3: agentId ac18c468cfe868008
※ルビ付与は同一エージェントへ後続SendMessageで(文脈保持)。

## 現状の前提(2026-08-14 点検済)
- point 各レベル既存80問(0001-0080)。観点も場面もほぼ均等。
- 追加20問=観点5×各4問で均等維持・場面8カテゴリ均等(N5は地域近所/公共手続、N4/N3は公共手続を厚め)。
- mora帯: point N5 149-223 / N4 175-263 / N3 179-269(狙い=中央値〜やや短め)。

## 進捗(2026-08-14)
- 作問60問・ルビ・ゲート(致命0/帯外0)・正本追記(--apply)完了＝各レベルpoint 100問に。
- 観点均等維持・係0・個人名0・listening/rehydrateテスト緑。
- N4-C-P-0095の日付熟字訓(二泊三日/三泊四日)をFORCE_KANA拾える様に分割ルビ修正済(生残り0)。
## 完了(2026-08-14)
- 音声 **全60本生成完了**（N5/N4/N3 各20/20・assets/audio と 正本聴解フォルダ両方）。
  - run `bhst0cbsf` 48本成功＋N5 12本が通信切断で失敗 → run `bkjmhlcgx` で12本再生成成功。
- **rebuild.ts で _manifest.json＋bundled.generated 再生成済**（52ファイル）。listening/rehydrate/manifest/validate テスト21緑。
- **実費合計: Gemini 2.5 Flash TTS $1.67 ≈ 252円**（$1.42+$0.25）。
- scratchpad掃除済。**残タスク：git add/commit/push はユーザー指示待ち**（OTA配信は push で deploy-pages が公開）。ビルドも指示時のみ。

## 次の一手(この順)
1. 3体完了 → parts/*.json を new_point.json に統合
2. `python tools/choukai/merge_and_gate.py --new <WORK>/newq`(ゲート)→ 帯外を修正 → `--apply`で正本追記
3. 観点/場面 再点検(qtype_ledger --add / scene_ledger --add)
4. 同一エージェントでルビ付与 → 正本反映
5. `python 問題/tools/tts_script.py` → `python tools/choukai/tts_lint.py --new` → 音声生成(Gemini2.5Flash・60本・-20dBFS)
6. `_manifest.json`再生成 + bundled.generated 再ビルド(OTA配信の要)
7. 音声実費(モデル+円換算)を報告。ビルドはユーザー指示があれば。

手順書正本: md/聴解_作問フロー.md / md/聴解_音声作成フロー.md

## 追加タスク: 即時応答 試作9問(0041-0043) 2026-08-14
- 正本 sokuji_{N5,N4,N3}.json に各3問(0041-0043)追記済＝各43問。
- 設計: 正解位置①②③各3(完全均等・音声は固定順で焼込→今回生成時に配分)／場面7種／機能9種・既存120と重複なし／全モーラ帯内。
- N5-0043は熟字訓「三日分」誤読回避で「朝晩飲んでください」に言換(29拍)。
- **音声9本生成 実行中＝run `b5s88pt3j`**（ids_sokuji_9.txt）。完了後: 全9本点検→rebuild.ts(_manifest+bundled)→実費報告。
- 未了: 既存120問の正解位置27/7/6偏り(=要音声再生成)・N5弱ダミー・場面その他偏り は別途ユーザー判断。

## 即時応答9問 完了(2026-08-14)
- 音声9/9生成(run b5s88pt3j・失敗0)・assets/audio と 正本聴解フォルダ両方に配置(各3/3)。実費 $0.05≈7円。
- rebuild.ts済(_manifest+bundled)・listening/rehydrate/manifest/validate 19緑。scratchpad掃除済。
- git未コミット(commit/push・ビルドはユーザー指示待ち)。

## 即時応答 0044-0060 (各17問=51問) 作問中 2026-08-14
- サブエージェント3体起動(N5/N4/N3・Opus継承)＝各17問起草(script/choices/correct_text/scenario/function・JSON返却)。
  agentId: N5=ae522471c826c0f3a / N4=a95b8dddb72288286 / N3=a2dabd555c3e032c2。完了通知待ち。
- 教訓の担保(私側): 正解位置①②③各17に均等配分(生成時焼込)／merge_and_gateのmora検査／既存43×3と重複照合／TTS-lintで熟字訓誤読/音声全数確認+失敗再生成。
- 既存scriptは scratchpad/sokuji_44_60/existing_{lv}.json。
- 次: 3体JSON回収→検証(mora/dup/schema)→位置均等割当→正本追記→TTS-lint→音声51本→rebuild→実費報告。

## 即時応答0044-0060 追記完了→音声生成中(2026-08-14)
- 3体JSON回収→検証0エラー(モーラ全帯内/correct_text整合/選択肢3/既存重複なし/場面8種フル・その他0)。
- N4半角括弧()→全角（）正規化済。正解位置①17②17③17均等割当→正本追記(各60問)。TTSかな漏れ0/204。
- **音声51本生成 実行中＝run `bmldfadjw`**(ids_51.txt)。完了後: 全数確認→失敗再生成→rebuild→実費報告。

## 即時応答0044-0060 完了(2026-08-14)
- 音声51/51生成(run bmldfadjw・失敗0)・assets/audioと正本フォルダ両方(各17/17)。実費$0.29≈44円。
- rebuild済(_manifest+bundled)・test19緑。scratchpad掃除済。git未コミット(指示待ち)。
- 即時応答は各レベル計60問に(0001-0060)。

## 即時応答 ID帯リネーム完了(2026-08-14)
- 新規20問を一般帯へ: 旧0041-0060→0001-0020 / 旧原40問を枯渇プールへ: 0001-0040→0501-0540(全level)。
- 修正: 正本JSON(id+q-id)・assets/audio mp3・正本聴解フォルダmp3・_master wav(4桁統一720本)・gen_done台帳・tts_scripts再生成・_manifest+bundled再生成。
- アプリ帯ロジック新設: src/listening/pool.ts(idBand/practicePool)＝模試帯0701-除外・予備帯0501-は一般を一巡で解放。ListeningScreen.tsxで適用。test5緑。
- ID帯規約: 0001-0500一般/0501-0700枯渇プール/0701-1000模試専用。履歴移行なし(ユーザー了承・リセット可)。
- 未処理(要ユーザー判断): scratchpad_choukai/batches/batch_*.json は旧idの幽霊(git追跡)・rec.jsonの旧3桁sokujiキーは非機能メタ。模試抽出は現状の位置ベース維持(0701+問題作成時に切替)。
