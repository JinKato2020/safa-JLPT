# インドネシア語(id) 大問の本文対訳 — inflight（2026-09-06 着手・/clear後に実行）

## ★確定（2026-09-06・ユーザー回答＝「読解・文章の文法も含め本当に全部」）
- **範囲＝非聴解5＋聴解5＋読解3(naiyou_tan/chu/choubun)＋文章の文法(passage_grammar)**。**joho(情報検索)は en/ne 自体が無い（commit a21dcef9で明示除外）ため id も除外**（整合維持）。
- 実費見積り(Gemini 2.5 Flash)＝いずれも¥1000未満（非聴解≈¥180・聴解≈¥230・読解/文法≈+α）。**D1閾値未満でも完了時にD2実費報告**。
- **方式＝新ツール `tools\trans_daimon_lang.py`（案b採用）**。理由＝trans_daimon.py の write は en/ne を**上書き**する箇所があり番人(passageTransNe/explainTransPolicy)依存ゆえ触らない。新ツールは**単一lang・i18n[lang]へマージ追記のみ**（en/ne/ja/languages配列を保持）。cache=`scratchpad/pg/trans_<daimon>_<lang>_cache.json`。
- 構造メモ：dokkai=item.body(1長文)→i18n[lang].body=[訳1本]／各設問 q+choices。passage_grammar=passages各body(空所【n】保持)→body=[本数分]／各設問choicesのみ(q無し)。聴解kadai系=questions[0]のみ(既存踏襲)。

## ★進捗(2026-09-06)
- **ツール検証済**＝`trans_daimon_lang.py` を choubun(dokkai)/passage_grammar(pgram) で実apply→write→確認：**en/ne 完全無傷(md5一致)・id.body形正・空所【n】保持・番人 passageTransNe 5/5 pass**。全見積り=45,645ユニット¥608。
- **▶走行中 run＝`blvom0d2z`**（`python tools/trans_daimon_lang.py ALL --apply --lang id`・log=`scratchpad/trans_id_apply_all.log`）。choubun/pgram はキャッシュ済でskip。完了通知待ち(ポーリング禁止A4)。
- **次の一手(完了後)**＝(1)`ALL --write --lang id` で全content書込 (2)番人一式 `node --import tsx --test src/data/exam/passageTransNe.test.ts` 他＋tsc (3)`update_trans_status.py daimon id --yen <実測合算>` でExcel④2行更新＋H列(id)各大問100%化 (4)**D2実費報告** (5)OTA配信=`publish-content.ps1`は**ユーザー明示OK後**のみ(never-build-without-explicit-order)。
- 実測コスト積算：choubun ¥13＋pgram ¥37＝¥50(既)＋走行中run分。最終はlogの各[apply]実測¥を合算して報告。

## ★★完了(2026-09-06)＋重大な表示ギャップ
- **データ＝完成**：全14大問(非聴解5/聴解5/読解3/文章の文法) の id 対訳を content の `i18n.id` へ投入(64ファイル/14,060item・0スキップ)。**en/ne 完全無傷(md5)**・番人 passageTransNe 5/5・**tsc 0**。
- **実費(D2)＝約¥473**（Gemini 2.5 Flash・in$0.30/out$2.50・¥155/$。id出力47,050ユニット/3,219,046字）。Excel⑥④：H列(id)各大問=100%緑・出力字数61=3219046・実費62=¥473 記入済。
- **★★表示ギャップ(要判断)**：アプリの大問対訳表示は **en/ne 二択決め打ち**。`meaningL1(settings)==='ne'?…Ne:…En`(QuizScreen/ListeningScreen 他)＋`l1`は選択時 `code==='ne'?'ne':'en'` に固定(AccountScreen190/ProfileScreen134)＋`rehydrate.ts` は `i18n.en/ne` のみ抽出(id読口なし)。**→ id データは入ったが今のアプリは表示しない(id母語ユーザーは英語表示)**。表示するには (1)l1にidを許可 (2)rehydrate.tsをlang汎用化(promptId/Q_TRANS_ID…) (3)全consumerを二択→lang汎用pickへ (4)**UIビルド**(OTA不可)。※理想は「id専用」でなく全母語汎用化。**ビルドは未認可ゆえ未実施(never-build-without-explicit-order)**。
- **未コミット**：content i18n(id)追記多数＋tools/trans_daimon_lang.py(新規)＋Excel。**commit/push/build/OTAは全てユーザー明示OK後**。
- **次の一手**＝ユーザーに「データのみで一旦保存」か「表示配線＋ビルドまで」かを確認。前者なら配信不要(表示されない)ので commit だけ(指示時)。後者は別タスク(app改修＋ビルド)。

