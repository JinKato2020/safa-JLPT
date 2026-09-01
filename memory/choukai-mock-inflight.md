---
name: choukai-mock-inflight
description: 聴解5大問(課題/ポイント/概要/発話/即時)の模試プール新設＝設計〜作問〜音声〜結線の着手メモ。/clear をまたぐ。まだ設計フェーズ未着手。
metadata:
  type: project
---

# 聴解 模試プール新設 — 着手メモ（/clear 耐性）

## ▶▶ 2026-09-01 🎙️音声フェーズ着手（ユーザー承認済「パイロット→全部」・D1見積り提示済）
- **スコープ**＝模試聴解800本のTTS音声生成。エンジン=Gemini2.5Flash TTS（既存 `問題/tools/gen_choukai_json.py`・GEMINI_API_KEY設定済）。見積り=13本パイロット実績$0.16-0.18(≒¥24-28)→**800本 約¥1,500-1,700(上限¥2,500)**。
- **✅無料の下ごしらえ完了**：(1)`gen_choukai_json.py` の `load_item` を**模試フォルダ対応**に修正＝ID番号≥701なら `content/problems/choukai/mock/{大問}_{lv}.json` を読む（gitignore内ローカルツール・1箇所）。(2)台帳(tts_scripts)は**生成に不要**と確認（`TS.resolve()`はその場計算・台帳は人間確認用のみ）。(3)概要gaiyouのaudioChoices音声は**既に実装済**と確認（gen_dialog_mono の `code=='G'` 分岐＝設問→番号→選択肢×4読み上げ）。
- **★LIVE＝パイロット13本 生成中（各大問先頭1本・特に概要N3-C-G-0701を確認）**。IDリスト＝N3-C-G-0701,N{3,4,5}-C-H-0701,N{3,4,5}-C-K-0701,N{3,4,5}-C-P-0701,N{3,4,5}-C-S-0701。出力＝`scratchpad/choukai_mock/pilot_audio/`＋`assets/audio/{id}.mp3`＋`問題/聴解/{lv}/`。ログ＝`memory/choukai_gen_log.txt`・done＝`memory/choukai_gen_done.txt`（pilot分がdoneに入る→全生成時は自動スキップ=二重課金なし）。
- **次の一手**＝パイロット完成→ユーザーに試聴依頼（特に概要の番号読み上げ）→OKなら残り787本を `--ids-file` で全生成（約¥1,600）→D2実費報告。**音声のOTA/build反映は別途指示（[[merge-pages-into-build-workflow]]）。**

### 🐞パイロットで判明した不具合と修正（2026-09-01・当セッション）
- **ユーザー試聴指摘**＝N3-C-K「早口＋『会社で女1と男1が話しています』とラベルを読み上げ」／N4-C-K「早口＋『落ち着いた自然なトーンで話してください』とスタイル指示を読み上げ」。
- **真因（1つ）＝`split_intro` は空行(`\n\s*\n`)で導入と本文を分けるが、模試kadai N3/N4は単一改行で書かれ空行が無い**→スクリプト全体が「導入」扱い→(a)全文をナレーターが読む=ラベル『女1/男1』も音声化(N3)(b)本文が空→空テキストにDIA_STYLE前置き→**スタイル指示だけが読まれる**(N4)(c)話者0→独話誤判定。N5 kadai/point全級/gaiyouは空行付きで正常だった。
- **スキャン結果**＝壊れは**kadai_N3(0/60空行)とkadai_N4(40/80空行)だけ**。他は空行100%。hatsuwa/sokujiはgen_hsで導入分割不要ゆえ無関係。
- **✅データ修正実施**＝`content/problems/choukai/mock/{kadai_N3,kadai_N4}.json` の各script を「導入行＋空行＋本文」へ正規化(100件変更)＋**N3導入の番号ラベル『女1/男1』→『女の人/男の人』(ふりがな対応正規表現・本文turnsラベルは不変)**。オフライン検証＝本文空0/空行100%/番号ラベル残0。話者<2の16件(N3:10/N4:6)は放送・留守電・先生独話など**正当な独話**(導入も単数表現)＝バグでない。
- **⚠content編集ゆえOTA配信時は_manifest.json再生成必須**（[[ota-manifest-regen-or-stale]]）。今は未push。
- **✅修正版で再生成確認**＝N3-C-K-0701(独話→対話・LCS0.90→0.99)/N4-C-K-0701(対話化・LCS0.76要確認)/N3-C-K-0710(放送独話0.97)。尺も自然化(93.9→64.4s等)。

### 🔬全800問 音声化前 内容監査（ユーザー要望 2026-09-01・当セッション）
- **新ツール**＝`問題/tools/tts_content_audit.py`（API不使用・gen同手順で「実際に読み上げられる文字列」を再構成→①スタイル指示混入②読み上げ位置の女N/男N③男女以外の話者ラベル漏れ を全問検査。再実行可）。
- **結果（全800）**：①スタイル指示混入=**0**✓ ②読み上げ女N/男N=**0**✓(課題修正後) ③男女以外の話者ラベルが音声に漏れ=**27件・概要gaiyou_N3のみ**（医者/専門家/先生/看護師/担当/職員/研究者/リーダー/店主/職人/動物園の人等）。ℹ️表示用タグ女1:/男1:=324件(対話話者タグ・TTS前に除去=音声に出ない)。
- **✅ユーザー決定＝①概要ラベルは本文から削除／②表示タグ女1:/男1:はそのまま**。
- **✅③修正実施**＝`content/problems/choukai/mock/gaiyou_N3.json` 本文頭の役割ラベル27件を削除（導入で紹介済み・公式どおりクリーン独話）。再監査＝gaiyou全項目0。
- **✅コード修正**＝`gen_choukai_json.py` gen_dialog_mono の概要(code=='G')独話声を**導入文の性別で決定**（女の人→Leda/男の人→Orus・中立役=ID偶奇で男女交互）。ラベル削除で声が全部Orusに倒れるのを防止＋0706/0708(女)の性別不一致も是正。
- **✅概要修正版 確認OK**＝0701/0705Orus・0706/0712Leda（声が導入性別で正しく変化・LCS0.97-1.00・ラベル漏れ無し）。ここまで実費≈¥44。

