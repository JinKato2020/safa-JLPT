# 文章の文法 N5 カバー率向上（退避12＋新規12）— 2026-08-21 着手・/clear耐性

## 状態（このファイルが正本・作業ツリーは未変更＝まだ何も破壊していない）
- **診断済**：N5「文章の文法」カバー率＝**52/91（57%）**。80問×5空所=400空所のうち N5点=335・N4=38・N3=3・除外(n5-g-92)=24。335個のN5空所が52点を重複使用、**91点中39点が未カバー**。
- **ユーザー決定**：低貢献12問を**没問題へ退避（可逆）**＋**新規12問**で未カバー39点を全部埋める（カバー率 52→最大91=100%狙い）。問題数80は維持。
- **計画の正本JSON（durable・永続）**＝`scratchpad/pg/allocation/n5cov_plan.json`（再生成＝`python scratchpad/pg/allocation/n5cov_plan.py`）。退避list・未カバー39点・新規12本の5点配分を全収録。**未カバー網羅=OK 検証済**。

## 退避する12問（N5点が薄くN4/除外が多い低貢献・退避してもカバー52は減らない＝全点が他問で重複カバー）
N5-G-S-0044, 0047, 0001, 0035, 0041, 0042, 0045, 0048, 0053, 0062, 0069, 0075
- 退避先（可逆）＝`没問題/文章の文法_N5低カバー退避_2026-08-21/passage_grammar_N5_retired12.json`（content外＝アプリ非表示・戻す時はitemsを正本へ再挿入）。

## 新規12問（id `N5-G-S-0081`〜`0092`）＝各5空所に割り当てる未カバーpointId（配分は n5cov_plan.json）
- 例：0081=n5-g-1(ちゃいけない)/n5-g-34(も)/n5-g-53(のです)/n5-g-79(は)/n5-g-25(けど) … 全12本ぶんはjson参照。
- **作問仕様＝`md/08_文章の文法.md` §⑧-N5 厳守**：①**2文章**（作文A=2空所＋作文B=3空所・N5はpassages.length=2必須）②5空所・blankNo 1-5・各4択・**pointId必須**（grammar.json実在id）③**3:2**（本文依存3＋単文可2）④一意性＝前後2文以上で1つに固定・第2正解厳禁（誘い"たい/ましょう"両立に注意）⑤役割ベース・個人名なし・**総ルビ・分かち書き**・平易⑥字数目安250字⑦セット内で機能重複させない。**割当pointIdをその空所が実際にテストする文法にする**（正解語＝その項目）。
- **id/スキーマ**＝既存itemをtemplate複製。item id=`N5-G-S-00NN`・質問id=`N5-G-S-00NN-qN`・`kind:"passage_grammar"`・`i18n:{}`（翻訳en/neは後日・有料見積り承認後）。

## 進捗（2026-08-21 セッション再開）
- ✅**退避適用済**＝`scratchpad/pg/allocation/n5cov_retire.py` 実行。正本 `content/problems/bunpou/passage_grammar_N5.json` を80→**68問**。退避12＝`没問題/文章の文法_N5低カバー退避_2026-08-21/passage_grammar_N5_retired12.json`（可逆）。
- ✅**新規12生成完了**＝`scratchpad/pg/n5cov/gen_{A,B,C}.json`（A=0081-0084 / B=0085-0088 / C=0089-0092）。**機械ゲートHARD=0**（`scratchpad/pg/n5cov/gate.py`＝構造/pointId実在/割当一致/ルビ100%/選択肢重複無/answerIndex分散）。**カバー率投影＝91/91（100%・uncovered=0）**（`cov_check.py --with-gen`）。**SOFT＝全12本が字数不足**（84-147字・目標250）。
- ✅**改訂1（字数+一意性4件）適用済**＝全12本を実質227-382字へ増補。B完全一意化。ラウンド2の独立反証で残4件を検出→**改訂2で修正中**：0083-5(ましょうか vs たいです→わたしが相手へ申し出疑問化)/0084-5(も vs は→「だけでなく…も」呼応)/0089-5(なくちゃ vs 意志→「買わないと作れない」必須条件化)/0091-3(とき vs あと→「入る」非過去化で あと非文)。0090の「いつも」3連(leak)は機械修正済。
- ✅**適用完了・全ゲート緑（未コミット・未push）**＝改訂2で3件一意化、残1(0089-5 なくちゃvs意志)は選択肢を〈義務/義務否定/禁止/過去〉の対立に差替えて論理的唯一解に。**適用(68→80)→rebuild(_manifest 52ファイル)**。**カバー率 N5文章の文法＝91/91（100%・uncovered=0）**（開始時52/91）。テスト緑＝passageGrammar 3/3(180・N5 80維持・5問2文pointId解決)・Wire 3/3・passageTransNe 4/4(未訳借金 増えず)。**tsc 0**。
- **変更ファイル（未コミット）**＝`content/problems/bunpou/passage_grammar_N5.json`(80問)・`content/_manifest.json`・退避`没問題/文章の文法_N5低カバー退避_2026-08-21/passage_grammar_N5_retired12.json`(新規・可逆)。
- ⚠**未了**＝①カバー率Excel(`memory/在庫・模試ストックまとめ.xlsx`)は**Excelで開かれてロック中**で保存失敗＝閉じてから`python tools/update_coverage_grammar.py`再実行。②翻訳en/ne(新12問・後日・有料見積り承認後)。③**OTA配信=commit+push（=Pages deploy・ビルド無し）はユーザー承認待ち**。
- 検査/適用ツール（durable）＝`scratchpad/pg/n5cov/{gate.py,cov_check.py,blind_render.py,compare.py}`。退避＝`n5cov_retire.py`。

## 次の一手（この順で実行＝次セッションの起点）
1. ✅**退避適用済**（上記）。
2. **新規12問 生成**（Opus本体＝有料API無し。品質重視）：n5cov_plan.json の各本5点を主軸に §⑧-N5 で作問。**サブエージェント使うなら3体×4本**（B2束ね）。
3. **機械ゲート**（LLM自己申告は不可・[[md/08 学び①②]]）：①blankNo⇔【n】一致・4択重複無・answerIndex範囲・pointId実在②**一意性＝選択肢差し込み全文を別リクエストで反証**（正解伏せ）③本文↔正解語の重複禁止④字数⑤ルビ100%（`scratchpad/pg/ruby_*` 方式＝本文書き直さず読みだけ）。
4. **適用**：正本を68→80へ（新12追記）→ `node --import tsx tools/content/rebuild.ts`（_manifest再生成）。
5. **カバー率確認**：`python "C:\Users\jwpsa\AppData\Local\Temp\...\scratchpad\pg_cov.py"` 相当で 52→? を実測（uncovered=0目標）。カバーシート更新＝`python tools/update_coverage_grammar.py`。
6. **テスト**：passageGrammar.test.ts（N5=80維持・5問・2passages・pointId解決・4択）／passageGrammarWire.test.ts 緑。tsc0。
7. **配信**：content+（音声無し）＝OTA（`publish-content.ps1`だが content/ のみaddなので手動commitでOK・ビルド不要）。翻訳は後日有料。

## 参照
- 設計＝`md/08_文章の文法.md`（§⑧-N5・多様性パレットN5・ルビ方式・学び①〜⑦）。カバー率定義＝CLAUDE.md §4（分母=N5文法点91=92-除外1・pointId経由）。
- 前タスク（別件・完了）＝聴解攻略耐性の赤緑化＝コミット`843f1df7`・OTA配信済（`memory/聴解攻略耐性-inflight.md`）。
