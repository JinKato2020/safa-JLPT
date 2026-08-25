# 言い換え類義 増作2（未カバー全556語）in-flight — 2026-08-24

## 目的
iikaePossible p=1（青セル除外後）なのに content にも EXCEL納品にも無い語を作問。
**N5 91 / N4 65 / N3 400 ＝計556語**。方式＝**生成のみ・EXCEL納品**（反証チェック不要＝ユーザー厳命）。

## 現状
- スペック＝`scratchpad/syn_gen/SPEC2.md`（形式・品質規律）。
- バッチ＝`scratchpad/syn_gen/batches2/{N5_b1,N5_b2,N4_b1,N4_b2,N3_b1..b8}.json`（各 {vocabId,word,reading,meaning,synHint}）。
- 出力先＝`scratchpad/syn_gen/out2/{同名}.json`。
- **走行中＝Opus general-purpose 12体**（N5×2=46/45・N4×2=33/32・N3×8=50each）。各: batch Read→生成→out2へWrite→count返す。

## ✅ 完了（2026-08-24）
- 12体生成→検証（誤答3・answer∉choices・重複/既作成除外）→**352問採用（N5 36／N4 44／N3 272）**。204語は一意作問不可でskip（数詞・束縛形態素・外来語のみ・連続量・第2の正解の恐れ＝割り増ししない方針どおり）。
- ID採番：N5-V-I-0346〜0381／N4-V-I-0445〜0488／N3-V-I-1400〜1671。
- **final_{N5,N4,N3}.json へ append 済**（N5 136／N4 203／N3 572）。※underline∈sentence検査は既存300も辞書形underline慣例のため不採用（弾かない）。
- **納品Excel（新規・別ファイル）＝`c:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ\言い換え類義_増作2_N5-36_N4-44_N3-272.xlsx`**（3シート・既存Excelの列に一致）。検品中Excelはロック中ゆえ上書きせず別ファイル。
- **真カバー率（EXCEL合算）＝N5 85%（残55）／N4 95%（残21）／N3 92%（残128）**。残204＝作問不可語。
- ★岩(n3-v-424)修正＝final_N3反映済。検品中Excelはロックで未反映（閉じたら書く）。

## ✅ 追加（2026-08-24 QA反映＋カバー率シート更新）
- **N3 300問へQA修正20件**（ユーザー指定）＝正解差替14（区切り/続ける/選考/沢山/付いていく/エンジニア/指示した/スピード/点検する/発送する/抑える/響き/勢力/ハイキング・explainも整合更新）／除外5（蒸す・田・中学・笑顔・昼食）／偶々→たまたま（かな化・word/underline/sentence/explain）。**final_N3.json反映＋300問Excelを再構築**（N3シート300→**295行**・岩も反映）。ID詰め直しはせず（gap 1231/1296/1298/1310/1361）。
- **在庫Excel『② カバー率』の言い換え行を352合算＋除外反映で更新済**：問題数 N5 381/N4 488/N3 1666、全IDカバー率 N5 53/N4 73/N3 78%、**真カバー率 N5 86/N4 96/N3 93%**。iikaePossible未改変。
- 現物：300問Excel＝`言い換え類義_新規問題_N5-100_N4-159_N3-300.xlsx`（N3=295）／新規352＝`言い換え類義_増作2_N5-36_N4-44_N3-272.xlsx`。

## ★2026-08-24 LIVE＝N5「正解は級以下」監査（ユーザー厳命・公式に倣う）
- 発端＝ユーザー指摘 n5-v-594 ベッド→寝台（N5学習者が知らない語）。公式基準は「正解・誤答すべて級内」＝一次情報[md/04_言い換え類義.md:167]で「答えがN3語138組は却下」「N5上限≈148-160問」。
- **機械判定は不能**（活用/お接頭/単漢字で誤検出＝55%等の数字は信用しない）。→Opus 3体でLLM監査中。
  - 走行中：a8507788f8d675f35(A_content1 123) / af956d705a21952fe(B_content2 122) / a2d1a66af185e8ce1(C_excel 136)。
  - 入力=`scratchpad/syn_audit/{SPEC.md,N5_wordlist.txt,A/B/C_*.json}`→out/{同名}.json（[{id,verdict:ok|above,offenders}]）。