### 🚀全生成 LIVE（ユーザーGO「これで進めて」2026-09-01）
- **残り783本を全生成中（800中17済＝pilot+再生成分をスキップ）**。ids一覧＝`scratchpad/choukai_mock/all_ids.txt`。実行＝`python 問題/tools/gen_choukai_json.py --ids-file scratchpad/choukai_mock/all_ids.txt`（バックグラウンド・done増分追記で中断再開可・[[tts-no-retry-single-call]]で暴走課金なし）。出力＝`assets/audio/{id}.mp3`＋`問題/聴解/{lv}/`。ログ＝`memory/choukai_gen_log.txt`（末尾に実費¥）。見積り約¥1,600(上限¥2,500)。
- **完了後の一手**＝(1)D2実費報告（モデル名+円）(2)全13ファイルのmp3有無を機械確認(欠け0)(3)ユーザー抜き取り試聴 (4)OTA/build反映＝content編集したので `_manifest.json` 再生成必須([[ota-manifest-regen-or-stale]])＋音声はビルドでライブ化([[merge-pages-into-build-workflow]])。**push/ビルドは別途指示**。
- **⚠未commit**＝gen_choukai_json.py(load_item mock対応/概要声)・tts_content_audit.py(新規)・content/problems/choukai/mock/{kadai_N3,kadai_N4,gaiyou_N3}.json(データ修正)・assets/audio/*.mp3(生成物)。


## ▶▶ 2026-08-31 ✅(a)結線 完了（当セッション・音声抜き・未commit/未push/未ビルド）
- **✅修正の核**＝聴解mock13ファイルは file-level `pool` が欠落（itemにはあるがrehydrateはfile側判定）→**学習バンク混入の危険**。`content/problems/choukai/mock/*.json` 全13に file-level `pool:'mock'` 付与（読解mockと同形）。
- **✅結線**：rehydrate.ts=`listeningMap(st)` 関数化し `LISTENING`(学習)＋`LISTENING_MOCK`(pool='mock')両方に適用＋return追加／index.ts=`LISTENING_MOCK` export＋`listeningMockItemsForSub(lv,sub)`／MockScreen.tsx=`listeningByBlueprint` を mock優先fallback（`const m=listeningMockItemsForSub; return m.length?m:listeningItemsForSub`）＋**audioChoices(発話/即時)はシャッフル不可ガード追加**（正解位置が音声焼込み・ListeningScreenと同じ。既存の学習バンク経路の潜在ズレも同時是正）／import追加／`rebuild.ts`実行(113 files)。
- **✅番人**＝`src/data/listeningMock.test.ts`（(lv×sub)本文/設問数=公式×10・計800・id帯0701-1000・内容系4択ai0/音声系3択ai0..2・audio必須）＋package.json test列に登録。
- **✅検証**：tsc0／npm test **495/495 緑**／ランタイム=学習2300本にmock帯混入**0**・LISTENING_MOCK 800・hatsuwa ai分布17/17/16保持。
- **⚠残（別承認）**：(c)音声TTS未実施＝mockクリップの mp3 は未生成。**build/OTA前に必ずTTSすること**（今は未push/未ビルドゆえアプリ非表示=実害なし）。commit/push/ビルドは(d)明示指示のみ。
- **✅(b)在庫Excel 反映 完了**＝`tools/stock_excel.py` の MOCK 辞書に聴解5大問追加（課題70/80/60・ポイント60/70/60・概要-/-/30・発話50/50/40・即時60/80/90＝作問実数と一致）→`memory/在庫・模試ストックまとめ.xlsx` 再生成。学習在庫は不変(mock非計上)。
- **既知の非対応(スコープ外)**：MockScreenは audioChoices を番号のみUIでなくテキスト選択肢で描画（学習バンクも同様の既存挙動）。正解位置はガードで整合済＝採点は正しい。番号UI化は別UX判断。→**下記で対応済**。

## ▶▶ 2026-09-01 ✅概要理解を公式仕様「番号のみ・シャッフルなし」へ設計変更＋模試も番号のみ描画（ユーザー厳命・当セッション）
- **ユーザー指摘**＝公式は概要/発話/即時=**番号のみ**（選択肢も音声・テキスト非表示・固定番号）。旧設計は概要=テキスト4択・表示時シャッフル（`daimon_solvability` CONTENT分類）で公式と不一致。かつ音声付与時に「音声の番号」と「シャッフルされた表示番号」がズレる欠陥。
- **✅データ**：概要gaiyou を `audioChoices:true` 化＝(a)学習 `content/problems/choukai/gaiyou_N3.json` 80問に `audio:true`+`audioChoices:true`（answerIndexは既に均等20/20/20/20＝据置）(b)模試 `mock/gaiyou_N3.json` 30問 `audioChoices:true`＋**answerIndexを全0から8/8/7/7へ均等焼き直し**（正本correct=旧index0を各位置へ移動・整合NG0）。→rebuild。
- **✅UI**：ListeningScreen＝gaiyou audioChoices化で自動的に番号のみ＋シャッフル無効（`cl.audioChoices?{...q}:shuffle` ガード既存＝**旧シャッフルズレ欠陥も解消**、コード変更不要）。MockScreen＝`MockItem.audioChoices` 追加＋blueprintで伝播＋**選択肢を番号のみ描画**（`cur.audioChoices?<numBadge i+1>:テキスト`・styles `choiceNum`/`numBadge` 追加）＝発話/即時/概要すべて番号のみに。課題/ポイントはテキスト4択のまま。
- **✅番人**：`listeningMock.test.ts` を CFG（課題/ポイント=テキスト4択ai0／概要=音声4択ai0..3／発話・即時=音声3択ai0..2）へ更新。tsc0・npm test 495/495緑・ランタイム実測OK。
- **⚠TTS(c)で必須**＝概要の音声は「独話→質問→選択肢4つ（番号1-4）」を読み上げる版を生成すること（発話/即時と同様のaudioChoices方式・ただし4択＋質問読み上げ有）。build_batches は audioChoices=true を出力済ゆえ音声ビルドは概要をaudio選択として扱うはず＝**要実確認**。**この音声が出来るまで学習gaiyou/模試聴解を publish-content/build しない**（番号のみ＝音声無しだと選択肢が読めず解答不能）。
- **注**：daimon_solvability の CONTENT集合コメントは概要をテキス扱いのまま（実行時は audioChoices フラグ参照ゆえ位置検査は効く）＝実害なし・再QA時は概要位置=固定として見る。


## ▶▶ 2026-08-31 ✅N3 概要gaiyou30＋発話hatsuwa40 作問 完了・配置済（当セッション・音声抜き・未結線）＝聴解mock全13ファイル完成（残ゼロ）
- **✅70問 生成・修正・全ゲート通過・content配置 完了**＝`content/problems/choukai/mock/{gaiyou_N3(30),hatsuwa_N3(40)}.json`（pool='mock'・languages['ja']・全item audio:true）。ID＝N3-C-G-0701〜0730／N3-C-H-0701〜0740。
- **最終ゲート**：gaiyou mock_verify致命0（帯190-284・196/216/234）／daimon_solvability=**✅良好**（最長10%・語彙マッチ13%・正誤差**-0.4**[逆転成功]・台本重複0・選択肢重複0）。hatsuwa hatsuwa_build致命0（攻略耐性 最長30%/依頼形12%/形分離48%・機能最大20%/場面最大15%・pos 14/13/13）。
- **修正の要点**：hatsuwa=致命6件(禁止語「留守」＋状況/選択肢重複5・うち「足を踏む」は例示丸写しで公式衝突)を別題材へ差替→合格。gaiyou=①短11問延長②語彙逆転(正解=本文語外し言い換え/誤答=本文部分語流用・正誤差+2.1→-0.4)③pool/audio付与④0725延長＋正解単独最長11問の長さ均し→合格。
- **workdir分離成功**＝`scratchpad/choukai_mock/n3_gh/`（gaiyou/hatsuwaのみ）でmaterialize→既存N3 kadai/point/sokuji配置は無傷。
- **mock/13ファイル全確認済**：gaiyou_N3・hatsuwa_{N3,N4,N5}・kadai_{N3,N4,N5}・point_{N3,N4,N5}・sokuji_{N3,N4,N5}。
- **★次の一手（別フェーズ・指示待ち）**＝(a)一意性Excel再生成（quality_excel.py・模試_N3に概要理解/発話表現シート追加＝**ユーザーがExcelを開いていてN5がロックされ書込失敗中→閉じてもらってから再実行**。日本語シート名/本番試験順/本文列出力の改修は反映済）(b)在庫Excel（gaiyou30/hatsuwa40追加＝要確認）(c)結線（CHOUKAI_{KADAI,POINT,GAIYOU,HATSUWA,SOKUJI}_MOCK rehydrate＋index＋daimon HAS_MOCK_POOL＋MockScreen聴解mock優先＋番人＋package.json→rebuild/tsc/npm test）(d)音声TTS（有料・D1再承認）。**現状=配置済み未結線＝アプリ非表示・学習汚染なし・push/ビルド未実施**。
- 作業物＝scratchpad/choukai_mock/n3_gh/（mock_gaiyou_N3・out_hatsuwa）。**未コミット**。

## ▶▶ 2026-08-31 (旧LIVE)＝N3 概要gaiyou30＋発話hatsuwa40 作問 実行中（当セッション・音声抜き先行）
- **範囲＝N3のみ gaiyou30＋hatsuwa40＝70問**。これで聴解mock全13ファイル完成（残ゼロ）。音声/結線/push/ビルドは別フェーズ。
- **専用workdir＝`scratchpad/choukai_mock/n3_gh/`**（既存N3 kadai/point/sokuji配置を上書きしないため。ここには mock_gaiyou_N3.json と out_hatsuwa.json だけ置く→materializeは gaiyou/hatsuwa のみ生成）。
- **Opus 2体 並列起動済（各体即Write）**：
  - G `a01c45e654abb4a3d`＝gaiyou30（N3-C-G-0701〜0730・独話・最終item配列・genre8均等/q_type3種各10・帯190-284・語彙マッチ回避=正解言い換え/誤答に本文語）→`n3_gh/mock_gaiyou_N3.json`
  - H `a09813620635026e3`＝hatsuwa40（draft {function,scene,axis,script,correct,distractors[2],pos}・帯27-47・攻略耐性4原則・依頼≤10/職場≤8・pos 14/13/13）→`n3_gh/out_hatsuwa.json`
- **返却後の工程**：mock_verify.py（gaiyou N3・帯190-284は+10%対象外＝据置）＋daimon_solvability.py --draft（gaiyouは既存弱点=語彙マッチ/最長高め→言い換え徹底を確認）／hatsuwa_build.py dry-run（致命0/攻略耐性/重複0）→`mock_materialize.py N3 scratchpad/choukai_mock/n3_gh`→`content/problems/choukai/mock/{gaiyou,hatsuwa}_N3.json`配置→一意性Excel（自己申告無=色なし見込み）＋在庫Excel。**結線・音声・push・ビルドは別承認**。

## ▶▶ 2026-08-31 (次の一手・ユーザー指示「残りの概要と発話も模試問題作成して」→ その前に/clear)＝N3 概要gaiyou30＋発話hatsuwa40 作問
- **範囲＝N3のみ gaiyou30（公式3×10・N3のみの新規大問＝これまで未作成）＋hatsuwa40（公式4×10）**。音声/結線/push/ビルドは別フェーズ。これで聴解mock全13ファイル完成（残ゼロ）。
- **/clear後の一手（この節＋§3§4＋下記md節だけ読めば実行できる）**：
  1. 一次情報を確認＝gaiyou学習プール構造 `content/problems/choukai/gaiyou_N3.json`（1item schema・独話/設問形式）／hatsuwa draft実例＝`scratchpad/choukai_mock/out_hatsuwa.json`(N4分・完了済)＋`mock_materialize.py do_hatsuwa`／ツール＝`tools/choukai/{hatsuwa_build.py,skeleton_tag.py,daimon_solvability.py,mock_verify.py,mock_materialize.py}`。md該当節＝発話 `md/聴解_作問フロー.md` L100-119(攻略耐性4原則)・概要は§3§4本inflight＋solvability節L147-153。
  2. **帯（確定・§3）**＝gaiyou_N3=**190–284**（公式帯・+10%対象外）／hatsuwa N3=状況文全体 **27–47**（`hatsuwa_build.py` BAND確認）。
  3. **骨組み（§4）**＝概要 genre(8:健康体/生活くらし/社会自然/仕事/学び/モノサービス/文化行事/趣味旅食)＋q_type(何について/主張/タイトル)分散・`skeleton_tag.py check`各型≤35%。発話 function/scene/axisローテ・攻略耐性ゲート(最長≤35%/依頼形≤35%/形分離≤65%)。
  4. **作問**＝Opus波・各体即Write。gaiyou30＝最終item配列→`mock_gaiyou_N3.json`（id N3-C-G-0701〜0730・独話中心・全体主張/話題を問う・部分語流用ダミー・語彙マッチ回避）。hatsuwa40＝draft形式 {function,scene,axis,script,correct,distractors[2],pos}→`out_hatsuwa.json`（上書き注意＝N4分と別workdir or 別名で。materializeはlevelで振るのでworkdir分離が安全）。
  5. **機械ゲート**＝gaiyou:`mock_verify.py <file> gaiyou N3`＋`daimon_solvability.py --draft <file> gaiyou N3`（gaiyouは既存弱点=語彙マッチ/最長高め→正解言い換え徹底）。hatsuwa:`hatsuwa_build.py` dry-run（致命0/攻略耐性/重複0）。
  6. **materialize**＝`mock_materialize.py N3 <workdir>`（gaiyou→do_content・hatsuwa→do_hatsuwa pos踏襲）→`content/problems/choukai/mock/{gaiyou,hatsuwa}_N3.json`。**⚠workdirに mock_kadai_N3.json / sokuji_draft/draft_N3.json / mock_point_N3.json があるとkadai/sokuji/pointも再materializeされ既配置を上書き→gaiyou/hatsuwaだけ別workdirか、pointでやった様にwrap+norm_itemを直接呼んで単一大問だけ書くのが安全**。
  7. 一意性Excel再生成（quality_excel.py・自己申告無=色なし見込み）＋在庫Excel（stock_excel.py MOCKに gaiyou30/hatsuwa40 追加＝要確認）。**結線・音声・push・ビルドは別承認**。手本＝N5/N4 hatsuwa（hatsuwa_build通過実績）・point/kadaiのcontent配置。

