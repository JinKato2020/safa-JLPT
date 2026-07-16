# Plan B 実装計画 — 問題の動的化・品質やり直し（N3/N4）マスタープラン

> **For agentic workers:** REQUIRED SUB-SKILL: 各大問の実行時に superpowers:subagent-driven-development（生成は #9 効率規定に従う）。本書は**マスタープラン**（4大問＝独立サブ系＋共通エンジン準備）。各大問は着手前に見積もりを提示→ユーザー承認→実行。

**Goal:** 試験タブの選択肢を動的化（誤答6プール→動的3→シャッフル）し、一意性・近接ダミー品質を本番同等に引き上げる。対象 **N3/N4のみ**。

**Architecture:** データ（`content/problems/**`）を6誤答形式へ拡張 → `rebuild.ts` で `bundled.generated.ts` へbake → 出題器（`daimon.ts questionForUnit`）が動的3抽出＋シャッフル。生成は少数の大型エージェント（自己検証内包）。

**Tech Stack:** TypeScript / node:test / tsx、コンテンツJSON、`tools/content/rebuild.ts`、生成=セッション内Opus/Sonnet（¥0・クォータ消費）。

## Global Constraints（全タスク共通・spec B + メモリ由来）

- **対象 N3/N4のみ。N5＝公式未学習で除外・保留。文章の文法（passage_grammar）＝後回し。用法（usage）＝6誤答化は済だが一意性欠陥あり（Sub-Plan Eで監査修正）。**
- **一意性厳守**（[[unique-answer-question-design]]）：正解は1つに定まる／ダミーは文脈上明確に誤り／stemに決定的手がかり。「ダミーも正解」「情報不足で選べない」を却下。
- **近接ダミー**：易しめ・荒唐無稽ダミー禁止。同意味フィールドの近接語・同音近義・選択制限の1歩外し。**L1中立**（[[usage-distractor-near-synonym]]）。
- **個人名なし・役割ベース**（先生/学生・店員/客等）（[[content-borderless-no-names]]）。
- **ルビ**：自レベル以上の漢字に括弧ふりがな。**文長は公式に倣い無駄に長くしない**。
- **動的化**：誤答6プール→出題ごと動的3抽出→シャッフル（用法と同じ）。組み立ては例外（断片は1文にしか収まらない＝6プール不可→断片シャッフル＋★回転）。
- **生成効率（#9・絶対厳守）**：read relay エージェント禁止（データは `args` で渡す）。1バッチ=1agentの細粒度禁止（**少数の大きめエージェントに束ねる**・目安 数千件でも30前後）。独立verify段は品質要求が特に高い時だけ（基本は gen内自己検証）。起動前に「agent総数は最小か」を自問。
- **モデル**：一意性・ダミー品質が命の生成は**Opus**（[[quality-critical-gen-use-opus]]）。純機械段のみ安価/ローカル可。
- **課金¥0・でもクォータ消費**：各大問の生成前に「agent数・概算トークン・クォータ影響」を提示→**ユーザー承認後に実行**。
- **バックアップ**：大量生成は10%ごとにバックアップ（中断救済）。

---

## Task 0（共通・先行）: エンジンとデータ形式の動的化下地

**Files:**
- Modify: `app/src/data/daimon.ts`（`questionForUnit` の `cx`/`sy`/`kr`/`og` 分岐）
- Test: `app/src/data/daimonDynamic.test.ts`（新規）

**現状:** バンク分岐（用法等）は既に `distractors.length > 3 ? sample(distractors,3,rng)` で動的3抽出済み。しかし `cx`/`sy`/`kr`/`og` の各分岐は `shuffleChoices([answer, ...choices.filter(≠answer)].slice(0,4),0,rng)` ＝**先頭3固定**（動的抽出でない）。

**Interfaces:**
- Consumes: `sample(arr,n,rng)`（`quiz/quiz.ts`・import済）、`shuffleChoices`。
- Produces: 6誤答を持つ cx/sy/kr/og ユニットが、出題ごとに動的3＋シャッフルされる。

- [ ] **Step 1:** `daimonDynamic.test.ts` に失敗テスト：`choices` が6個の cx ユニットを2回 `questionForUnit(unit, seededRng)` して、選ばれた誤答セットが変わり得ること（現状は先頭3固定で不変＝FAIL）。
- [ ] **Step 2:** `cx`/`sy`/`kr`/`og` の各分岐を次に統一：
  ```ts
  const ds = X.choices.filter((c) => c !== X.answer);
  const picked = ds.length > 3 ? sample(ds, 3, rng) : ds;
  const { choices, answerIndex } = shuffleChoices([X.answer, ...picked].slice(0, 4), 0, rng);
  ```
  （og/kr は `example`/`furiTarget` 等の他フィールドは維持）
- [ ] **Step 3:** テスト green。誤答3以下（既存データ）は従来どおり全使用＝後方互換。
- [ ] **Step 4:** `npm test` 全緑・`tsc` 緑。commit。

