# ✅完了: 情報検索 本走行（2026-07-23 実データ確認で全完了・配信済）

> **確定**: 410問生成→①〜④検証→**405問を本番反映・Build 2546/2547 で配信済**。以前の「本番未反映」記述は誤り。実データ確認=opus_out_1a/1b/3a/3b は4体とも生成済／削除5問(N3-b014/b067/b114/b119/b137)は本番 joho_N3.json に不在／生き残りの図パッチは本番content一致(例 N3-b140「ＤＩＹワークショップ」の header/表が一致)。**「残り22問の図修正」として今すべき作業は無い**。以下は作業履歴（参照用）。

# （履歴）進行中: 情報検索 本走行（各級生成済み・検証チェーン実行へ）

- **承認**: 生成は 2026-07-22 承認済み。**旧「Opus段≈¥5,700」は撤回**＝それは fix_unique.mjs が Opus を有料API($15/$75)で呼ぶ設計時の見積り。ユーザー確定フローでは③④Opus＝**本セッション(Claude枠¥0)**。有料は②Geminiのみ＝**≈¥300〜500見込み**(D1の¥1,000未満・走行後にD2報告)。
- **字数の許容(ユーザー確定 2026-07-23)**: 目標字数−50以内は無視して採用。−50超のみ Opus で中立テキスト補修(答えは変えない)。実在名4問も置換して救済。
- **新方針(2026-07-22)**: 割り増し作問はしない [[no-overprovision-question-generation]]。最終段は不合格を**削除**（追い作りで埋めない）。過不足はユーザー判断。
- **モデル**: 生成/ルビ/Gemini反証 = gemini-3-flash-preview／中核の一意性検証・誤答修正 = Opus。
- **スクリプト**: `...\scratchpad\joho_pilot\`（gen.mjs / ruby2.mjs / gate.py / verify.mjs、要作成: fix_unique.mjs・Opus検証段）。成功後 `tools\joho_gen\` へ確定版。

## 規模（実測 2026-07-22）
- 生成済み: N5 110 / N4 140 / N3 160 = 計410問・平均 core 885字/問（figure+question+choices）。

## 検証チェーン（ユーザー指定 2026-07-22）と現在地
1. [済] gen → raw_{LV}.json
2. [一部] ruby2.mjs → annotated_{LV}.json。N5=0・N4=0（完成）／**N3=1465残（未完）**
3. 機械で潰せるエラーを除去（gate.py: 字数/構造/ルビ0/ボーダーレス/重複）
4. Gemini: 一意性の反証チェック＋誤答修正
5. Opus(=本セッション/MAX・¥0): 一意性の反証チェック＋誤答修正（Geminiで落ちて直した分だけ）
6. Opus(=本セッション/MAX・¥0): 再度 一意性の反証チェック → **不合格は削除**（backfillしない）
7. 生き残りを content/problems/dokkai/joho_{LV}.json へ反映 → rebuild → tsc → node --test → 明示パスcommit → push

## ✅ ブロッカー解消（2026-07-22）
- ユーザーがGeminiに課金（チャージ）済み。**429は解消**（再実行が2分間abortせず継続＝クレジット復活を確認）。

## 現在地（2026-07-23 訂正・✅データ健在＝「消失」は誤報だった）
- **⚠️前回「410問消失」は誤り**。作業ファイル一式は session `1171ed69` の scratchpad に**そのまま生存**していた。前セッションは別セッションIDの scratchpad を探して見つけられなかった幽霊ファイル誤認（[[verify-app-reads-the-file-you-edit]]）。
- **2026-07-23 安全な場所へ退避済 ✅**: `バックアップ\joho_pilot_20260722\`（16ファイル・3.8MB＝raw_/annotated_{LV}.json・gen.mjs・ruby2.mjs・gate.py・fix_unique.mjs・verify.mjs・各log）。元は `...Temp\claude\...\1171ed69-...\scratchpad\joho_pilot\`（セッション専用temp＝消える恐れ）。
- **機械検証した実データの状態（2026-07-23）**:
  - **本文 raw = 410問すべて健在**（N5=110 / N4=140 / N3=160）。
  - **ルビ annotated: N5=完成(無ルビ0)✅ / N4=完成(無ルビ0)✅ / N3=未完❌**（無ルビ漢字 15,772字残＝約5%しか付いていない）。原因＝N3ルビ実行時にGeminiが60秒タイムアウト連発（ruby2_n3.log に AbortError×36）。**credit復活後に `node ruby2.mjs raw N3` を再実行すれば完了する見込み（安価）**。
- **本番未反映**: `content/problems/dokkai/joho_{LV}.json` に載っているのは6問のテスト試行のみ。410問は1問もアプリに入っていない。
- **gate.py 機械採点（2026-07-23・¥0）**: N5=109/110（FAIL1＝字数のみ）／N4=125/140（FAIL15＝全部字数不足）／N3=0/160（ルビ未実行のため全落ち。**ルビだけが原因=85問→ruby再実行で即クリーン**／字数不足=72／実在名=4）。
  - **N3ルビ再実行後の見込み**: 機械クリーン ≈ **319/410**。残＝字数微増 約88問（N3は588/599等ほぼ600直下＝注記1行で救える）＋実在名4問（役割置換）。字数/実在名の補修は①レベル＝Opus(¥0)かGeminiで可。
- **公式分析＋①〜④フロー確定**: `md\情報検索_作問フロー.md`（字数250/400/600・裏技T1〜T8・route/poster/board型・②〜④検証カスケード）。公式6ページ実物と整合を検証済み。

## パイプライン実体（スクリプトから確定）
- **gen.mjs**: figure構造＝`figure.kind`＋`blocks`/`tables`＋`notes`、設問＝4択＋answerIndex。字数下限 N5≥250/N4≥400/N3≥600。ルビ形式＝`漢字（よみ）`（全角括弧）。
- **ruby2.mjs**: 機械ルビ（無ルビ漢字連を検出→読みだけLLMに聞く→決定的に挿入。本文は再生成しない＝崩れない）。第1引数=raw/annotated、第2引数=レベル。
- **gate.py**（¥0）: 字数/4択/answerIndex/figure構造/無ルビ0/実在地名人名/重複 を機械採点。

## ★重要発見（2026-07-23）: Geminiモデルは gemini-2.5-flash を使う
- **`gemini-3-flash-preview` は今日ハング**（単発1リクエストすら90s×2でAbortError＝内部thinkingか過負荷）。gen.mjsが以前通ったのは別時刻だから。
- **正解＝`gemini-2.5-flash` ＋ `generationConfig.thinkingConfig.thinkingBudget=0`**：診断で915ms正常応答。ruby2.mjs は切替済（`RUBY_MODEL`環境変数で上書き可・maxOutputTokens=8192）。
- **②の verify.mjs / fix_unique.mjs も同じ切替が未実施**＝②実行前に MODEL を gemini-2.5-flash＋thinkingBudget:0 へ直すこと（さもないと②も全AbortError）。診断道具＝`gdiag.mjs`、1リクエスト完結版＝`ruby_chunk.mjs`（今回は不要になった保険）。

## 補修は完了（2026-07-23・¥0確認）
- **全410問が 字数(±50)・実在名 クリア**：confirm_repair.py で N5 110/110・N4 140/140・N3 160/160。字数−50超不足=0／実在名残=0。
- Opus補修サブエージェント2体で42問処理（字数38＋実在名4）。intro/footerに中立文のみ追加、答え(設問/4択/answerIndex)不変を merge_patch.py で機械検証。b066は名前を選択肢でも統一置換したため自動検査が偽陽性→ルビ除去+名前正規化で骨格一致を確認し手動反映。
- 実在名の置換：b066(田中/佐藤/鈴木/高橋→Ａ/Ｂ/Ｃ/Ｄ統一)・b105(新宿→中央)・b106(佐藤→受付担当)・b145(京都→古都)。
- scratchpad道具（¥0使い捨て）: measure_short/build_worklist/audit_agg/merge_patch/check_b066/confirm_repair.py。

## 走行中/次の一手（2026-07-23）
- **① 完了✅**: ルビ完了（無ルビ0）＆字数±50＆実在名0＆重複0＆構造0。410/410 機械クリーン（N5 110・N4 140・N3 160）。
- **②-a 迷走の真因＝2つのバグ（解決済）**:
  1. **ID取り違え**: 検算AIが設問id（末尾-q付き `..-q`）を返し、本体idと突き合わせ全外れ→「全部要修理」化。→ blind()から設問id除去＋照合で`-q`吸収（norm）。1回目¥71は無駄。
  2. **fetchタイムアウト欠如**: verify.mjsはAbortController無し→N3のどれか1バッチでGeminiが無応答になり**27分ハング**（node CPU1秒で判明）。→ 90秒タイムアウト＋3回リトライ＋`connection:close`、`VERIFY_LEVELS`でレベル限定を追加。
- **②-a 完了 ✅（2026-07-23）**: **N5 89/110（要修理21）／N4 119/140（要修理21）／N3 90/160（要修理70）＝計 一意298／要修理112**。verify.mjs は毎バッチ即保存＋再開版（`verify_{LV}.raw.json`／batch=2）。実費: N3走行¥36＋(N5/N4は途中killで最終コスト行取り損ね≈¥35概算)＋1回目ID取り違え無駄¥71 ≒ **計¥140前後**（D1の¥1000未満）。
- **②-b 完了 ✅**: 修理成功 **N5 20/21・N4 21/21・N3 63/70＝計104**、直せず保留8（不変条件破りの案しか出ず→③④Opus）。実費 ¥14+16+71=**¥101**。fixes_{LV}.json＋annotated_{LV}.jsonへ反映済。
- **②-c 完了 ✅**: 修正後 **一意 377/410**（N5 107/110・N4 136/140・N3 134/160）。まだ要修理 **33**。②-c実費¥21。
- **③④Opus（本セッション・¥0）進捗（2026-07-23）**:
  - slice2（11問）＝**完了**。opus_out_2.json（fixed 11 / delete 0）。
  - slice1・slice3（各11）＝**64k出力超過で失敗**（full item出力が重すぎた）。→ 対策=出力を「figureと解説だけの小さなパッチ」に変更＋各2分割（5〜6問）。
  - **再起動4体（走行中・パッチ方式）**: 1a=a0ab3f049722863f5 / 1b=a8bb7018694c49c71 / 3a=ac3bce50ea0bced6b / 3b=af6423a5399292298。todo_opus_{1a,1b,3a,3b}.json→opus_out_{同}.json へ figure+explain のパッチだけ Write。**4体の完了通知待ち（A4）**。
  - merge_opus.py は `opus_out_*.json` を全部glob取込→**元itemからfigure+ja.explainだけ差し替え**（本文/選択肢/answerIndex/ルビ/他言語は元のまま温存）＋touched idを raw から除去。
- **完了後の順**: merge_opus.py → verify.mjs 最終再検算（Opus触った分のみ／なお≠1は**削除**）→ ruby無ルビ0再チェック（figure値変更で新出漢字が出ていないか）→ gate.py → content/problems/dokkai/joho_{LV}.json 反映 → rebuild/tsc/node --test → commit/push → ビルド。
- **D2累計（②Gemini）**: ②-a≈¥140＋②-b¥101＋②-c¥21＝**≈¥262**（③④Opusは¥0）。D1の¥1000未満。
- **未処理スクリプト（次でやる）**: merge_opus.py（opus_out適用＋delete除外）／最終Gemini再検算／ruby再チェック（figure値変更で新出漢字が出ていないか）。
1. ②-a 完了 → 各級「一意/要修理」件数＋実費(D2)報告。
2. **②-b**：要修理だけ `node fix_unique.mjs <LV>`（gemini-2.5-flash）→ annotated_{LV}.json 書き戻し → **②-c 再verify**。PAID・D2。
3. ③④ Opus一意性（本セッション・¥0）＝②で1に収束しない分のみ。落ちは削除（backfillしない）。
4. 生き残りを content/problems/dokkai/joho_{LV}.json へ反映→rebuild→tsc→node --test→明示パスcommit。