## ▶▶ 2026-08-31 ✅N3 ポイント理解 point60 作問 完了・配置済（当セッション・音声抜き・未結線）
- **✅60問 生成・修正・全ゲート通過・content配置 完了**＝`content/problems/choukai/mock/point_N3.json`（pool='mock'・ID N3-C-P-0701〜0760・languages['ja']・top{schema,daimon,level,languages,items}）。B1 0701-30／B2 0731-60。
- **最終ゲート**：mock_verify致命0（帯179-269・min181/med212/max247）／daimon_solvability=**✅攻略耐性・ワンパターン良好**（最長25%[基25]・語彙マッチ15%・正誤差+0.5・台本重複0・選択肢重複0・設問3%・係0留守0）。
- **★修正1件**：初回B1(0701-30)が会話本文モーラ短すぎ27問（body_text=導入/設問行除外の会話部のみ計測ゆえagent自己計測より厳しい）→両agent差し戻しで延長（B1 27問）＋正解単独最長16問（B1:9/B2:7）の選択肢長均し。再ゲート全通過。
- **検品クリーン**：観点kanten均等12/12/12/12/12（なぜ/いつ/いくつ/気持ち/どれ）・全問choices4/answerIndex0・半角括弧残0・係残0・裸漢字0・uniqRisk自己申告0（全問自信）。
- **一意性Excel再生成済**＝`一意性チェック_模試_N3.xlsx`（point聴解は自己申告無=色なし・黄21は過去の文字語彙/文法mock分）。
- 作業物＝scratchpad/choukai_mock/（out_point_N3_B1/B2・mock_point_N3）。**未コミット・未結線＝アプリ非表示・学習汚染なし。結線・音声・push・ビルドは別フェーズ（指示待ち）**。

