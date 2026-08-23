# 言い換え類義「真のカバー率」— inflight（/clear耐性・上書き式）

## 目的
言い換え類義カバー率に「全ID母数／真の母数」2列を入れる（ドリル・用法と同じ正直化）。
真の母数＝「一意な言い換え問題が作れる語＝妥当な近い類義語を持つ語」だけ。
そのため語彙マスタ 3541語（N5 723/N4 673/N3 2145）を「言い換え可能 Y/N」に分類する。

## 方針（ユーザー承認 2026-08-23）
- **12体・単一パス**（Opus）。1体約295語。独立verify段なし（厳格プロンプト＋自己検証）。
- 品質が命（表示分母＝正直化指標）ゆえOpus。既存 vocabSynonyms.json はそのまま使わない
  （未紐づけ1226語の判定＋一意問題可否の検証になっていないため）。

## 分類ルーブリック（各エージェントに厳格提示）
言い換え可能=TRUE：ほぼ同義の別語/短句（近い類義語）が1つ以上あり、それを正解にした
言い換え類義問題が成立する語。
FALSE：感動詞/あいさつ(ああ,はい,ありがとう)・数詞助数詞・代名詞指示詞(これ,わたし,だれ)・
曜日月名等の固定語・機能語・近い類義語が無い具体名詞(水,猫,山 等)。
TRUEなら候補類義語を1つ返す。

## データ
- マスタ＝`src/data/shared/vocab.json`（list・3541・{id,level,word,reading,meaning}）
- 既存参考＝`src/data/dict/vocabSynonyms.json`（2315語→類義語文字列・今回は正本にしない）

## 手順・進捗
- [済] 12体分類完了→集計→`src/data/shared/iikaePossible.json`保存（3541語・過不足0）。
  初回: N5 361/723・N4 472/673・N3 1733/2145・計2566/3541=72.5%。
- [進行中] **ユーザー訂正「言い換えはカタカナを除外しなくても良い」→類義語の有無で再判定（承認済）**。
  p=0のカタカナ語140語だけを改訂ルーブリック（カタカナ除外を撤廃・類義語実在で判定）で1体再判定中。
  結果=scratchpad/iikae_class/results/rejudge_katakana.json → iikaePossible.jsonへマージ→counts再計算。
- [未] 在庫xlsx「単語×大問カバー率」の言い換え類義行(N5 r9/N4 r20/N3 r31)に
  真の母数/真のカバー率列を追加（ドリルシート形式）。covered∩possible/possible。
- [未] 番人テスト＝iikaePossible件数・レベル別真母数の検査。

## 別途この会話で完了した独立修正（content・要rebuild済）
- ①カタカナ表記(orthography)をN4/N3から除外＝N4 42問/N3 127問を没問題へ退避
  （`没問題/カタカナ表記除外_2026-08-23/`）。N5据置。rebuild.ts済・tsc0・content59テスト緑。
