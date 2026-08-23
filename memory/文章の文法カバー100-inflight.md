# 文章の文法 N4/N3 カバー率100%化（追加作問）— inflight（/clear耐性）

## 目的
文章の文法(passage_grammar)の級点カバー率を100%へ。**N4に10セット・N3に20セット追加**（ユーザー確定 2026-08-23）。
- 現状: N4 101/131=77%(未カバー30点) / N3 126/186=68%(未カバー60点)。N5は既に100%(別設計)。
- カバー率定義＝その級の文法点(metricExcluded除く)のうち、passage_grammarの空所で1回でも出た点の割合。番人＝`src/data/bunshouGrammarBalance.test.ts`(現 RUN_BALANCE=false)。

## 完了済み（ディスク保存済＝再開の入力）
- **配分表**: `scratchpad/pg/allocation/{n4_add_alloc.json, n3_add_alloc.json}`（再生成は `node scratchpad/pg/allocation/build_add_alloc.mjs`）。
  - N4: N4-G-S-0051..0060（各セット主軸3点・ラウンドロビンで似た点を分散）。N3: N3-G-S-0051..0070。
  - 各セット: {setId, scene, own_points:[{id,point,meaning,exampleJa}×3]}。
- **機械ゲート**: `scratchpad/pg/gen/gate_add.mjs`（`node gate_add.mjs <生成JSON> <N4|N3> <alloc.json>`）。構造/【1】〜【5】/4択/pointId実在/主軸3点網羅/当該級点≥3/字数帯(N4 340-460,N3 380-500)/ふりがな を検査。

## 作問ルール（正本＝md/08_文章の文法.md「★N4/N3」）
1文章5空所。**3空所=主軸点(指定id)・1空所=接続語・1空所=文脈語/N5**。各4択・正解1つは**前後2文以上で一意化**。誤答=文法成立だが文脈不成立の近い文型(同義肢禁止=二重正解防止)。ふりがな`漢字（かな）`必須。字数帯内。個人名なし・国/宗教中立。scene指定。

## スキーマ
- 生成JSON: `{"sets":[{"setId","scene","body(【1】〜【5】+ふりがな)","blanks":[{"blankNo","pointId","choices[4]","answerIndex","why"}×5]}]}`
- 本体schema: `content/problems/bunpou/passage_grammar_{N4,N3}.json` の items[]。question id=`${setId}-q${n}`・{id,blankNo,choices,answerIndex,i18n:{},pointId}。set={id,level,kind:'passageSet'?,passages:[{body}],questions,i18n:{},skeleton:{scene}}。既存itemの形に合わせる。

## ✅完了（2026-08-23 再実行）— カバー率N4/N3ともに100%
- 作問5体(Opus)→機械ゲートHARD0→一意性の独立反証(N4/N3各1体)。反証NG2件を修正: N4-G-S-0052 blank3(のに目的に ので/から競合→誤答をけれど/ばかり/ところへ) / N3-G-S-0053 blank5(まだに とても競合→誤答をいつもへ)。
- 本体追記: `passage_grammar_N4.json` 50→60 / `passage_grammar_N3.json` 50→70（インデントN4=2/N3=1・CRLF維持で差分は追記のみ）。manifest再生成済。
- **カバー率 N4 131/131=100% / N3 186/186=100%**（未カバー0）。
- テスト更新緑: passageGrammar(210・N5 80/N4 60/N3 70)/passageGrammarWire(210・N3 70)/passageTransNe(KNOWN_PG_UNTRANSLATED 180→210)/parity/manifest 全緑・tsc0。
- 正解位置は全て①だが**PassageSetPlayerがshuffleChoicesで毎回シャッフル**するため無害（リバランス不要・ユーザー確認済）。
- **残**: ①翻訳en/ne(新30セット・有料Gemini・見積承認後) ②bunshouGrammarBalance.test.ts の RUN_BALANCE=true化は場面多様性等の他基準も要充足ゆえ保留 ③反映は次ビルド(区切りで) ④scratchpad/pg/gen の生成物は完了後クリーン可。

## 次の一手（再開手順）
⚠️ /clear前に走っていたN4生成エージェント2体(0051-0055/0056-0060)の出力は**未捕捉**。**バックグラウンドagentの結果は/clearをまたいで確実に回収できない**ため、新セッションでは**配分表から作り直す**のが安全（作問=Opus本体・無料ゆえ再実行OK）。
1. N4生成: 配分に沿ってOpusで N4-G-S-0051..0060 を生成（1体≤8セット）→ `scratchpad/pg/gen/out_n4_add.json` 等へ保存。
2. `node scratchpad/pg/gen/gate_add.mjs <file> N4 scratchpad/pg/allocation/n4_add_alloc.json` でHARD0まで修正。
3. **一意性の独立反証**（別エージェントに本文＋各空所の4択を渡し「文脈で1つに決まるか」を盲判定→非一意を修正）。md/08「学び②」。
4. 本体反映: `content/problems/bunpou/passage_grammar_N4.json` の items に追記(既存50→60)。`content/_manifest.json`/`bundled.generated.ts` 再生成(build.ps1か再生成スクリプト)。
5. テスト更新: passageGrammar系の件数期待(N4 50→60)を直す。カバー率100%を確認したら `bunshouGrammarBalance.test.ts` の `COVERAGE_MIN=1.0`＋`RUN_BALANCE=true`化を検討(場面≥8系統/最頻≤20%/字数帯/集中≤3/級ミックス≥3も緑になること)。
6. 同手順で **N3 20セット(0051-0070)**。
7. 翻訳(en/ne)は後日・別途(有料Gemini・見積り承認後)。作問自体は無料。
8. 反映は次のビルド(区切りで)。

## カバー率の再計測
`node`で grammar.json + metricExcludedPoints.json + passage_grammar_{lv}.json を読み、当該級pointIdのユニーク数/級総点。100%到達確認に使う。