## ▶▶ 2026-08-31 (旧LIVE)＝N3 ポイント理解 point60 作問（完了・上記へ）
- **範囲＝N3 point 60問のみ**（唯一の未作成聴解mock大問。N5/N4 pointは配置済・N3はkadai60/sokuji90済／残gaiyou30/hatsuwa40は別途）。音声/結線/pushは別フェーズ。
- **帯＝point_N3=179–269（据置・+10%対象外／MOCK_X11に無し）。中央≈224。** ID＝N3-C-P-0701〜0760。観点kanten均等 なぜ/いつ/いくつ/気持ち/どれ 各12＝計60。場面8分散。full ruby（除去しない=ユーザー決定）。
- **Opus 2体 並列起動（各体即Write・最終item配列・answerIndex0・kantenフィールド付き）**：
  - B1 `aec54148976939443` ＝ point30（N3-C-P-0701〜0730・観点6×5・場面 会社/学校/店/家 中心）→`scratchpad/choukai_mock/out_point_N3_B1.json`
  - B2 `ae97dcd988d479e0f` ＝ point30（N3-C-P-0731〜0760・観点6×5・場面 病院/交通/公共/地域 中心）→`scratchpad/choukai_mock/out_point_N3_B2.json`
- **返却後の工程**：B1+B2連結→`mock_point_N3.json`→`mock_verify.py mock_point_N3.json point N3`＋`daimon_solvability.py --draft mock_point_N3.json point N3`→`mock_materialize.py N3 <workdir>`（point生成→content/problems/choukai/mock/point_N3.json）→一意性Excel。**結線・音声・push・ビルドは別承認**。手本＝N4 point（scratchpad/choukai_mock/mock_point_N4.json・example_point.json）。
- 現状=未作成→生成中。配置後も未結線＝アプリ非表示・学習汚染なし。



## ▶ タスク（ユーザー指示 2026-08-31「クリアして聴解模試問題作成へ」）
文字語彙5大問・文法3大問・読解4大問に続き、**聴解5大問の模試専用プール(pool='mock'・初見)**を新設する。他大問と同じ設計思想（公式出題数×10回分・全問ユニーク・学習と分離・模試は初見）。**聴解は音声生成を伴う＝テキスト大問より重い**（TTS実費が発生・要見積り）。

## ▶ 公式出題数×10（`tools/mock_stock.py` BP・実読済 2026-08-31）
| 大問 | N5 | N4 | N3 | ×10(mock) |
|---|--:|--:|--:|---|
| 課題理解 kadai | 7 | 8 | 6 | 70/80/60 |
| ポイント理解 point | 6 | 7 | 6 | 60/70/60 |
| 概要理解 gaiyou | 0 | 0 | 3 | -/-/30 |
| 発話表現 hatsuwa | 5 | 5 | 4 | 50/50/40 |
| 即時応答 sokuji | 6 | 8 | 9 | 60/80/90 |
| **計/レベル** | 24 | 28 | 28 | **N5:240 N4:280 N3:280＝約800問** |

**★約800問＝各問に音声。TTSは有料ゆえ D1（1000円超は事前見積り承認）＋D2（実費報告）必須。まず見積りをユーザーに提示。**

## ▶ ID帯・配置（[[listening-id-band-convention]]）
- 聴解mockは **0701-1000帯**（0001-0500一般/0501-0700枯渇/0701-1000模試）。pool.ts の practicePool と衝突しないこと。
- 配置＝`content/problems/choukai/mock/{kadai,point,gaiyou,hatsuwa,sokuji}_{N5,N4,N3}.json`（gaiyouはN3のみ）。pool='mock'。既存学習＝`content/problems/choukai/{daimon}_{lv}.json`直下。

## ▶ /clear後の一手（次セッションが最初に読むもの）
1. **正本フロー**＝`md/聴解_作問フロー.md`（70k・**着手時に1回Read**・毎回はロードしない）＋`tools/choukai/`（hatsuwa_build.py・daimon_solvability.py・skeleton_tag.py 等）。
2. **聴解メモリ群を先に確認**（設計制約）：
   - [[choukai-authoring-flow]] 手順・260問体制／[[choukai-audio-pipeline]] Gemini2.5Flash本採用・プロンプト3本柱・独話Leda/男性Orus／[[choukai-app-audiochoices]] 番号選択・正解位置は音声に焼込み。
   - 共通番人＝[[choukai-kakari-ban-and-dedup-common]] 係禁止＋重複禁止(選択肢セットも)／[[choukai-content-solvability-metrics]] 攻略耐性(語彙マッチ/最長/本文一致差/台本重複=daimon_solvability.py)／[[choukai-skeleton-params]] 骨組み(課題develop8/ポイントkanten/概要genre+q_type・番人skeletonBalance.test.ts)。
   - 即時応答＝[[sokuji-not-morality-test]] 不正解は言語的理由のみ・返しが開く機能作らない／[[sokuji-answer-position-balanced]] ①②③均等(旧「必ず①」失効)。
   - 発話＝攻略耐性設計(hatsuwa_build.py)。
   - 音声素材＝[[choukai-official-reference-audio]] 参考音-18.9dB≈現行-20dBFS／[[test-audio-canonical-folder]] scratchpadに残さず聴解パイロットへ・絶対パス報告／TTSは[[tts-no-retry-single-call]] リトライ厳禁・1コール固定。
3. **模試共通ルール**（他大問と同じ）：全問ユニーク(10回横断で重複0)＋[[mock-cross-daimon-no-word-reuse]]（同一回内で同語を複数大問に出さない・プール間の重複は可）＋[[uniqueness-self-declaration-in-generation]] 自己申告(uniqRisk/uniqNote)＋[[content-borderless-no-names]] 役割ベース。品質が命＝[[quality-critical-gen-use-opus]] Opus・検証は機械のみ（ユーザー指示なら反証エージェント無し）。
4. **結線パターン**＝直近の読解/文法mockと同型（rehydrate `*_MOCK`＋index export＋daimon HAS_MOCK_POOL＋MockScreen mock優先fallback＋番人新設＋package.json＋rebuild→tsc→npm test→在庫Excel→一意性Excel）。聴解は audioChoices/番号選択の特殊性に注意（[[choukai-app-audiochoices]]）。
5. **音声配信境界**＝音声はビルド/OTAのどちらで実機に載るか要確認（[[merge-pages-into-build-workflow]] 音声URL構造・[[content-ota-vs-ui-build]]）。push/ビルドはユーザー明示指示のみ。

