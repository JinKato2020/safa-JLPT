# 発話(hatsuwa)音声・正解シャッフル 作業中（2026-07-24）

## 目的（ユーザー指示・この順で）
1. **Excelの訂正をJSONへ反映** … ユーザーが `聴解_TTSスクリプト_Chirp最適化_260問.xlsx` のスクリプトを手で訂正済→content JSONへ反映（Excel→JSON方向）。
2. **発話の正解位置をランダム化** … 今は全問 answerIndex=0（正解が選択肢1に集中）。JSONの choices を並べ替え＋answerIndex更新。N5/N4/N3 発話 各20＝60問。バランス配置（0/1/2をほぼ均等・seed固定）。
3. **Excel台帳も正解位置を修正** … G列（読み上げ選択肢）を新順に並べ替え＋「正解番号(1-3)」列を追加。
4. **音声を新順で作り直す** … 発話 N5 1-20 / N4 1-20 / N3 1-20（計60）。All Chirp3-HD・速度1.0・末尾奇数Orus/偶数Leda。台帳直読み（本文=E列・選択肢=G列）。

## 確定した検証（重要）
- **アプリは answerIndex で採点**＝`src/screens/ListeningQuizScreen.tsx:132` `ok = i === q.answerIndex`。1番固定ではない→**シャッフル安全**。
- `src/data/index.ts:306` audioChoices=画面は番号のみ・**シャッフル不可**・連結mp3。→**音声の並び順＝JSONの選択肢順**。だからシャッフル後は必ず音声を作り直す（順序一致が絶対条件）。

## 台帳 `聴解_TTSスクリプト_Chirp最適化_260問.xlsx`
- 列: A=レベル B=ID C=変更(✓/－) D=元(=JSON script/表示) E=Chirp最適化(=TTS本文/なんと化) F=変更点(「from」→「to」) G=読み上げ選択肢(音声・sync時に追加, ' ｜ '区切り)
- バックアップ: `聴解_TTSスクリプト_Chirp最適化_260問_bak_20260724_222045.xlsx`
- content JSON = `content/problems/choukai/{kadai,point,gaiyou,hatsuwa,sokuji}_{N5,N4,N3}.json`（items[].script / questions[0].choices / answerIndex）