**注:** データ側が誤答3のままでも安全（`>3`条件）。各大問の6誤答化（下記A〜D）が入って初めて動的化が効く。

---

## Sub-Plan A: 組み立て（order）— 非一意の除去＋断片動的化（**最軽量・推奨1番手**）

**対象/現状:** `content/problems/bunpou/order_N{3,4}.json`（N3 252・N4も）。`{id:kb-, stem(★), question, answer, choices[4]}`。監査で `ambiguous:true`（配列が一意でない）＝ N4 127/N3 112（LIVE `BANK` は既に order×ambiguous を除外出題）。

**方針（生成ほぼ不要）:**
1. **一意性の確定**：`ambiguous` を恒久除去 or 修正。現状はLIVE除外済み＝出題プールは既に非ambiguousのみ。→ **カバレッジ確認**（除外後の残数が練習60日分に足りるか）。不足分のみOpusでN問 新規/修正（役割ベース会話文を活かす）。
2. **★回転の出題器**：同じ4断片で★位置を変えて複数問化（1文→複数問）。`questionForUnit` の order 分岐に「★位置を出題ごとに回転（answer断片を切替）」を追加。※6誤答プールは不可（断片は1文にしか収まらない）。
3. Test：★回転で同一 stem から複数の (answer, choices順) が出ること。

**Estimate:** 生成ほぼ0（不足分のみ）。agent数 0〜2（不足補充時のみ）。エンジン中心＝安い。

---

## Sub-Plan B: 文脈規定（context）— 近接ダミー総入替＋6プール（**大・要見積もり**）

**対象/現状:** `content/problems/moji_goi/context_N{3,4}.json`（**N3 2085**・N4 646）。`{id:cx:, prompt(〔　〕), answer, choices[3]}`。**stem・正解は活かす**（一意性OK）。欠陥＝易しめダミー（荒唐無稽）が半数前後。

**方針:**
1. **stem/answer/i18n.explain は保持**、`choices` を **近接型6誤答**に総入替（同意味フィールド近接語・同音近義・選択制限の1歩外し）。explain も新ダミーに合わせ更新。
2. データ形式：`choices`=[近接誤答6]（answerは別フィールドのまま）。Task 0 で動的3＋シャッフル対応済み。
3. **生成設計（#9）**：2085件を **args渡し**で **少数の大型エージェント**（目安 ~25〜30 agent・各70〜100件）に束ねる。各agentは (prompt, answer, level) を受け、6近接誤答＋更新explain(ja/ne)を返す。**gen内自己検証**（近接性・非正解性・L1中立を各agentがチェック）。独立verify段は無し（品質は厳格プロンプトで担保）、ただしサンプル抜き取り監査を最後に1agent。
4. **モデル**：近接ダミーは品質重要→**Opus**推奨（[[quality-critical-gen-use-opus]]）。機械的整形のみローカル。
5. rebuild → tsc → node実行スモーク（[[verify-runtime-not-just-build]]）→ commit（10%ごとバックアップ）。

**Estimate（承認対象）:** N3 2085×(6誤答+explain) ＋ N4 646。用法909誤答=4agentの実績から、~25〜30 Opus agent・概算 数百万トークン級。**着手前に円換算相当のクォータ影響を提示**。※N4スコープ（646全数か厳選か）は着手時に確認。

---

## Sub-Plan C: 言い換え（synonym）— 各級150新規・6プール（**中**）

**対象/現状:** `content/problems/moji_goi/synonym_N{3,4}.json`（N3 1001・旧形式：単語→類義単語 choices[3]）。

**設計判断（着手時に確定）:** spec B §3.3「例題文1＋選択肢文（短文12〜22字）＋誤答6」。ただし現行は **vocab-anchored（`<v>#synonym`）**＝合格率プール・単語タブ持ち込み（Task済）・カバー率がこのキーに依存。→ **推奨：vocab-anchoredを維持しつつ、各級150語を厳選し、6誤答＋（可能なら）選択肢文形式へ**（キー体系・持ち込み・カバー率を壊さない）。旧1001→150厳選でプール縮小＝カバー率分母が変わる点をユーザーに確認。

**方針:**
1. 各級150問を新規生成（例題文＋下線＋正解類義＋近接誤答6・近接類義の「あと一歩外し」[[usage-distractor-near-synonym]]）。ルビ・役割ベース。
2. データ：`{id:sy:<vid>, sentence, underline, word, answer, choices[6], i18n.explain}`。Task 0 で動的3。
3. 生成（#9）：300問を **~4〜8 Opus agent**（各40〜80問・自己検証内包）。args渡し。
4. rebuild→検証→commit。

**Estimate（承認対象）:** 300問×(例題+6誤答+explain)。~4〜8 Opus agent・数十万〜百万トークン級。

---

## Sub-Plan D: 文法形式（grammar_form）— 全面やり直し（**最難・最後・Opus必須**）