## ★決定（2026-08-31 ユーザー選択）＝「作問だけ先行・音声は後で」
- **進め方**＝全800問の**テキスト作問＋結線＋番人＋Excel を先行**。**TTS音声生成（有料・目安¥1,700/上限¥2,500）は仕上がりを見てから別途D1承認**。
- **費用見積り提示済**：Gemini2.5Flash TTS・パイロット実績13本=$0.18(≒28円)→800本換算 約$11≒¥1,700(上限¥2,500)。**今フェーズは有料API不使用**。
- **今フェーズの工程**：(1)既存choukai content構造を一次情報確認(schema/大問別) (2)md/聴解_作問フロー.md 該当節Read (3)模試設計確定(公式×10・全問ユニーク・大問横断no-word-reuse・sokuji言語的理由のみ・skeletonバランス) (4)Opus波で作問+各体即Write (5)機械検証(daimon_solvability/tts_lint/係禁止/重複) (6)結線(rehydrate CHOUKAI_MOCK群+index+daimon HAS_MOCK_POOL+MockScreen mock優先+番人+package.json) (7)rebuild→tsc→npm test→ランタイム実測 (8)在庫Excel+一意性Excel。**音声=別フェーズ**。
- **音声フェーズ(後日)**＝tts_script.py→gen_choukai_json.py系でmp3生成→0701-1000帯配置→URL結線。**着手前にD1再見積り+承認**。tts_lint/係→スタッフ置換/番号固定クリップ流用は既存パイプライン踏襲([[choukai-audio-pipeline]])。

## ★確定 設計方針（2026-08-31 ユーザー承認済・これで作問する）

### 1. 問題数（公式×10・大問横断ユニーク）＝計800
| 大問(記号) | N5 | N4 | N3 |
|---|--:|--:|--:|
| 課題 kadai(K) | 70 | 80 | 60 |
| ポイント point(P) | 60 | 70 | 60 |
| 概要 gaiyou(G) | — | — | 30 |
| 発話 hatsuwa(H) | 50 | 50 | 40 |
| 即時 sokuji(S) | 60 | 80 | 90 |
| 計 | 240 | 280 | 280 |

### 2. 配置・ID・スキーマ
- `content/problems/choukai/mock/{kadai,point,gaiyou,hatsuwa,sokuji}_{N5,N4,N3}.json`（gaiyouはN3のみ・計13ファイル）。`pool:"mock"`・`languages:["ja"]`（翻訳は後日・読解mock同様en/ne追加可）。
- ID＝`N{級}-C-{記号}-0701`〜（模試帯0701-1000。一般0001-0700と非衝突）。設問id＝`<id>-q1`。
- スキーマ＝**既存学習プールと同一**（top: schema/daimon/level/languages/items。item: id/level/category:"choukai"/type:"listening"/subtype/title/scenario|scene/script/audio:true/questions:[{id,q,choices,answerIndex,i18n:{ja:{}}}]/i18n/骨組みタグ）。**hatsuwa/sokujiは choices=3・audioChoices:true・q:""**（内容大問は choices=4）。**audio:true は付けるがmp3は後フェーズ**。

### 3. モーラ帯（狙い＝公式中央値。**課題だけ下限上限とも×1.1**。他大問は公式帯そのまま）
| 大問 | N5 | N4 | N3 |
|---|:--|:--|:--|
| **課題 +10%** | **116–173**(中央≈144) | **230–344**(≈287) | **284–425**(≈354) |
| **ポイント(N5N4 +10%)** | **164–245**(≈205) | **193–289**(≈241) | 179–269(据置) |
| 概要 | — | — | 190–284 |
| 発話(状況文全体) | 20–47 | 20–47 | 27–47 |
| 即時(発話1文) | 21–31 | 19–29 | 16–24 |
- **+10%帯の対象（mock専用）＝課題 全級(kadai_N5/N4/N3)＋ポイント N5・N4のみ(point_N5/point_N4)**。いずれも floor_080/ceiling_120 を×1.1。**point_N3は据え置き**(179–269)。他大問(概要/発話/即時)は公式帯そのまま。
- **実装**＝検証時 `mora_check.py`/`merge_and_gate.load_bands` の対象キー(kadai_N5,kadai_N4,kadai_N3,point_N5,point_N4)帯を×1.1で上書き（mock専用のoverride定数。**既存 official_mora_baseline.json は改変しない**＝既存据え置きゲート保護）。作問プロンプトにも「対象大問は公式中央×1.0〜1.1（帯 上記）」と明示。

### 4. 骨組みタグの狙い（番人 `python tools/choukai/skeleton_tag.py check`＝各型≤35%）
- 課題 develop(8): 上書き/条件順序/消去/まず次/追加/二者択一/断って代案/勘違い訂正 を分散
- ポイント kanten(5): なぜ/いつ/いくつ/**気持ち(必須)**/どれ
- 概要 genre(8: 健康体/生活くらし/社会自然/仕事/学び/モノサービス/文化行事/趣味旅食)＋q_type(何について/主張/タイトル)
- 発話 function/scene/axis ローテ（依頼一辺倒×・攻略耐性ゲート＝最長≤35%/依頼形≤35%/形分離≤65%・`hatsuwa_build.py`）
- 即時 function(15分類・等分でなく公式頻度配分・`function_ledger.py`/`sokuji_build.py`。目安=md§即時参照)

### 5. ダミー・品質（大問別・md/聴解_作問フロー.md 該当節を作問時にエージェントへ埋込む）
- 課題＝時系列・主体切り＋条件変更で一意化。設問型「まず何を」偏らせない・レベル差=間接性（md L121-）
- ポイント＝観点1つ・本音/真の理由を最後（md L136-）
- 概要＝全体主張・部分語流用ダミー
- 発話＝攻略耐性4原則（長さ均等/正解形ローテ/同形ダミー主軸/テンプレ解体。md L100-119）
- 即時＝語かぶり＋意味/時制/立場ズレ・道徳のわな厳禁・自足性・第2正解なし（md L70-98）

### 6. 共通規律
全問ユニーク(10回横断0重複)／大問横断no-word-reuse(結線でMockScreen usedWordsに聴解も載せる)／一意性自己申告(uniqRisk/uniqNote)／個人名なし役割ベース／係→「お店の人」等アクセント崩れ語回避／全角括弧／熟字訓誤読回避／場面8カテゴリ分散／ルビ=素で作問→モーラ確定→最後に対象級以上へ付与(別パス)。品質が命=Opus・検証は機械のみ(反証エージェント無し)。

### 7. 工程（音声抜き・読解mock同型）
Opus波で各体即Write → 機械検証(mora_check+skeleton_tag check+sokuji_build/hatsuwa_build+係/完全一致/近似重複/かな漏れ) → 結線(rehydrate `CHOUKAI_{KADAI,POINT,GAIYOU,HATSUWA,SOKUJI}_MOCK`＋index export＋daimon HAS_MOCK_POOL＋MockScreen mock優先fallback＋番人新設＋package.json) → rebuild→tsc→npm test→ランタイム実測(mock隔離) → 在庫Excel(stock_excel.py MOCKに聴解5大問追加)＋一意性Excel(quality_excel.py)。**push/ビルドは指示待ち**。

### 8. 音声は別フェーズ（後日・D1再承認）
テキスト完成後 TTS実費(目安¥1,700/上限¥2,500・Gemini2.5Flash)再見積り→承認→`tts_script.py`→`gen_choukai_json.py`系でmp3生成→0701-1000帯配置→URL結線。係→スタッフ置換・番号/なんと言いますか固定クリップ流用は既存踏襲([[choukai-audio-pipeline]])。