## 音声パイプライン（確定・[[choukai-audio-pipeline]]）
- **速度=全レベル一定1.0倍**（RATE 3ファイル統一済: build_choukai3/build_choukai_audio/build_choukai2）。
- 番号クリップ=`問題\聴解\_numbers\{Orus,Leda}\{1,2,3}.wav`（Chirp3-HD・原速）。本文=Chirp3-HD-{声} speakingRate1.0→trim→-20dBFS。
- 構造: 本文→1.0s→[番号→0.4s→選択肢]×n（選択肢→次番号0.8s）。
- 出力3か所: `assets\audio\{id}.mp3`（アプリ）/`問題\聴解\{lv}\発話\{id}.mp3`（記録）/`聴解パイロット\発話..._AllChirp3\`（試聴）。
- **★単一コール・リトライ無し**（[[tts-no-retry-single-call]]）。**ffmpegに日本語ファイル名はNG**（化ける→ASCII名。ディレクトリ日本語はOK）。

## スクリプト（scratchpad=temp・消える可能性→要なら問題\toolsへ昇格）
- `gen_hatsuwa_n5_from_ledger.py` … 台帳直読みで発話生成（k選択で対象指定・N5専用→N4/N3対応に一般化が要る）。
- `sync_ledger.py`（JSON→Excel同期）/ `redo_opt.py`（最適化列=元+読み最適化only）。

## 進捗（2026-07-24 更新）
- ✅ 検証（採点は answerIndex 準拠＝シャッフル安全）／速度1.0統一／台帳 JSON同期。
- ✅ **Excel訂正→JSON反映**（発話14件＝本文2〔N5-C-H-010/018〕＋選択肢12。読点→句点/助詞のTTS最適化＋N5-C-H-013の誤答内容差替）。スクリプト=`reflect_and_shuffle.py`。
- ✅ **正解位置シャッフル 140問**（発話60/即時60/概要20・全て旧answerIndex0）。分布=発話/即時 各級7/7/6・概要5/5/5/5。バックアップ=各JSON `.bak_before_shuffle`。
- ✅ **台帳更新 140行**（G列=新選択肢順・H列=正解番号）。スクリプト=`update_ledger.py`。
- ✅ **発話 N5/N4/N3 001-020（60）音声生成 完了**（`gen_hatsuwa_all.py`・All Chirp3-HD・速度1.0・Orus奇/Leda偶・実費≈¥21.8）。**整合検証OK**（`verify_hatsuwa.py`＝JSON選択肢順==台帳G==音声・answerIndex+1==台帳H・不一致0・mp3欠落0）。正解分布=各級 番号1:7/番号2:7/番号3:6。出力=assets/audio＋問題/聴解/{lv}/発話＋聴解パイロット/発話{lv}_AllChirp3（各20）。本文はN3/N4/N5全て「なんと」。
- ⏸ **即時60・概要20 の音声は保留**（ユーザー「とりあえず発話だけ」）。**⚠ 即時/概要はJSONシャッフル済だが音声は旧のまま＝この2大問は音声を作り直すまで配信禁止**（発話3ファイルだけ先に配信可）。
- 📌 配信前TODO: rebuild(manifest/barrel再生成)→_manifest.json指紋更新→commit/push→Pages OTA。発話だけ出すなら hatsuwa_{N5,N4,N3}.json＋発話mp3のみ。
- ⚠ tts_opt読み最適化(何と→なんと)は台帳E列に反映済（発話 N5/N4/N3全て）。generator は All Chirp3-HD（canonical gen_choukai_json.py はFlashなので未統合＝幽霊注意）。
- ✅ **番号クリップ Aoede 追加**＝`問題\聴解\_numbers\Aoede\{1,2,3,4}.wav`（1/3/4=Flash-Aoede・2=Flash-Aoede「に」ni_3採用0.64s。Chirp3-Aoedeは短く詰まり不採用）。用途＝概要等でナレーター(Aoede)番号読み用の候補（まだ生成器に未接続）。番号読みの学び=単独「に」は詰まる→best-of/表記変え/キャリア抽出で対処。試聴残骸は掃除済。

## 2026-07-25 追記：正式化・掃除・発話配信 完了
- ✅ **発話やり直し**：12問=Chirp3 Aoede、007/005=Leda、008=Leda（台帳訂正反映後）。整合検証OK。
- ✅ **正規保管＝`assets/audio/`**（アプリはPages経由でここを読む＝`AUDIO_BASE_URL` + `{id}.mp3`）。pilot `発話N{3,4,5}_AllChirp3`(各20)と全60ハッシュ一致。
- ✅ **幽霊掃除**（全てgit未追跡・リポ無影響）：旧記録`問題/聴解/{lv}/{3,4}_発話表現`(31本)削除／`聴解パイロット`は実験9フォルダ+古デモ13+txt削除→AllChirp3の3つだけ17M。`問題作成の参考`は**公式教材ライブラリ(過去問PDF/CD音源)なので温存**。`_master`原本(生wav部品)も温存。
- ✅ **発話60問 本番配信 済**（commit `0dd7948`・push main→deploy-pages OTAのみ／本体ビルドは起きない）。65ファイル=音声60+hatsuwa JSON3+_manifest+listeningAudio。マニフェスト差分=**発話3のみ(count10→20)**。他大問は巻き込まず。
- ✅ **音声キャッシュ破棄**＝`src/data/listeningAudio.ts` の `LISTENING_CACHE_VER='v2'`→`listening_v2/`。同名mp3はキャッシュ優先で再DLされない罠への対処（差替001-010を既存端末にも届ける）。旧`listening/`は端末に孤児で残る(小・無害)。

## 正本・配信の確定事実（重要・恒久）
- **content/ が正本**：`src/data/exam/listening.json` は**存在しない**。`tools/content/rebuild.ts` が `content/**` を**再ハッシュ**して `_manifest.json`+`bundled.generated.ts` を作る（`build_content.ts` は旧移行ツール・不使用）。→ content JSON を直接編集してOK。
- **OTAはファイル単位sha256差分**（`src/data/content/ota.ts`＝`_shas.json` と比較し変化分だけDL）。**発話だけ配信したい時は「他大問をHEADに戻す→rebuild→発話だけcommit」**。ディスク全体からrebuildすると未完の即時/概要も巻き込む。
- **push(main)=deploy-pages(配信)のみ**、iOS/Androidビルドは`workflow_dispatch`手動のみ（build-jlpt.yml:74/126/318）。
- **⚠ 即時60・概要20 はJSONシャッフル済だが音声未再生成＝配信禁止**（作業版は content/ に未コミットで復元済／`.bak_before_shuffle` はscratchpad/content_bakにも退避）。配信は音声を作ってから同じ手順で。
