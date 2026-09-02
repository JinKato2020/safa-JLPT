# 聴解 音声↔台本 整合監査（並び崩れ・中身違い）— inflight

## 背景・きっかけ（2026-09-02）
ユーザー指摘 `N3-C-K-0117` の音声が支離滅裂。一次情報で判明＝**台本テキストは正しい／音声(mp3)だけが下書きのまま焼き付き**（150問一括生成時にTTSへ渡した原稿と保存原稿がズレた・音声は作成後に中身再生成されていない=534e67f0は圧縮のみ）。仕組みの穴＝「音声の中身が現台本と一致するか」の検査が無い。→ 監査ツールを作る方針。

## 進め方（ユーザー確定＝1→2の順）
1. **窓を絶対時刻でなくアンカー方式へ**（各問題の冒頭ゼリフ=台本raw行0 の読みで区切る）。理由＝現状はタイムスタンプがバッチ後半でドリフトし短いN5クリップの冒頭が隣区間に食い込む→中身違いの大半が誤検出。**私の追加実装のみ・無料。**
2. アンカー方式で絞った suspect だけ **LLM(Claudeサブエージェント)で1件ずつ真偽判定**（台本 vs 起こし窓）。追加課金なし。→ 確定リスト＝再生成対象。

## ★消えない退避先（/clear後はこちらを使う）
- `JLPTアプリ\_audit_work\`（gitignore済・プロジェクト直下＝scratchpadと違い消えない）に退避済み:
  - `_audit_work\kadai\kadai_batch_0X_moji.txt`(01〜07＝**ユーザー有料文字起こし・再取得は再課金**) / `manifest.csv` / `audit_result.csv`
  - `_audit_work\audit_kadai.py`(監査ツール) / `concat_kadai_audio.py` / `concat_choukai_audio.py`
  - ※audit_kadai.py 内のパスはscratchpad固定。_audit_work版を使う時は BDIR を `_audit_work\kadai` に、moji/manifestの参照先も合わせる（またはscratchpadが生きていればそのまま）。
- 連結mp3(大)は退避せず＝assets/audioからツールで再生成可。

## 素材の場所（scratchpad・/clearで消える可能性あり）
- 課題理解の連結音声＋マニフェスト＝`<scratchpad>\kadai_audio_batches\`（kadai_batch_01..07.mp3・manifest.csv・*.txt）。100本ずつ7バッチ。**ユーザーが文字起こし済**＝同フォルダに `kadai_batch_0X_moji.txt`(01〜07)。形式＝`MM:SS`(3桁分も可)時刻行＋テキスト・話者ラベル無し・数字は算用・漢字/かな表記ゆれあり。
- 他4大問の連結音声（**文字起こしはまだ**）＝`<scratchpad>\choukai_audio_batches\{point,gaiyou,hatsuwa,sokuji}\`（各 manifest.csv＋*_batch_XX.mp3）。point7/gaiyou2/hatsuwa8/sokuji10バッチ。
- `<scratchpad>` = `C:\Users\jwpsa\AppData\Local\Temp\claude\c--Users-jwpsa-Documents-desktop-claude-JLPT---\214e62ca-fe7f-438c-89f7-64b386f36828\scratchpad`
- 連結ツール(汎用)＝同scratchpadの `concat_choukai_audio.py`・`concat_kadai_audio.py`。

## 監査ツールの現状 = `<scratchpad>\audit_kadai.py`
- 手法: manifest絶対時刻でクリップ窓を切出し→台本セリフ(会話行・1行目の場面+設問は除外)が起こしに「総一致量(difflib get_matching_blocks和/セリフ長)≥0.72」で在るか＋隣接セリフの起こし位置が戻る(MARGIN=10)=並び逆転。
- **fugashi読み(カタカナ)正規化済**＝かな↔漢字の表記差を吸収(今日/きょう→キョウ)。KNUM+十変換も。
- 判定: cover<0.60=🟠中身違い / 逆転≥1=🔴並び崩れ / それ以外🟢。出力=同フォルダ audit_result.csv。
- **第一次結果(未確定)**: 656本中 正常574 / 🔴並び崩れ49 / 🟠中身違い33。
- **スポット検証で判明した残課題(=次に直す)**:
  - 🔴誤検出源: (a)定型句「ありがとうございます/はい」が別位置に誤マッチ(例 N4-C-K-0148) (b)窓ズレでクリップ冒頭が外れ後半の同語に誤マッチ(例 N3-C-K-0009)。→アンカー方式＋定型句/位置は「長い一致ブロック」限定で低減。
  - 🟠はほぼ窓ズレの偽陽性(短いN5・例 N5-C-K-0007/0002)。音声自体は正常。
- **本物(eyeball確定)**: N3-C-K-0117・N3-C-K-0013・N5-C-K-0064 は実際に並び崩れ。
- **推定(未確定)**: 真の被害は概ね25〜35本前後(大半が並び崩れ)。

## ★進捗 2026-09-02（①アンカー方式=完了）
- `_audit_work\audit_kadai.py` をアンカー方式に改造完了・BDIR=`_audit_work\kadai`(自己完結・mp3不要)。
- 窓決め = 台本raw[0](場面文)の読みを前方単調探索で起こしに位置決め→先頭に揃う一致ブロックで窓開始([anchor_i,anchor_{i+1}))。**汎用イントロ(模試=設問なしの短い定型句 len<28)は時刻窓へフォールバック**(模試の場面文は全問共通で識別不能なため)。
- 目視ダンプ = `_audit_work\dump_kadai.py`(DUMP=id1,id2… で台本↔起こし窓を原文表示)。
- **結果: 正常635 / 🔴並び崩れ15 / 🟠中身違い6 = suspect 21件**(窓決め anchor566/time90)。当初82件の大半は窓ズレ人工物だった。
  - 🔴order(15): N3-0013 N3-0043 N3-0117 N3-0123 N4-0020 N4-0071 N4-0148 N4-0701 N4-0728 N4-0749 N5-0725 N5-0736 N5-0756 N5-0760 N5-0764 （※07xx=模試8件は時刻窓のため要精査）
  - 🟠content(6): N3-0754 N4-0079 N5-0029 N5-0122 N5-0735 N5-0744
  - 明細CSV = `_audit_work\kadai\audit_result.csv`(class/coverage/inversions/method/anchor_size)。

## ★②LLM確定=完了（2026-09-03）
- suspect 21件を私(Opus)が台本↔窓(アンカー窓＋時刻窓の二重確認・独話は核心語のグローバル在否も)で直接照合。→ **本物16 / 誤検出5**。
- 確定リスト＝`_audit_work\kadai\CONFIRMED_regenerate.txt`（理由付き・レベル別内訳あり）。
- 本物16（再生成対象）: 並び崩れ9=N3-0013 N3-0117 N3-0123 N4-0020 N4-0071 N4-0701 N5-0736 N5-0756 N5-0764／内容欠落7=N3-0754 N4-0079 N5-0122 N5-0725 N5-0735 N5-0744 N5-0760。
- 誤検出5（対象外）: N3-0043 N4-0148 N4-0728 N4-0749 N5-0029。
- レベル別: N3=4 / N4=4 / N5=8。テキスト台本は正しい＝直すのは音声のみ。

## ★音声再生成=完了（2026-09-03・kadai 16件）
- **結果**: 16/16 正常生成・尺32〜64秒・LCS0.87〜1.00・assets/audio＋問題/聴解/{lv}/1_課題理解 両方に配置確認。暴走2件(N4-0071/N5-0736)は1回の作り直しで解消(0071 648→50s・0736 139→37s)。
- **実費合計 $0.48＝約73円**（1回目$0.46＋暴走再生$0.02）。旧mp3退避=`_audit_work\old_audio_kadai_2026-09-03\`。
- ⚠**配信は別ステップ**: assets/audioの更新がユーザーに届くには通常の配信(ビルド or publish)が要る＝[[never-build-without-explicit-order]]でユーザー明示指示待ち。私は勝手にビルドしない。

## （旧・詳細ログ）音声再生成の実務メモ（2026-09-03）
- ⚠**--ids はカンマ区切り必須**（スペースだと先頭1件だけ／`gen_choukai_json.py:385` `.split(',')`）。既生成idは `memory/choukai_gen_done.txt` 台帳でスキップ→**再生成には台帳から当該idを除去**（または `--fresh` で台帳全消し）。
- 手順実施済: ①旧mp3 32本(flat16+nested16)を退避=`_audit_work\old_audio_kadai_2026-09-03\{assets,nested}\` ②done台帳から16件除去(2984→2969) ③`python 問題/tools/gen_choukai_json.py --ids <16カンマ区切り>` 走行中(bg id=bl1p9ojku・log=`_audit_work\kadai\regen_log.txt`)。
- 正本=content/problems/choukai(mock/含む)から現行台本読み直し→問題/聴解/{lv}/1_課題理解/ と assets/audio/ に出力。best_take n=1(自動リトライなし)。見積り¥300未満・実費はツールが円報告(D2)。
- **結果(1回目・bl1p9ojku)**: 16/16生成・実費**$0.46=約69円**。14件は尺正常・LCS0.82〜1.00で良好。⚠**暴走2件**=N4-C-K-0071(648.7s・LCS0.55)/N5-C-K-0736(139.3s)＝TTS暴走で長尺化(自動再生成は保留)。
- **暴走2件を1回だけ作り直し中(bg=bwn5frjm4・log=`_audit_work\kadai\regen_runaway2.txt`)**: done台帳から2件除去→`--ids N4-C-K-0071,N5-C-K-0736`再実行。⚠これでも暴走したら**ループ再試行せず**(tts-no-retry)ユーザーへエスカレーション(台本側に暴走誘発要因＝数字/時刻多い可能性→台本微修正 or 手動対応)。
- **完了後**: 新mp3の尺/存在を確認→ユーザーが試聴 or 再文字起こしで解消確認。※再検証には新mp3の連結+文字起こしが要る（ユーザー有料STT）。旧mp3退避先=`_audit_work\old_audio_kadai_2026-09-03\`(戻す時はここから)。

## ★他4大問の音声監査＝クリア後に実施（ユーザー指示 2026-09-03）
- **入力は全部そろっている・プロジェクト内で永続**（scratchpadでない）＝`問題\音声チェック\{sokuji,point,hatsuwa,gaiyou}\`：各に `manifest.csv`＋`*_batch_NN.mp3`＋`*_batch_NN_moji.txt`（ユーザー文字起こし済）。バッチ数=sokuji10/point7/hatsuwa8/gaiyou2。manifest形式=kadaiと同一(batch,index,id,start_sec,start_mmss,dur_sec)。
- **ツール適応方針**（構造を実データで確認済）:
  - **point / gaiyou** = kadaiと同型（audioChoices無=point／gaiyouは独話だがscript=独話本文）。→ `audit_kadai.py` を **daimon/BDIR/SCRIPT源だけ差し替えて流用**（アンカー方式そのまま）。point=会話, gaiyou=独話(話者1)・N3のみ2バッチ。SCRIPT源= `content/problems/choukai/{point,gaiyou}_N?.json`(+mock)。IDコード= P=point, G=gaiyou。
  - **sokuji / hatsuwa** = 短文16-17s・audioChoices=True＝**発話/場面 script ＋ 3択①②③ を連結**した音声。→ **別チェッカーが必要**：script（発話文/場面文）＋`questions[0].choices[0..2]` を heard に照合し、(a)発話一致 (b)3択の存在と①②③順序 を見る。⚠hatsuwaは3択がほぼ同文（語尾/一語違い）＝文字起こしで弁別困難→誤検出注意・閾値要緩め。IDコード= S=sokuji, H=hatsuwa。正解位置は音声焼込み（[[sokuji-answer-position-balanced]]）。
  - 汎用化案: `audit_kadai.py`→`audit_choukai.py <daimon>` にパラメータ化（load_item同様 daimonコード{K,P,G,S,H}→ファイル/mock判定）。kadai系(K/P/G)は現ロジック、短文系(S/H)は簡易照合分岐。
- 監査結果→本物のみ CONFIRMED に追記→同じ再生成フロー（カンマ区切り＋done台帳除去＋退避→gen）。

## ★他4大問の音声監査＝完了（2026-09-03）
- ツール = `_audit_work\audit_choukai.py <daimon>`（point/gaiyou=アンカー被覆・sokuji/hatsuwa=大域presence非循環）。明細CSV=各 `問題\音声チェック\{d}\audit_result.csv`。
- **監査 2440クリップ → 本物4件のみ**（確定=`_audit_work\CONFIRMED_regenerate_4daimon.txt`）:
  - N3-C-P-0148（point・会話スクランブル）/ N3-C-G-0014・N3-C-G-0017（gaiyou・独話欠落）/ N5-C-S-0199（sokuji・発話欠落）。
  - 偽陽性: point並び23→22はecho偽陽性（設問2回言う構造）・sokuji N3-0718はSTT化け。hatsuwa=0。
- 方式の妥当性=検証済: gaiyou良品は独話142〜264字一致／不良は8〜9字＝明確分離。sokuji被覆は0.9〜1.0に密集し不良のみ0.4へ。
- ⚠**再生成は未実施**＝ユーザー承認待ち（TTS有料だが4件¥20未満）。フロー=kadaiと同一。
- ★2026-09-03 ユーザー承認「作り直して」→ **再生成=完了 4/4**（$0.06=約10円）。P0148 55.2s/LCS0.97・G0014 70.7s/LCS0.96・G0017 71.9s/LCS0.89・S0199 12.7s。暴走0。flat+nested両方に配置確認・概要nested 108→110(欠落2埋まる)。旧mp3=`_audit_work\old_audio_4daimon_2026-09-03\`。⚠**配信は別・ユーザー指示待ち**([[never-build-without-explicit-order]])。
- （旧）2026-09-03 再生成 走行ログ（bg=bfk5yd2a5・log=`_audit_work\regen_4daimon.log`）。
  - 実施済: ①旧mp3退避=`_audit_work\old_audio_4daimon_2026-09-03\{flat(4),nested(2:P0148/S0199)}` ②done台帳から4件除去(2985→2981) ③`gen_choukai_json.py --ids N3-C-P-0148,N3-C-G-0014,N3-C-G-0017,N5-C-S-0199`。
  - ※gaiyou 0014/0017 は nested(3_概要理解=108本)に元々欠落（110中2欠）＝監査の裏付け。再生成で flat+nested 両方に出る想定。
  - 完了後: 4/4存在・尺・LCS確認→暴走あれば1回だけ作り直し(--regen-runaway)・それでも暴走ならエスカレーション(ループ禁止)。実費を円報告(D2)。配信は別途ユーザー指示。

## （完了後）次の一手
1. ユーザーへ監査結果報告（本物4件）→ 再生成の承認を得る。
2. 承認後: done台帳(`memory/choukai_gen_done.txt`)から4件除去→`python 問題/tools/gen_choukai_json.py --ids N3-C-P-0148,N3-C-G-0014,N3-C-G-0017,N5-C-S-0199`（カンマ区切り必須）→旧mp3退避→尺/LCS確認。配信は別途ユーザー明示指示。
1. `audit_kadai.py` の窓決めを**アンカー方式**に改造: 各クリップ=台本raw行0(場面+設問)の読みを、前クリップ位置から前方探索して起こし内で位置決め→[start_i,start_{i+1}) を heard に。場面文が似る問題は前方単調探索＋duration推定位置±許容で曖昧回避。フォールバック=絶対時刻。
2. 並び逆転判定を頑健化: 位置は「長い一致ブロック(size≥8等)」のみ採用・定型句(ありがとう/はい/わかりました 等 len<6)は順序解析から除外(既にlen>=6条件あり・要強化)。
3. 再実行→suspect再集計→**残りをLLM(サブエージェント)で真偽判定**(台本 vs heard窓を渡し ok/order/content)。B規律=少数の大きめagentに束ねる。
4. 確定した🔴🟠リスト＝**音声再生成の対象**（再生成はTTS有料・[[tts-no-retry-single-call]]厳守・別途見積り/承認）。テキストは正しいので直すのは音声のみ。
5. 課題理解が固まったら他4大問も同手順（先にユーザーが文字起こし→_moji.txt を各フォルダへ）。

## 注意
- テキスト(台本)・翻訳・OTA配信は正しい。**壊れているのは音声mp3のみ**＝直すのは音声。
- この監査は翻訳プロジェクト(trans-choukai-kadai-inflight)とは別件。翻訳側=配信済みで完了。