## ★★★表示配線 完了(2026-09-06・ユーザー選択「idをフル対応」)
- **調査結果**：id は UI訳(id.json 1422キー=ja/en/neと同数)・辞書 example100%/kanjigloss100%/meaning99% で **ne と同格に完成済**。ボトルネックは言語ピッカーが UI_LANGS(en/ja/ne)限定だった点のみ。他6言語(bn/ko/my/th/vi/zh)も UI/辞書は完成だが大問対訳が無い(=英語fallback)。
- **実装(コードのみ・ビルド未実施)**：
  1. `src/i18n/index.ts` UI_LANGS に `id` 追加(SUPPORTED入り→uiLang='id'採用・t()がid.json使用)＋汎用ヘルパー `pickTr(l1,en,ne,id)` 新設。
  2. 言語ピッカー clamp を id 許容へ：`ProfileScreen`(UI_LANGS)/`AccountScreen`(NATIVE_LANGS 10言語) とも `l1 = ne→ne / id→id / 他→en`。他8言語は従来通り en(半端に有効化しない)。
  3. 大問対訳を id 汎用配線：`rehydrate.ts`(promptId/sentenceId/answerId/choicesId/explainId＋PASSAGE_TRANS_ID/Q_TRANS_ID)→`data/index.ts`(export)→`daimon.ts`(orderMeaningId/answerTransId/promptTransId/synonymSentenceId/choiceTransId＋BankUnit/ContextBankItem/SynonymBankItem型にid欄)→`quiz.ts`(型)→`QuizScreen`/`ListeningScreen`/`PassageSetPlayer`(pickTr)。
  4. 辞書/漢字/単語カードは `MEANING_L10N[l1]` で元々汎用ゆえ id は自動で効く(追加改修不要)。
- **検証**：tsc 0・番人 passageTransNe/rehydrate/parity 13/13 pass・実行時 PASSAGE_TRANS_ID=3840(EN4000・差=joho除外)/Q_TRANS_ID=5120。
- **残**：実表示確認は**ビルド必要**(UI変更ゆえOTA不可)。**ビルド/commit/pushはユーザー明示OK後**。次ビルド同梱候補(v1.1.35系の未コミット群と一緒)。

## ★修正(2026-09-06・読解模試プールの取りこぼし)
- ユーザー指摘(en/ne 4000 vs id 3840)から発覚：`trans_daimon_lang.py` の DOKKAI/PGRAM glob が**非再帰**で `dokkai/mock/` を拾えず、**読解模試プール(naiyou_tan110/naiyou_chu40/choubun10=160本＋設問)を id だけ訳し漏れ**。joho は en/ne/id とも本文訳0(図表主体で正常・除外)。
- 対処：DOKKAI glob を `dokkai/**/…` に再帰化→読解模試の id を追加翻訳(¥21)→write。**結果 id は en/ne と完全パリティ**：PASSAGE_TRANS en=ne=id=4000・Q_TRANS en=ne=id=5390。pg mock は en/ne も未訳ゆえ id も揃えず(en/ne側の別課題)。
- **id 実費合計＝約¥494**(初回¥473＋読解模試¥21)・id出力字数3,401,751。Excel⑥④更新済。tsc0・番人9/9。


ユーザー指示（2026-09-06）:「`memory\在庫・模試ストックまとめ.xlsx` ⑥翻訳状況シートの **61,62の間に2行挿入**して。**インドネシア語の大問の訳を順番にすべて作成**して欲しい」。→ まず /clear してから進める方針。

## タスク要点
1. 各大問の**本文対訳(id)**を Gemini 2.5 Flash で生成し、content JSON の `i18n.id` に投入（en/ne と同じ仕組み）。**順番に=大問順で全大問**。
2. Excel `⑥ 翻訳状況` の④セクション H列(インドネシア語) を「未着手→100%」に更新＋61/62行間に2行挿入（id大問訳の実施ノート用）。

## ★★最重要の前提（設計ギャップ）
- **`tools\trans_daimon.py` は en/ne 決め打ち**＝Geminiプロンプト128行が `{"en":...,"ne":...}` 固定・書込234〜318行も `i['en']/i['ne']` のみ。**id等の追加言語に未対応**。
- ゆえに**大問版の多言語対応が必要**（辞書側 `trans_dict_lang.py`＝多言語版 が良い前例）。方針案:
  - (a) `trans_daimon.py` に `--lang id` を足す（プロンプトを `{"<lang>":...}` 化・書込を `i18n[lang]` へ・**既存 en/ne を絶対に壊さない**＝マージ追記）。キャッシュキーも lang 別（現 `scratchpad/pg/trans_<daimon>_cache.json` は en/ne 混在ゆえ **id用は別ファイル**に）。
  - または (b) `trans_daimon_lang.py` を新規（trans_dict_lang.py を踏襲）。
  - どちらでも**書込は id 追記のみ・en/ne と languages 配列を保持**。番人 `passageTransNe.test.ts`・`explainTransPolicy.test.ts` を壊さないこと。