## ★/clear後の一手（N5から作問）
ユーザー要望＝**設計確定後まず/clearしてトークン節約→N5から作問**。/clear後の順序：
1. 本inflight（この設計＝正本）を読む。追加で作問時のみ `md/聴解_作問フロー.md` の該当節（課題L121-135・ポイントL136-146・発話L100-119・即時L70-98・攻略耐性L147-154・チェックリストL198-210・新規フローL211-229）を該当大問ぶんだけRead。
2. **N5作問**（kadai70/point60/hatsuwa50/sokuji60＝240問）＝Opus波（B2束ね・各体即Write・scratchpad/choukai_mock/out_*.json）。発話/即時はドラフト形式(§md)→`hatsuwa_build.py`/`sokuji_build.py`でゲート。内容大問はmock_check/skeleton。
3. 機械検証→mock/へ配置→（N4/N3も同様）→結線→番人→rebuild→tsc→npm test→Excel。**音声・push・ビルドは別承認**。
手本＝[[dokkai-mock-inflight]]（読解mockの生成波→機械検証→結線→番人→Excel の完了実績）。

## ▶▶ 2026-08-31 ✅N5作問 完了（当セッション・音声抜き・未結線）
- **✅240問 生成・機械QA・配置 完了**＝`content/problems/choukai/mock/{kadai,point,hatsuwa,sokuji}_N5.json`（pool='mock'・ID N5-C-{K,P,H,S}-0701帯・languages['ja']・top-level {schema:1,daimon,level,languages,items}）。
  - 課題70(A1 0701-0735/A2 0736-0770)・ポイント60(B1 0701-0730/B2 0731-0760)・発話50(0701-0750)・即時60(0701-0760)。
  - **ゲート全通過**：mock_verify 致命0（スキーマ/choices/answerIndex/pool/ID帯/mora）／daimon_solvability＝課題(語彙19%・正誤差+0.7・台本重複0・留守0・最長44%※)／ポイント(語彙8%・**最長15%**・攻略耐性良好)／sokuji_build 致命0(近似重複0)／hatsuwa_build 致命0(攻略耐性 最長26/依頼形10/形分離38・分散良好)。
  - **正解位置**：即時20/20/20・発話17/17/16（materializeで均等割当・音声焼込み用）。content大問はanswerIndex=0(実行時シャッフル)。
  - **骨組み**：課題develop正準8値(欠0・最大14%)・ポイントkanten 5観点均等12/12/12/12/12(気持ち有)・場面8カテゴリ均等。
  - ※課題最長44%は指標のタイ+answerIndex0起因の過大計上（単独最長19%=ランダム同等・実効length edge軽微）。ポイントは誤答延長で15%へ低減済。
  - **新ツール**：`tools/choukai/mock_verify.py`（content mock検証・×1.1帯）／`tools/choukai/mock_materialize.py`（draft→item・pool/ID/位置割当）。生成物=scratchpad/choukai_mock/（out_*.json・spec_*.md・example_*.json）。
- **★N5の残作業（未実施・別ステップ）**：(1)N4/N3作問（同フロー）(2)結線（rehydrate CHOUKAI_{KADAI,POINT,HATSUWA,SOKUJI}_MOCK＋index＋daimon HAS_MOCK_POOL＋MockScreen mock優先＋番人＋package.json）→rebuild→tsc→npm test→ランタイム実測 (3)在庫Excel＋一意性Excel(uniqRisk自己申告=全体ほぼ無=agents全問自信) (4)音声フェーズ(D1再承認)。**現状=配置済み未結線＝アプリ非表示・学習汚染なし（安全な中間状態）。push/ビルド未実施。**
- **手本（結線）**＝直近の読解/文法mock（rehydrate関数化＋index＋daimon HAS_MOCK_POOL＋MockScreen mock優先fallback＋番人新設＋package.json）。聴解は audioChoices/番号選択の特殊性に注意。
- **✅一意性Excel 生成済（当セッション）**＝`一意性チェック_模試_N5.xlsx`（プロジェクト直下・.gitignore・大問別シートに聴解4大問 kadai70/point60/hatsuwa50/sokuji60 追加）。**聴解は全問 自己申告=一意（uniqRisk無・機械ゲート＝別解/重複/攻略耐性 全通過）＝色なし**。ユーザー指示「あやしいと分かっている問題だけ色付け・分からなければスキャン検品不要」→**私が特定した怪しい聴解問題は無し＝検品せず現状維持**（最終目視レビューはユーザー）。quality_excel.py を聴解対応に拡張済（設問=`q`・正解=`answerIndex`）。黄21は過去の文字語彙/文法mock分（聴解ではない）。
- **⚠未コミット（当セッション成果）**＝content/problems/choukai/mock/{kadai,point,hatsuwa,sokuji}_N5.json＋tools/choukai/{mock_verify.py,mock_materialize.py}＋tools/quality_excel.py拡張＋memory。**push/ビルド未実施・要ユーザー指示**。一意性Excelは.gitignoreで非コミット。

## ▶▶ 2026-08-31 (旧LIVE)＝N5作問 実行中（当セッション・音声抜き先行）
- **一次情報確認済**：既存choukai schema（例＝scratchpadの example_{kadai,point,hatsuwa,sokuji}.json）／mora baseline（official_mora_baseline.json）／ビルドツール（sokuji_build/hatsuwa_build は**正本(学習)プールにappend専用＝mock非対応**→**dry-runゲートのみ使用・mock materializeは自前**）。
- **mock mora帯（+10%override＝N5該当）**：kadai_N5=**116–173**（baseline floor105/ceil157×1.1）・point_N5=**164–245**（149/223×1.1）・hatsuwa=18–47・**sokuji_N5=14–27**（※inflight §3表の「21–31」は旧帯＝失効。一次情報＝sokuji_build BAND N5=(14,27)/公式中央20を採用）。
- **エージェント計画（6体・Opus・各体即Write・音声抜き・ルビはインライン直書き=N5全漢字＋機械mora検証で担保）**：
  - kadai70＝A1(35 scene会社/学校/店/家)＋A2(35 scene病院/交通/公共/地域)→out_kadai_A{1,2}.json（最終item schema配列・answerIndex0）
  - point60＝B1(30 前半scene)＋B2(30 後半scene)→out_point_B{1,2}.json
  - hatsuwa50＝C(1体)→out_hatsuwa.json（hatsuwa_build draft形式 {function,scene,axis,script,correct,distractors[2],pos}）
  - sokuji60＝D(1体)→sokuji_draft/draft_N5.json（sokuji_build draft形式 {function,script,choices[3],correct_text,answer_type}）
  - スペック＝scratchpad/choukai_mock/spec_{kadai,point,hatsuwa,sokuji}.md
- **次工程（エージェント返却後）**：機械ゲート（content=daimon_solvability --draft＋mock_mora×1.1＋skeleton/scene/qtype ledger／発話即時=hatsuwa_build・sokuji_build dry-run）→materialize（pool='mock'・ID 0701帯・answerIndex ①②③均等[発話即時]）→content/problems/choukai/mock/配置→結線→番人→rebuild/tsc/npm test→在庫Excel＋一意性Excel。**音声・push・ビルドは別承認**。