- ③文脈規定 N4-V-B-0249 の誤答「ハンバーグ」削除（ステーキと二重正解）。
- ④文法穴埋め N4-G-B-0188 stemの重複「し」削除（宿題をし→宿題を）。
- ②模試ボタン中央寄せ＝MockScreen/MockIntroScreenの主要アクションボタン文字にtextAlign:'center'。
- ※content正本=content/**（旧バンク削除済・build_content.tsは旧遺物）。再生成=`node --import tsx tools/content/rebuild.ts`。

## 次の一手
再判定マージ→iikaePossible更新→xlsx反映→番人→（コミット/ビルドはユーザー判断）。

## 【2026-08-23 追加＝言い換えカバー率を上げる作問(+100語/級・ユーザー承認「試験的に」)】
- 目的＝未カバーの言い換え可能語(p=1)に新規の言い換え類義問題を作りカバー率を上げる。
- 未カバー数（100%まで）＝N5 244 / N4 299 / N3 776。今回は**各級 先頭100語**を試験的に作問。
- 入力＝`scratchpad/synonym_new/input_{N5,N4,N3}.json`（各100語・{vocabId,word,reading,meaning,syn}。synはiikaePossibleの候補で誤りうる→gen側でanswerFixed）。
- ビルダ＝`tools/build_synonym_new_wf.py`（新規作問版。既存build_synonym_wf.pyはappパスの旧遺物・再生成用）。
- WF script＝`scratchpad/synonym_new/wf_{N5,N4,N3}.js`（N5/N4=文レベル・N3=語レベル。Opus-high gen→独立verify→非一意repair）。
- **run ID（2026-08-23 背景起動）**＝N5:`wf_d9a4c825-379` / N4:`wf_32f10bc3-c4c` / N3:`wf_071a6326-1cf`。完了通知待ち（ポーリングしない）。
- 形式＝item {id:`{LV}-V-I-{NNNN}`(maxから連番: N5=148/N4=185/N3=1000), vocabId, sentence, underline, word, answer, choices(=distractors 3-6), verified:true, stem(N5/N4のみ)}。
- **finalize＝実装済**＝`tools/finalize_synonym_new.py <N5.output> <N4.output> <N3.output>`（needsDrop/欠損除外・重複vocabId skip・ID連番・N5/N4はstem保持）→`node --import tsx tools/content/rebuild.ts`→_manifest再生成→content/parity/iikaePossibleテスト→`python tools/update_synonym_coverage.py`でxlsx更新。翻訳en/ne(i18n)は**後日・有料Gemini**(既存踏襲・今回はja作問のみ)。
- **WF完了状況**＝3級とも完了(各100語・verify unique99/multi1)。output=`%TEMP%\claude\...\01d6ef67-...\tasks\{w6pckwlv1=N5, w3gh44bio=N4, wbt7ag08l=N3}.output`。

## 【2026-08-23 着地＝N4/N3のみ採用・N5は差し戻し（未コミット・未ビルド）】
- **✅N4 +100 / ✅N3 +99 を content へ投入・rebuild・manifest再生成・テスト36/36緑**。
  - 真カバー率: **N4 38→59% / N3 56→62%**（N5は38%据置）。xlsx「単語×大問カバー率」更新済(update_synonym_coverage.py)。
  - 番人`synonymFormat.test.ts`の出題数ガードを N4=285/N3=1099 に更新（意図した増作）。N3-V-I-1023のみ下線一致で本文を辞書形へ微修正(占めている→占める)。
- **⚠N5は差し戻し(git checkout で撤回)＝format不一致**。N5の文レベルは①本文=プレーン(inline ruby不可・ルビは別マップSENTENCE_FURI)②**分かち書き**③`pattern`(noun/adj/adv/verb/hypernym/negation_cross/perspective_cross)④下線は本文中に literal に現れる形、が必須。今回の生成器はこれを満たさず4テスト赤→撤回。
- **✅N5＝完了(2026-08-23)**。整形WF `wf_559f8490-f76`(97問/drop0)→finalize→`synonym_N5.json`(245)＋`sentenceFuri.json`更新→rebuild→テスト42/42緑。**真カバー率 N5 38→62%**。⚠xlsx更新(update_synonym_coverage.py)は**Excelロック中で保留**＝閉じたら実行。
  - 3級合計＝**+296問(N5 97/N4 100/N3 99)**・真カバー **N5 62% / N4 59% / N3 62%**。未コミット・未ビルド。翻訳en/ne未付与(後日有料)。
  - 以下は手順記録(参考)：再生成せず**整形WF**で対応：
  - ビルダ＝`tools/build_synonym_n5_reformat_wf.py <N5.output>`（内容不変・分かち書き/半角ルビstem/全角ルビfuri/pattern/表層underline/誤答数=cross3・非cross3-5）。
  - WF＝`scratchpad/synonym_new/wf_N5_reformat.js`。**run `wf_559f8490-f76`(task wxgz478r3)・背景実行中**。
  - finalize＝`tools/finalize_synonym_n5.py <reformat.output>`（番人N5規則を満たす物だけ採用・`content/.../synonym_N5.json`＋`src/data/dict/sentenceFuri.json`両方更新）。
  - 後続＝rebuild→出題数ガードをN5=245へ更新(synonymFormat.test.ts line 91 は現状N4/N3のみ・N5用は`n5().length>130`等で可変ゆえ数値固定は無いが要確認)→テスト→update_synonym_coverage.py。
- **翻訳en/ne(i18n)＝新規199問は未付与**（既存踏襲・後日Gemini有料・見積り承認後）。コミット/ビルドはユーザー判断。
- 併せて未反映のsheet編集＝`tools/apply_coverage_sheet_edits.py`（H6/H7説明＋N5用法グレー・Excelロック解除後に実行）。N4用法は実在(問題5)ゆえ据置。