## 大問キーと規模（`⑥翻訳状況`④ 実測・通常+模試）
DAIMON dict（trans_daimon.py 79行〜）= context/order/synonym/usage/grammar_form/kadai/point/gaiyou/hatsuwa/sokuji（＋読解系は DAIMON dict を再確認）。en/ne=100%済の大問が対象:
- context(文脈規定) 3774／synonym(言い換え) 2405／usage(用法) 1271／grammar_form(文法穴埋め) 1647／order(並べ替え) 823／文章の文法 240／読解短440・中200・長50
- 聴解 kadai660/point640/gaiyou110/hatsuwa740/sokuji950 ← **⚠シートはid「なし」表記**。en/ne は100%。**「すべて」に聴解を含むかユーザーに1度確認**（含むなら台本+設問+選択肢を訳す＝struct型）。
- ざっくり計 非聴解≈11,000＋聴解≈3,100 ≈ 14,000件。読解本文は長文ありトークン嵩む。

## コスト（D1/D2 厳守）
- **各大問 `--dry-run` で先に見積り**（trans_daimon は件数/バッチ/概算¥を出す）。参考: id辞書10,351件=¥78実測。大問は件数近いが本文が長い→**数百円規模**の見込み。
- **合計見積り >¥1000 なら --apply 前にユーザー承認**（D1）。完了時に**モデル名＋実費(円)を報告**（D2）。GEMINI_API_KEY は環境設定済。
- Gemini 2.5 Flash・単価 in$0.30/out$2.50/M・¥155/$。BATCH=30。**リトライ乱発禁止**（[[tts-no-retry-single-call]] の精神）。

## 実行手順（案・大問順に）
1. まずツール拡張(a/b)を実装＋小さな1大問(例 read=usage 1271)で --dry-run→--apply→--write を通し、`i18n.id` が入り en/ne が無傷か確認（[[verify-app-reads-the-file-you-edit]]）。
2. 全大問ループ: `--dry-run`(見積り集計)→承認要否判断→`--apply`(キャッシュ再開可)→`--write`。
3. 番人: `node --import tsx --test tools/content/*.test.ts src/data/content/*.test.ts src/data/exam/passageTransNe.test.ts`。
4. Excel記入は**仕組み化済＝`tools\update_trans_status.py`**（1コマンド・言語列はヘッダから動的特定・Excel開いてたら強制終了して保存＝ユーザー指示）。
   - **④大問の2行サマリ(◇大問訳 出力字数=行61/概算実費=行62)は作成済**（2026-09-06・再挿入不要）。
   - 各大問(=各content翻訳)の --write 後に **`python tools\update_trans_status.py daimon id --yen <実費> [--chars <字数>]`**。字数は `daimon_chars()` が `scratchpad/pg/trans_*_cache.json` の `{id:{...lang...}}` を集計（大問multilang拡張のキャッシュ形式をこの想定に合わせること。合わなければ --chars で明示）。¥は各大問の実測を合算して渡す。
   - H列(id) の各大問カバー%（44,47〜54 等）を「未着手→100%」へは手動 or 別途（本ツールはサマリ2行専用）。
5. **manifest再生成＋OTA配信**（`tools\publish-content.ps1 -Message "..."`＝content i18n はOTA・ビルド不要 [[content-ota-vs-ui-build]]）。**ユーザー明示OK後**（[[never-build-without-explicit-order]]）。

## Excel 挿入の確定手順（今セッションで検証済・cp932罠に注意）
- openpyxl の insert_rows は**結合セルを追従しない**。順序＝**(1)挿入位置以降(min_row≥INS)の結合を全て unmerge →(2)insert_rows(INS,N)→(3)同結合を +N で再merge**。書式(塗り/罫線)は insert_rows で保持される（検証済）。
- **print で `≈`/`¥` を出すと cp932 で落ちる**→スクリプト冒頭 `sys.stdout.reconfigure(encoding='utf-8')`。
- 参考色=`FFFFF2CC`(信号色フックは既存色を消さない)。緑100%=`FFC6EFCE`。前回(③辞書 37/38間)のコスト記入で同手順成功。
- **必ず本番編集前に scratchpad へバックアップ**を取る。

## 配信境界メモ
- content の i18n(id) 追記＝**OTA**（publish-content.ps1・ビルド不要）。アプリ表示経路は lang 汎用読みかを要確認（辞書は meaningIn 等が任意lang対応済だったが、**大問の対訳表示コンポーネントが id を読むか**を実機/コードで確認＝[[verify-app-reads-the-file-you-edit]]）。読まないならUI側の対応＝ビルドが要る可能性。