- 確実に真な所見＝EXCEL新36は大半(寝台/書物/課題/言語/グラス/マガジン…)が上級語で不適。
- ユーザー選択＝「まずN5の実態を見てから」N4/N3判断。N4追加は一意性チェック済（級チェックは別）。
- **✅監査完了（信頼値）**：N5 381問→級内OK 203(53%)／正解が上級=致命 140(37%)／誤答のみ上級 38(10%)。由来別＝content初期 ok72/致命30/誤答21・content後期増作 ok30/致命76/誤答16・EXCEL旧100 ok99/致命0・EXCEL新36 ok2/致命34。out=`scratchpad/syn_audit/out/{A,B,C}*.json`。抜取検査で誤検出ほぼ無し（学習/説明/簡単/危険/客/妻/パーク/言語/課題…は真に上級）。
- **ユーザー決定＝「全部直す（contentも）」**。方針：正解上級140→級内で作り直しor drop／誤答のみ38→誤答差替。
- **✅走行中＝Opus 4体で級内作り直し**（ad540f3591570f67d/affa1dc27b1afab24/a993759949019c22b/aafd78fa556dba3ae）。入力`scratchpad/syn_rework/{SPEC.md,R1..R4.json}`（178問・content143/excel35）→out/R{n}.json（action=fix/drop）。
- **✅完了（2026-08-25）N5級内化**：rework fix58/drop120。反映＝**content synonym_N5 245→155（fix53/drop90）**・**EXCEL final_N5 136→106（fix5/drop30）**＝N5確定 **261問（全問N5語彙で解ける）**。
  - 整形段の要求も処理：pattern正規化（adj_negation_cross→negation_cross）／**sentenceFuri再生成**（furi=stemを全角カッコ化・機械導出・`src/data/dict/sentenceFuri.json`更新）／下線語⊂例文をgit原文からrestore（apply時にunderlineをwordで誤上書きしたバグを修正）。
  - **rebuild.ts済（52files）・番人33/33緑**（synonymFormat/daimon4choices/rehydrate/manifest/validate）。
  - カバー率シート更新＝N5 問題数261・全ID36%・**真55%**（監査前の76%は上級語を誤って分子に含めた過大値。これが正直値）。
  - 確定一覧Excel＝`言い換え類義_N5_級内確定_261問.xlsx`（src=content/EXCEL別）。
  - **contentは出荷済に手入れ＝未コミット・未OTA**（publish-content.ps1で配信・指示待ち）。tsc未実行（データのみ・番人緑）。
- **★次＝N4/N3も同監査**（ユーザー「公式に倣いましょう」）。N4追加は一意性チェック済（級チェックは別）。N4は文レベル(スペース無)・N3は語レベルで、同じ「正解・誤答は級以下」を適用。着手前にユーザー確認（規模：N4≈500・N3≈1900）。

## N3 QA（ユーザー検品・2026-08-25）
- 正解訂正＝計21件（岩含む）final_N3反映＋Excel再構築。Excelの色規約＝**黄FFFFFFCC=正解訂正の印／水色FFCCFFFF=除外**。
- 水色除外13件（n3-v-40/1137汚す/1457/565/607/1148/1484/1579/1463/823/922/1265/1990）→final_N3から削除。
- 現況＝final_N3 **554**（300側295＋新272側259）。増作2 Excel N3シート=259行に更新。カバー率シートN3=問題数1653/全ID77%/真92%。
- ※増作2 ExcelのN5/N4シートは級監査前で陳腐化（N5正本=`言い換え類義_N5_級内確定_261問.xlsx`）。要整理。

## ✅ 2026-08-25 N5/N4 級以下 確定（真の母数＝級内で作れる語＝天井の考え方に統一）
- **N5＝231問確定**（content131＋EXCEL100）。青セル30除外。iikaePossible：covered231をp=1・未カバーの旧p=1（203）をp=0(above_only・可逆)へ→**真母数231・真100%**。counts更新。Excel=`言い換え類義_N5_級内確定_231問.xlsx`。
- **N4＝406問確定**（content225＋EXCEL181）。監査above176→94を対象語だけ級内差替（例商品→物/中央→真ん中/観光→旅行・i18n解説は削除）・**82を除外**（content60/excel22）。番人`synonymFormat.test.ts`のN4件数285→225に更新。iikaePossible：promote37/demote98→**真母数406・真100%**。Excel=`言い換え類義_N4_級内確定_406問.xlsx`。
- 番人全緑（synonymFormat/daimon4choices/validate/rehydrate/manifest/iikaePossible）。カバー率シート②のN5/N4行を真母数=天井・真100%へ更新。
- **contentは出荷済へ手入れ（N5/N4とも）＝未コミット・未OTA**（publish-content・指示待ち）。
- iikaePossibleの`above_only`フラグ＝級内に言い換え語が無く降格した語（可逆）。真の母数の考え方＝「級内で作れる語のみ」。