### ★2026-08-31 N5生成 進捗（当セッション）＝6体すべて生成完了・ゲート通過中
- **即時sokuji 60**＝sokuji_build dry-run **致命0**（近似重複10→作り直し済）。draft=scratchpad/choukai_mock/sokuji_draft/draft_N5.json。**materialize待ち**（pool=mock/ID N5-C-S-0701〜/answerIndex ①②③均等は自前で）。
- **発話hatsuwa 50**＝hatsuwa_build dry-run **致命0・攻略耐性/分散良好**（状況/選択肢セット重複11→作り直し済）。draft=out_hatsuwa.json。**materialize待ち**（pos踏襲でmock化）。
- **ポイントpoint 60**（B1 0701-0730/B2 0731-0760）＝mock_verify **致命0**・観点均等・モーラ帯内。solvability=語彙8%/正誤差+0.3良好。※「最長63%」は指標のタイ+answerIndex0起因の過大計上（単独最長25%=ランダム同等）→突出長2問(0701/0723)のみ長さ均し中。
- **課題kadai 70**（A1 0701-0735/A2 0736-0770）＝mock_verify **致命0**・qtype/develop分散良好。solvability語彙20%/正誤差+0.7良好・台本重複1ペア(0752/0754)＋留守1(0766)＋突出長2(0709/0735)を修正中。
- **修正中の3体**：A1(a2900b0d 長さ2問)・A2(ac96f7ec 台本重複+留守)・B1(a28dea6b 長さ2問)。→戻り次第 再ゲート→materialize。
- **ツール新設**＝`tools/choukai/mock_verify.py`（content大問のmock検証・kadai_N5/point_N5帯×1.1）。スペック＝scratchpad/choukai_mock/spec_*.md。例＝example_*.json。

## ▶▶ 2026-08-31 (LIVE)＝N4作問 実行中（当セッション・音声抜き先行・N5と同フロー）
- **6体 Opus 並列起動済（各体即Write・full ruby付き・答えchoices[0]/answerIndex0）**：
  - kadai80＝A1(0701-0740・会社/学校/店/家)＋A2(0741-0780・病院/交通/公共/地域)→out_kadai_A{1,2}.json
  - point70＝B1(0701-0735・前半場面)＋B2(0736-0770・後半場面)→out_point_B{1,2}.json
  - hatsuwa50＝out_hatsuwa.json（draft {function,scene,axis,script,correct,distractors[2],pos}）
  - sokuji80＝sokuji_draft/draft_N4.json（draft {function,script,choices[3],correct_text,answer_type}）
- **N4帯（確定）**：kadai_N4=**230–344**(中央287)・point_N4=**193–289**(中央241)・hatsuwa=**18–47**・sokuji_N4=**18–33**（sokuji_build BAND N4・official_baseline floor/ceil×1.1はkadai/point）。
- **ルビ方針（★ユーザー決定 2026-08-31＝ルビ除去いらない）**：エージェントが付けた**全漢字ルビをそのまま使う**（N5と同じ・級別ルビ除去はしない）。作成した ruby_strip_level.py は削除済（使わない）。FORCE_KANA(日付/熟字訓/異読)は音声フェーズで別途担保。
- **次工程（6体返却後）**：out_kadai_A1+A2→mock_kadai_N4.json / B1+B2→mock_point_N4.json 連結 → mock_verify(kadai/point) + daimon_solvability --draft + hatsuwa_build/sokuji_build dry-run → mock_materialize N4 → content/problems/choukai/mock/{kadai,point,hatsuwa,sokuji}_N4.json 配置。**次はN3(280)。結線は全級テキスト完成後に一括**。

## ▶▶ 2026-08-31 ✅N4作問 完了・配置済（当セッション・音声抜き・未結線）
- **✅280問 生成・修正・全ゲート通過・content配置 完了**＝`content/problems/choukai/mock/{kadai80,point70,hatsuwa50,sokuji80}_N4.json`（pool='mock'・ID N4-C-{K,P,H,S}-0701帯・languages['ja']・top {schema,daimon,level,languages,items}）。
  - 課題80(A1 0701-0740/A2 0741-0780)・ポイント70(B1 0701-0735/B2 0736-0770)・発話50(0701-0750)・即時80(0701-0780)。
  - **最終ゲート**：mock_verify 課題致命0(帯230-344・min231/med269/max343)・ポイント致命0(帯193-289・196/231/274)／daimon_solvability 課題(最長20%・語彙12%・正誤差+0.3・台本重複0)・ポイント(✅良好・最長33%語彙13%)／hatsuwa_build 致命0(攻略耐性 最長28/依頼形8/形分離32・機能最大14%場面最大18%)／sokuji_build バッチ内近似重複0(≥0.45ゼロ)。
  - **正解位置**：即時27/27/26・発話14/18/18（materialize均等割当・音声焼込み用）。content大問(kadai/point)はanswerIndex=0(実行時シャッフル)。
  - **★受容した軽微warning（実害なし）**：(1)課題 選択肢セット重複2＝0758/0759の**時刻選択肢**(10時半/11時…)＝数量曜日と同じ**列挙型の偽陽性**([[choukai-content-solvability-metrics]])。(2)即時1問が既存**学習**プールに0.50類似（模試バッチ内はユニーク・別場面でコピーでない・materializeを妨げない）。
- **✅ルビ点検 完了（クリーン）**＝機械スクリーニング `scratchpad/choukai_mock/ruby_check.py`（①裸漢字[話者ラベル男1女1除外]②書式③単漢字辞書照合④複合語pykakasi照合・単漢字は辞書/pkとも不安定ゆえ除外）。実誤り2件を機械修正＝K-0754『一回（かい）→いっかい』・P-0757『一か月（いっかげつ）→一（いっ）か月（げつ）』。①0/②0で完了。④の22語はpykakasi側の誤読でエージェント読みが正(間違→まちが/今年→ことし/番号札→ふだ等)。ruby_check.py はN3/N5にも流用可。
- **★次の一手＝(a)N3作問(280＝kadai60/point60/gaiyou30/hatsuwa40/sokuji90＝概要gaiyouはN3のみ新規)を同フローで or (b)結線（全級テキスト完成後に一括）**。手本＝N5/N4の生成波→修正resume→再ゲート→materialize。**一意性Excel(quality_excel.py)＝聴解は自己申告ほぼ無=色なし見込み・全級完成後にまとめて生成でよい**。**音声・結線・push・ビルドは別フェーズ（指示待ち）**。現状=N4配置済み未結線＝アプリ非表示・学習汚染なし。