**対象/現状:** `content/problems/bunpou/grammar_form_N{3,4}.json`（N3 364・N4 262）。`{id:kb-, stem(〔　〕), answer, choices[4]}`。欠陥＝**一意にならない誤答が多い**（例「場合は」だが「ときは」も成立）。会話文ほぼ皆無。pointId未リンク多数。

**方針（+3でなく全面新規）:**
1. **全文法点を網羅**（N4 131点/N3 182点）。各点に 1例題＋**誤答6**（その文に文法的に付くが意味/接続/共起で**明確に誤り**）＋動的3＋シャッフル。
2. **正解が唯一に定まる決定的手がかり**を必ず入れる（[[unique-answer-question-design]]）。**会話文を混入**（A「…」B「…（　）…」）。
3. ⚠️**誤答は文をまたいでプール共有しない**（複合文節は文ごとに接続が変わる＝1問ごとに6誤答を厳選）。
4. **pointId整理**（grammar.json実在idへリンク）＝これが**後回しにした「文法の単語タブ持ち込み」（gBuild/gMeaning→文法形式）の前提**。整理後にリング側の文法持ち込みを別途実装可能に。
5. 生成（#9・品質最優先）：~313点×(2〜3問) を **~15〜25 Opus agent**（各点で自己検証：一意性・接続・共起・会話自然さ）。独立verify段を**この大問だけ**付ける価値あり（一意性が命）。args渡し。
6. rebuild→tsc→node実行スモーク→commit（10%ごとバックアップ）。

**Estimate（承認対象）:** ~600〜900問×6誤答＝最大級。**~15〜25 Opus agent・数百万トークン級**。最も高コスト＝**最後・単独で見積もり承認**。

---

## Sub-Plan E: 用法（usage）一意性監査・修正（**新規・生成の中で最優先＝実害あり**）

**背景（2026-07-17実測）:** 誤答を3→6に増やした際、**正しい用法を誤答として混入**した実害が判明。例：usg-「探す」で正解「いなくなった犬を町じゅう探した」に対し、誤答「川できれいな石を一つ探して持ち帰った」「町じゅう歩いて安い店を探した」が**どちらも正しい用法＝第2・第3の正解**（答えが一意でない）。用法は「完了」ではなく監査が必要だった。

**対象:** `content/problems/moji_goi/usage_N{3,4}.json`（＝`knowledgebank_N{3,4}.json` の usg-）。N3 150・N4 153、各 answer＋誤答6。

**方針:**
1. 全 usg- 問題の**6誤答を一意性監査**：各誤答文が「対象語の正しい用法として成立しないこと」を厳格判定。成立してしまう＝第2の正解＝要差替。
2. 成立する誤答を**明確な誤用**に差替（同漢字語形・近接類義・選択制限の1歩外し・コロケ崩し・多義の別義誤用 [[usage-distractor-near-synonym]]）。**正用文（answer）は保持**。役割ベース・ルビ維持。
3. 生成（#9・品質命）：303問の監査＋差替を**少数のOpusエージェント**（各50〜80問・自己検証＝各誤答を「正用として成立しないか自己反証」）。一意性が命なので**独立verify段を付ける**（別Opusが第2正解を探す）。args渡し・read禁止。
4. rebuild→tsc→node実行スモーク→commit。

**Estimate（承認対象）:** 303問の監査（多くは差替不要）＝~6〜8 Opus agent。用法誤答生成の実績（4agent）比で監査主体＝軽め。**実害があるため生成タスクの先頭で承認を求める。**

## 推奨実行順序

**Task 0（共通エンジン）→ A（組み立て・軽）→ E（用法一意性監査・実害）→ C（言い換え）→ B（文脈規定・大）→ D（文法形式・最難）**

理由：軽い・安いもの（Task0/A＝生成なし）を先に緑化。次に **E（既に出荷済みで誤答が一意でない実害）を生成タスクの先頭**に。B/D は各々単独でクォータ見積もり承認。文法持ち込み（保留中）はD完了（pointId整理）後に解禁。

## 移行・検証（全大問共通）

- 各大問：着手時に **source-of-truth 確認**（`content/problems/**` + `rebuild.ts` が LIVE か、`knowledgebank_N*.json` 併存かをTask 0扱いで確認）。
- 生成後：`rebuild.ts` → `tsc` → **node実行スモーク**（nullガード走査・2回出題で誤答セット変化）→ manifest count 確認 → commit。
- 生成→**対応管理Excel/データの最新化**（CLAUDE.md #9：乖離を残さない）。
- N5・文章の文法は本計画外（別途）。

## Self-Review（このプランの穴）

- 言い換えの「vocab-anchored維持 vs 150標準問題化」はキー体系・カバー率・単語タブ持ち込みに影響＝**着手時にユーザー確認**（本書で明示済）。
- 文脈N4・言い換えのスコープ（全数 vs 厳選）は着手時確認。
- 文法持ち込み（保留）はDのpointId整理が前提＝順序で担保。