## ★2026-08-25 N3 級以下 機械監査（完了・未着手の作業あり／ユーザーは/clear後に対応予定）
- **N3は語レベル＝機械判定が有効**（文レベルのN5/N4と違い語を直接照合できる）。
- **判定法（再現可・エージェント不要）**：「N3以下＝`src/data/shared/vocab.json`(3541)」「上級＝`src/data/dict/dictExt.json`['vocab']（アプリ自身のN1/N2辞書4508語）」の2辞書で挟む。answer/choicesの各語(漢字+送り/カタカナ)を、活用は語幹一致で戻し、お/ご接頭を剥がして照合。vocabにあれば級内、dictExt(N2/N1)にあれば上級、どちらにも無ければ「判定不能」。
- **結果（final_N3=554現在＋content synonym_N3=1099＝計1653問）**：
  - ①正解が上級=解けない **184(11%)** ②誤答だけ上級 **372(23%)** →確実に上級混入 **556(34%)** ③判定不能(要目視/agent) **209(13%)** ④級内クリーン **888(54%)**。
  - 注：dictExtのN2判定に焦る/本気/日程など一般寄りも含むので線引き次第で556は前後。③はどちらの辞書にも無い語（新語/複合/固有寄り）。
- **未着手＝ユーザー指示待ち**：184(正解上級)を直す/除外するか、556全体か、③209の扱い。N5/N4と同じく「対象語だけ級内差替→無理なら除外」フロー（syn_rework4方式）が使える。集計スクリプトはこのメモの判定法どおり書けば再現可（保存はしていない・要再作成 or scratchpad/確認）。

## N3のQA訂正（ユーザー検品・2026-08-25・反映済）
- 正解訂正 計21件（岩/個性/懲らしめる/加害者/拡大した/消えた/考案した/照らして/リアル/産物/結論/停滞/テスト/展開/価格/法廷/検査する/節目/適応させる/衰退 等）＋汚す(1137)は青セル除外。final_N3反映＋増作2 ExcelのN3=259行に更新済。
- 水色FFCCFFFF=除外/黄FFFFFFCC=正解訂正の印。final_N3=554（300側295＋新272側259）。

## ★2026-08-25 LIVE＝N3「誤答のみ上級」の紛らわしい級内差し替え（走行中）
- ユーザー決定＝「解説は無くてよい／誤答は**紛らわしい語**を選抜」。純機械は不可（紛らわしさ＝意味判断・埋込類似だと第2の正解を拾う）→軽いエージェント。
- 機械監査を再作成＝`scratchpad/syn_n3_audit.py`（vocab.json[3541,N3以下]×dictExt.json['vocab'][4508,N1/N2]で挟む）。1653問→correct_adv189/**誤答のみ376**/unk424/clean664（誤答検出は前回372とほぼ一致・unk/cleanは線引き差）。
- 対象リスト＝`scratchpad/syn_n3_distractor_only.json`（376問・offending_idx/keep_distractors付き）。分割＝`scratchpad/syn_rework_n3/batches/b1..b5.json`（76/75×4）。SPEC＝同/SPEC.md。
- **走行中＝general-purpose(Opus) 5体**：a18aa0b4eb766e672(b1) / aec9c4d20e16c0599(b2) / a9ac19c78d9773dac(b3) / a4dc0c3b0d92f4702(b4) / a81e00a04b1b707d3(b5)。各: batch Read→offending語を紛らわしい級内語へ置換（第2の正解を自問除外）→`scratchpad/syn_rework_n3/out/b{n}.json`へ Write。
- **✅完了（2026-08-25）**：pass1（5体・467置換）→機械verify→pass2（1体・80問94語やり直し）→最終561置換を content synonym_N3.json＋scratchpad/syn_gen/final_N3.json へ **apply済**（376問・触った問題はexplain削除）。miss 0・exact-dup 0。
  - 機械verifyの残フラグは活用形/さ名詞化の**誤検出のみ**（脱活用を判定器に追加→41→6件、6件も「さようなら/最新/部下/洗って/出発すること」＝全て基本・常用語。真の上級語ゼロ）。
  - **番人 node:test 36/36緑**（synonymFormat=4択維持/重複無/正解混入無・daimon4choices・validate・manifest・rehydrate・iikaePossible）。※このリポはvitestでなく`node --import tsx --test`。
  - スクリプト：`scratchpad/syn_n3_audit.py`（監査）/`syn_n3_split.py`（分割）/`syn_n3_pass2_build.py`（2周目）/`syn_n3_apply_verify.py`（適用＋verify・脱活用付き）。エージェント出力＝`scratchpad/syn_rework_n3/out/{b1..b5,pass2}.json`。