## ★2026-08-31 19:05 N4 一次生成280問済・機械ゲート済・修正待ち（履歴・完了済）
- **一次生成280問はscratchpad無事**＝out_kadai_A1/A2・out_point_B1/B2・out_hatsuwa・sokuji_draft/draft_N4（全て18時台・第1世代）。連結済＝mock_kadai_N4.json(80)・mock_point_N4.json(70)。
- **機械ゲート結果（要修正点）＝各体へ修正依頼済み・6体とも診断完了後に429で書込前に中断**。再開（SendMessageで各agentへ「続けて」）で完了する。各体の確定した修正内容：
  - **kadai A1**(a8ab0a1620d56136d)：40問全部モーラ短すぎ(≈140→230-344へほぼ倍化)＋4択長さ均し(正解を最長にしない)。→out_kadai_A1.json
  - **kadai A2**(ad7d440ccc90f8d1a)：13問=正解が最長→均す＋0749/0780を延長。→out_kadai_A2.json
  - **point B1**(a414da76a58ca3010)：EXT過延長を撤回(素はほぼ帯内)・0701芯を圧縮・193未満7問に短いEXT・15問の選択肢均し。→out_point_B1.json
  - **point B2**(a735082ec006010f3)：4問(0736/0737/0753/0756)正解最長を微修正。→out_point_B2.json
  - **hatsuwa**(a85d2df1851bd1d94)：重複9件(#2資料拝見/#7お荷物/#13ここ座って/#14図書館写真/#26足ふん/#31先輩手伝/#34お先に/#38ハンカチ/#46市役所)を別題材に。→out_hatsuwa.json
  - **sokuji**(a76ec60e9d422a4fb)：短3(傘玄関/席荷物/駅送り)を+3-6拍・長1-2を圧縮・近似重複5(急行乗換/席許可/買ったばかり/名前間違い/手伝いお礼)を別題材(カード決済/ペン借り/色違い/値段違い/贈り物お礼)に。→draft_N4.json
- **再開後の残工程**：再ゲート(mock_verify/daimon_solvability/hatsuwa_build/sokuji_build)→mock_materialize N4→content/problems/choukai/mock/{kadai,point,hatsuwa,sokuji}_N4.json配置。**次はN3(280)。結線は全級テキスト完成後に一括**。

## ▶▶ 2026-08-31 ✅N3「課題理解＋即時応答だけ」作問 完了・配置済（当セッション・音声抜き・未結線）
- **✅150問 生成・全ゲート通過・content配置 完了**＝`content/problems/choukai/mock/{kadai_N3(60),sokuji_N3(90)}.json`（pool='mock'・languages['ja']・top{schema:1,daimon,level,languages,items}）。※point/gaiyou/hatsuwaは今回作らず（ユーザー指定＝この2大問だけ）。
  - 課題60＝N3-C-K-0701〜0760（A1 0701-30 会社/学校/店/家・A2 0731-60 病院/交通/公共/地域）。即時90＝N3-C-S-0701〜0790。
  - **最終ゲート**：mock_verify致命0（モーラ285/342/401帯[284,425]内）／daimon_solvability=**✅攻略耐性・ワンパターン良好**（最長10%・語彙マッチ18%・正誤差+0.4・台本重複0・選択肢重複0・**正解が単独最長0%**←修正後）／sokuji=バッチ内重複0・道徳のわな無し・function配分どおり・正解位置30/30/30均等。
  - **★受容**：即時の残近似0.52-0.59は文型（〜てもいいですか/誘い/伝聞って）共通の誤検出＝トピック別で採用。即時16-17拍の短文16問は公式範囲16-32内＋番人sokujiBands.test.tsが模試帯モーラを縛らない→採用。課題「留守1」は留守電1問（軽微・N5/N4同様）。自己申告uniqRisk＝全問なし（agents全問自信）。
- **最終検品クリーン**＝両ファイル top schema/daimon/level/langs正・全item pool=mock・件数60/90・全ID一意・choices 4/3・係残存0・半角括弧漏れ0。
- **★次の一手（別フェーズ・指示待ち）**＝(a)結線（`CHOUKAI_KADAI_MOCK`/`CHOUKAI_SOKUJI_MOCK` rehydrate＋index export＋daimon HAS_MOCK_POOL＋MockScreen聴解mock優先分岐＋番人＋package.json→rebuild/tsc/npm test）(b)音声TTS（有料・D1再承認）(c)在庫Excel＋一意性Excel（uniqRisk無=色なし・全級完成後まとめてでよい）。**現状=配置済み未結線＝アプリ非表示・学習汚染なし・push/ビルド未実施**。
- 作業物＝scratchpad/choukai_mock/（out_kadai_A1/A2・mock_kadai_N3・sokuji_draft/draft_N3・build_kadai_A2.py）。**未コミット**。

## ▶▶ 2026-08-31 (旧LIVE)＝N3「課題理解＋即時応答だけ」作問 実行中（ユーザー指示・音声抜き先行）
- **範囲＝N3のkadai60＋sokuji90＝150問のみ**（point60/gaiyou30/hatsuwa40は今回作らない）。他大問と同フロー・音声/結線/pushは別フェーズ。
- **Opus 3体 並列起動（各体即Write・full ruby・素モーラで帯判定）**：
  - K1 `a2501fce50a12db63`＝課題30(N3-C-K-0701〜0730・場面 会社/学校/店/家)→`scratchpad/choukai_mock/out_kadai_A1.json`
  - K2 `ac4924c3bd33d7bf0`＝課題30(N3-C-K-0731〜0760・場面 病院/交通/公共/地域・放送型厚め)→`out_kadai_A2.json`
  - S  `a1a387ab3809221bd`＝即時90(function配分90・道徳のわな厳禁)→`sokuji_draft/draft_N3.json`
- **N3帯（一次確認済）**：kadai_N3 mock=**284–425**（load_bands 258/386×1.1・中央354狙い320-380）／sokuji_N3=**18–32**（sokuji_build BAND・中央23）。develop正準8値=上書き/条件順序/消去/まず次/追加/二者択一/断って代案/勘違い訂正。sokuji function=15分類TAXONOMY。
- **返却後の工程**：out_kadai_A1+A2→`mock_kadai_N3.json`連結 → `mock_verify.py <file> kadai N3`＋`daimon_solvability.py --draft <file> kadai N3` → sokuji=`sokuji_build.py --draft sokuji_draft`(dry-run・近似重複/かな漏れ/function/mora) → `mock_materialize.py N3 <workdir>`（kadai/sokujiのみ生成・sokuji位置①②③均等）→ `content/problems/choukai/mock/{kadai,sokuji}_N3.json`配置。**結線・音声・push・ビルドは別承認**。
- **未結線ゆえ現状はアプリ非表示・学習汚染なし（安全な中間）**。手本＝N5/N4完了実績（本md上部）。

### ▷進捗（2026-08-31 当セッション・全3体 生成完了→機械ゲート→修正中）
- **即時90 ✅ゲート通過**（S `a1a387ab3809221bd`）＝draft_N3.json。バッチ内重複0・道徳のわな無し・function配分どおり（依頼11..謝罪3）。既存学習プールとの完全一致2/0.95/0.72は別題材へ差し替え済（試着・傘忘れ等）。残近似0.52-0.59は文型（〜てもいいですか/誘い/伝聞って）共通の誤検出＝トピック別で採用。16-17拍の短文16問は公式範囲16-32内＋番人sokujiBands.test.tsは模試帯モーラを縛らない→採用。**materialize待ち**。
- **課題60 生成完了・mock_verify致命0**（A1 `a2501fce50a12db63` 0701-30／A2 `ac4924c3bd33d7bf0` 0731-60）＝連結`mock_kadai_N3.json`。モーラ285-401中央342帯内・語彙マッチ28%・正誤差+0.6・台本重複0・develop8値均等。**⚠1点修正中＝正解が単独最長50%(30/60)**（長さで解ける・md違反）→両体へ「誤答を延長し正解を単独最長でなくす」差し戻し済（A1:16問 0702等／A2:14問 0733等・本文/正解/answerIndex不変）。戻り次第 再ゲート(daimon_solvability 最長≤40%目標)→materialize。
- **次工程**＝両kadai戻り→再連結→mock_verify+daimon_solvability再確認→`mock_materialize.py N3 <workdir>`（kadai/sokujiのみ→content/problems/choukai/mock/{kadai,sokuji}_N3.json）→在庫Excel＋一意性Excel。**音声・結線・push・ビルドは別フェーズ（指示待ち）**。

## 直前タスク（完了・参考）
読解模試プール＝[[dokkai-mock-inflight]] ✅完了・🚀v1.1.27(2889)ビルド済(2026-08-31・commit a21dcef9)。手本になる（生成波→機械検証→ルビ別パス→翻訳→結線→番人→Excel→ビルド）。