## ★2026-08-25 LIVE＝N3「正解が上級」の作り直し/ドロップ（走行中）
- ユーザー指示「バケツ2を進めて／検品はN5N4N3まとめて後日」。方式＝N5/N4のfix/drop（syn_rework）と同じ。
- 改良版判定器（脱活用込み）で再抽出＝**187問**（content 85／final 102）＝`scratchpad/syn_rework_n3/correct_adv.json`。抽出=`scratchpad/syn_n3_correctadv.py`。分割=`batches_ca/c1..c4.json`(47/47/47/46)。SPEC=`SPEC_correctadv.md`。
- **走行中＝general-purpose(Opus) 4体**：a4a380c56ecd9480e(c1)/aa770f7dd503353bc(c2)/aea75d166c568354b(c3)/ad3c0433bf93592e9(c4)。各: fix(級内answer+紛らわしい誤答3)かdrop→`out_ca/c{n}.json`。
- **✅完了（2026-08-25）**：4体→**fix89/drop98**。apply_ca済（fix=answer+誤答3差替+explain削除／drop=item削除）。content 1099→**1057**（fix43/drop42）・final 102→46fix/56drop。
  - 機械verify：構造欠陥ゼロ（重複/正解=下線/誤答不足なし）。フラグ68はレベル判定のみ（answer_still_adv66/distractor_adv15）＝**提供/向上/防止/公式/真実/誠実/総理大臣/部署**等の常用語で、dictExtが旧JLPT基準で約1級辛いための過検出。実レベルは概ね級内。→**家での検品リスト**＝`scratchpad/syn_rework_n3/検品リスト_N3正解上級fix_68件.txt`。
  - 番人＝synonymFormat.test.ts の N3 を **1099→1057** に更新。node:test **36/36緑**。
  - スクリプト：`syn_n3_correctadv.py`（抽出）/`syn_n3_apply_ca.py`（適用+verify）。出力=`out_ca/c{1..4}.json`・`ca_flags.json`。
- **✅drop98語を除外リストへ（2026-08-25・ユーザー指示「dropは除外・再検証不要」）**：iikaePossible.jsonでdrop語のvocabId(98)を **p=0＋above_only=1（可逆）** へ降格。他に級内問題が残る語=0（安全）。**counts.N3.possible 1776→1678**。番人iikaePossible/synonymFormat 18/18緑。script=`syn_n3_exclude_drops.py`（content=git HEAD／final=word照合でvocabId復元）。
- **判定不能209/424は誤解の解消済**：私の監査の級内=vocab.json(3541語)照合が狭く、普通の語・句・活用形が大量にunknownへ落ちるだけ（実サンプルで若者/メール/温度を下げる等・珍語は1/60）。真に確定上級で残るのはcorrect_adv66+distractor_adv24（=dictExtが旧基準で辛い常用語）のみ。3周目一括処理は不要。

- **残注意**：①「第2の正解にならない」はエージェントの自己チェック依存（機械はexact-dupのみ確認）。厳密化するならサンプル/専用verify段を追加。②correct_adv189（正解が上級）とunknown424は未着手＝別判断。③content/final_N3は**未コミット・未OTA**（_manifest再生成→publish-content.ps1は指示待ち）。④納品Excel(N3シート259行)は差し替え未反映＝要再構築（在庫数・カバー率は不変）。

## 残（ユーザー判断・/clear後）
- **N3の上級語問題の処置**（上記）。EXCELをcontentへマージするか。コミット/ビルド/OTA配信方針（N5/N4のcontent修正は未コミット・未配信）。

## 別件（同会話）
- ★n3-v-424「岩」修正済＝final_N3.json（answer=大きな石／誤答=小さな砂・固い土・沢山の泥）。Excelはユーザーが開いておりロック→未反映（閉じたら書く or 納品時同梱）。

## 掃除
scratchpad/syn_gen/{batches2,out2,SPEC2.md} は作業用。用済みでF3掃除。
