# 言い換えN5 文レベル作り直し（約199問）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **併読必須**: 設計＝`docs/superpowers/specs/2026-07-17-n5-synonym-sentence-level-design.md`
> ／ 手順＝スキル `daimon-question-build`（ただし §5.0 の2点は設計書の更新版が優先）
> ／ 作問の型＝`問題対策と問題作成.md` 第VI部 ④-N5

**Goal:** 言い換え類義N5の93問（形式がN3の語レベルで誤り・誤答が荒唐無稽）を、公式どおりの**文レベル**に作り直し、取りこぼしの66組とクロス2型40問を足して**約199問**にする。

**Architecture:** データのみで完結する。`stem` フィールドを足すと `app/src/data/daimon.ts:209` が文レベル出題へ**自動で切り替わる**ため、UIコードは触らない。生成はサブエージェント（Opus high・30問/体・計7体）、品質保証は**独立2パスの反証＋和集合削除**（ローカル機械処理・追加トークン0）。

**Tech Stack:** TypeScript / node:test（`--import tsx`）／ Python 3（workflowスクリプト組み立て・削除適用）／ Workflow ツール（サブエージェント）

## Global Constraints

設計書からの転記。**全タスクの要件に暗黙に含まれる。**

- **git リポジトリは `app/` のみ**。`docs/` はリポジトリ外＝コミット対象外。`cd app` してからコミットする
- **誤答の個数**: `negation_cross` / `perspective_cross` は**ちょうど3個**。それ以外は**5個**（不可なら4個→3個）
- **ルビ**: `stem` / `answer` / `choices` は**半角カッコ** `朝(あさ)`。`SENTENCE_FURI` は**全角カッコ** `朝（あさ）`。**両者は別物・機械変換で流用しない**
- **分かち書き**: N5は**必須**（`その 店は 朝から あいて います。`）。N4には無い
- **`sentence` / `underline` / `word` を消さない**（`daimon.ts:271` の学習カードが読む）
- **ゲートは入れない**（`edb076f` のユーザー判断。入れるとN5が出題0に戻る）
- **個人名なし・役割ベース**（先生/学生・店員/客 等）
- **ダミーは全てN5範囲内の実在語**。範囲外（感冒・乳酪・美味しい）は禁止＝易しくしてしまう
- **荒唐無稽な分野違いダミー禁止**（朝→午前 に 果物・電車・財布 の類）
- **モデルは Opus high**。誤答の質がこの作業の存在理由。安価モデルに落とさない
- **workflowスクリプトにデータをJSリテラルで埋め込む**（`args` は undefined になる事故あり）
- **改行は LF 必須**（CRLFはWorkflowが拒否）。Python書き出しは `newline='\n'` ＋ `assert b'\r' not in f.read()`（**バイナリで読む**）
- **run ID を必ず記録して報告する**（無いと救済できない）
- **報告は実測値のみ**。在庫件数・出題数を推測で語らない

## File Structure

| ファイル | 役割 | 作業 |
|---|---|---|
| `app/src/data/index.ts:200` | `SynonymBankItem` 型 | `pattern` 追加・誤コメント修正 |
| `app/src/data/synonymFormat.test.ts` | 形式テスト | N5=文レベル前提へ更新＋新テスト |
| `app/content/problems/moji_goi/synonym_N5.json` | **データ本体** | 93問を文レベル化＋106問追加 |
| `app/src/data/dict/sentenceFuri.json` | 学習カードのふりがな | 新規106問分を追加（現行 sy:n5- は85件） |
| `tools/build_synonym_n5_wf.py` | 生成workflow組み立て | **新規**（`build_synonym_wf.py` を参考） |
| `tools/build_synonym_n5_verify_wf.py` | 反証workflow組み立て（2パス） | **新規**（`build_synonym_verify_wf.py` を参考） |
| `tools/apply_synonym_n5_audit.py` | 和集合で誤答削除 | **新規**（`apply_synonym_audit.py` を参考） |
| `tools/harvest_workflow.py` | 救済 | **既存・再利用** |

---

### Task 1: 型に `pattern` を足し、事実と異なるコメントを直す

**Files:**
- Modify: `app/src/data/index.ts:196-201`

**Interfaces:**
- Consumes: なし（最初のタスク）
- Produces: `SynonymPattern` 型（`'noun' | 'adj' | 'verb' | 'hypernym' | 'negation_cross' | 'perspective_cross'`）と `SynonymBankItem.pattern?: SynonymPattern`。Task 3の生成物・Task 5のテストがこの名前と値に依存する

**なぜ必要か**: `pattern` が無いと「クロス型は誤答3個」をテストで検査できず、公式5型が揃っているかも確認できない。UIは読まない（表示に影響なし）。

- [ ] **Step 1: 現状のコメントと型を確認する**

Run: `cd app && sed -n '196,201p' src/data/index.ts`

Expected: 196行目に「未検証(旧=分野違いの易しすぎるダミー。例 作法→天気/音楽/地図)は出題しない(daimonUnitIdsで除外)」というコメントがある。**これは事実と異なる**（`edb076f` でゲートは廃止済み）。

- [ ] **Step 2: コメントを事実に直し、`pattern` を足す**

`app/src/data/index.ts` の該当ブロックを次で置き換える:

```ts
// 言い換え類義(大問4)の固定問題集。文＋下線部(underline=文中で下線を引くスパン)→意味が近い語を4択で。
// verified=誤答を作り直し、独立の反証で「第2の正解が無い」ことを確認済みの問題。
// ★出題ゲートは無い(edb076f・2026-07-17)。開発者しか触らないため未検証の旧問題も出す。
//   verified は「どこまで作り直したか」の進捗メタ。※以前の「未検証は出題しない」は事実と異なるため削除。
// stem=公式の文レベル形式(N4/N5)の出題文。stemがある問題は choices も文になる(語レベル=N3は sentence+underline)。
// pattern=作問の型。*_cross は build4Choices の動的3抽出でクロスが壊れるため誤答ちょうど3個(設計書 §4.3)。
export type SynonymPattern = 'noun' | 'adj' | 'verb' | 'hypernym' | 'negation_cross' | 'perspective_cross';
export interface SynonymBankItem { id: string; level: string; sentence: string; word: string; underline: string; answer: string; choices: string[]; reason?: string; reasonNe?: string; verified?: boolean; stem?: string; pattern?: SynonymPattern; }
export const SYNONYM_BANK = _R.SYNONYM_BANK as SynonymBankItem[];
```

- [ ] **Step 3: 型が通ることを確認する**

Run: `cd app && npx tsc --noEmit`
Expected: エラー0件（`pattern` は optional なので既存データは通る）

- [ ] **Step 4: 既存テストが緑のままであることを確認する**

Run: `cd app && node --import tsx --test src/data/synonymFormat.test.ts`
Expected: 6 tests pass, 0 fail（型追加は挙動を変えない）

- [ ] **Step 5: コミット**

```bash
cd app && git add src/data/index.ts && git commit -m "$(cat <<'EOF'
refactor(synonym): SynonymBankItem に pattern を追加＋ゲートに関する誤ったコメントを削除

- pattern=作問の型(noun/adj/verb/hypernym/negation_cross/perspective_cross)。
  *_cross は build4Choices の動的3抽出でクロスが壊れるため誤答ちょうど3個にする必要があり、
  型が無いとテストで検査できない(設計書 §4.1/§4.3)。
- 「未検証は出題しない(daimonUnitIdsで除外)」は 142b258 時代の記述で、edb076f の
  ゲート廃止時に消し忘れたもの。事実と異なるので削除し、現在の方針に書き換えた。
  挙動の変更なし。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: パイロット15問（★ユーザー承認ゲート・飛ばさない）

**Files:**
- Create: `tools/build_synonym_n5_wf.py`
- Create: `tools/build_synonym_n5_verify_wf.py`

**Interfaces:**
- Consumes: `SynonymPattern`（Task 1）
- Produces: 生成エージェントの返却スキーマ（Task 3が同じものを使う）:
  ```
  { items: [ { id, pattern, sentence, underline, word, stem, answer, choices[], sentenceFuri, reason } ] }
  ```
  反証エージェントの返却スキーマ（Task 4が同じものを使う）:
  ```
  { results: [ { id, validCount, validChoices: number[], verdict: 'unique'|'multi'|'bad_answer', note } ] }
  ```
  ★`validChoices` は **`choices` の添字(番号)**。テキストではない（ふりがな括弧で表記ゆれし空振りするため＝実績あり）

**なぜ飛ばさないか**: レシピがズレていたら199問が丸ごと無駄になる。ただし**パイロットの「率」は信じない**（10問で「N4=0%/N3=40%」と出たが本走行335問では両方約8%だった＝スキル鉄則1）。**作り方の検証にのみ使う。**

- [ ] **Step 1: パイロット対象15問を選ぶ**

6型から各2〜3問。既存93問から4問・未使用66組から5問・クロス新規6問。

Run:
```bash
cd "c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ" && python -c "
import json,io,sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
syn=json.load(io.open('app/src/data/dict/vocabSynonyms.json',encoding='utf-8'))
q=json.load(io.open('app/content/problems/moji_goi/synonym_N5.json',encoding='utf-8'))
items=q if isinstance(q,list) else (q.get('items') or list(q.values())[0])
used={x['id'][3:] for x in items}
v=json.load(io.open('app/src/data/shared/vocab.json',encoding='utf-8'))
vi=v if isinstance(v,list) else (v.get('items') or list(v.values())[0])
lv={x['word']:x['level'] for x in vi}
byid={x['id']:x for x in vi}
usable=[(k,s) for k,s in syn.items() if k.startswith('n5-') and lv.get(s) in ('N5','N4') and k not in used]
print('既存4問:', [(x['id'],x['word'],x['answer']) for x in items[:4]])
print('未使用5組:', [(k,byid.get(k,{}).get('word'),s) for k,s in usable[:5]])
"
```
Expected: 既存4問と未使用5組が表示される。**この出力をパイロットのデータとしてスクリプトに埋め込む**（`args` 禁止）。

- [ ] **Step 2: 生成workflowスクリプトを組み立てる**

`tools/build_synonym_n5_wf.py` を作る。参考＝`tools/build_synonym_wf.py`。要件:
- **データをJSリテラルで埋め込む**（`args` は undefined になる事故あり）
- `io.open(out, 'w', encoding='utf-8', newline='\n')` で書き出す
- 書き出し後に **バイナリで読み直して** `assert b'\r' not in open(out,'rb').read()`
- `sys.stdout.reconfigure(encoding='utf-8', errors='replace')`（cp932でprintが落ちる）
- agent が null を返す場合に備え、スクリプト側で `if (!gen || !gen.items) return {items:[]}` ／ `.filter(Boolean)`

生成プロンプトに**必ず埋める**もの（設計書 §4.2 / §4.6）:

```
【形式】公式N5=文レベル。提示文(stem)に対し、だいたい同じ意味の【文】を選ばせる。
  ・stem/answer/choices は全て「文」。語ではない。
  ・N5なので【分かち書き】する: 「その 店(みせ)は 朝(あさ)から あいて います。」
  ・ルビは【半角カッコ】: 朝(あさ)。全角（）は使わない。
  ・提示文と正解は【対象語だけが違う】。周辺は1文字も変えない(公式の作り)。
  ・sentenceFuri は別途【全角カッコ】で返す: 「その 店（みせ）は 朝（あさ）から あいて います。」

【型と誤答数】
  noun/adj/verb/hypernym … 誤答5個
  negation_cross/perspective_cross … 誤答ちょうど3個(2×2クロスの残り3セル。4個にすると壊れる)

【誤答の作り方】
  ・同一意味フィールドで揃える(時間なら時間だけ・色なら色だけ)＝分野で消せない
  ・同一品詞・同一文型スロット＝文法で消せない
  ・連想の罠(near-miss)を必ず1つ。adj では【正解の対義語】を1つ入れる
  ・hypernym は同じ関係の別ペア(祖父母/兄弟/姉妹)で揃える

【禁止】
  ・荒唐無稽な分野違いダミー。実例(現行アプリの欠陥そのもの):
      朝→午前 に 果物・電車・財布 / 家→うち に 料理・名前・趣味 / 入口→玄関 に 天気・名前・値段
    これらは語の意味を知らなくても当てずっぽうで消せる＝測定にならない。絶対に作らない。
  ・N5範囲外の語(感冒・乳酪・直ちに・高価・美味しい)。易しくしてしまう
  ・個人名(役割ベースで書く: 先生/学生・店員/客)

【★一意性テスト(ここで過去に失敗した)】
  各誤答を文に代入し「意味が保たれるか」テストせよ。少しでも成り立つ語は【第2の正解】＝不可。
  自分が確定した正解の近縁語を誤答にするな(最頻出の失敗)。
  実際に見逃された例:
    刷る/印刷する に対する「コピーする」…「ポスターを百枚コピーした」は自然で意味が重なる＝失格
    活気/活力 に対する「熱気」「エネルギー」…「町は熱気にあふれていた」も成立＝失格
    探す の用法で「川で石を探した」「安い店を探した」…両方とも正しい＝失格
  一意な5個目が作れないなら4個でよい。【減らすのは正当な判断で減点ではない】。
```

- [ ] **Step 3: 反証workflowスクリプトを組み立てる（2パス）**

`tools/build_synonym_n5_verify_wf.py` を作る。参考＝`tools/build_synonym_verify_wf.py`。
**生成役とは別のエージェント**に、**暴くことだけ**をさせる:

```
目的は【第2の正解】を暴くこと。厳しく判定せよ。
answer と各 distractor を stem に代入し、だいたい同じ意味が成り立つか判定。
少しでも成り立つものは valid。基準は緩めに(=疑わしきは valid にして拾う)。
実際に見逃された例: 刷る/印刷する に対する「コピーする」、活気/活力 に対する「熱気」「エネルギー」。
この水準の重なりは valid とせよ。
valid≥2 → verdict='multi'(非一意) / answerのみ → 'unique' / answerすら不成立 → 'bad_answer'
★validChoices は choices の【添字(0始まりの番号)】で返せ。文字列で返すな。
```

要件:
- **パスB はバッチを固定シードでシャッフルして切り直す**（同じ問題が別の隣人と判定される＝相関しにくい）
- パスA/パスB を別 run として起動できること

- [ ] **Step 4: パイロットを走らせる（生成→反証2パス）**

Run: Workflow ツールで `tools/build_synonym_n5_wf.py` が出力したスクリプトを起動。
Expected: 15問が返る。**run ID を記録する。**

続けて反証2パスを起動し、それぞれの run ID も記録する。

- [ ] **Step 5: パイロット結果をユーザーに提示して承認を得る ★ここで止まる**

提示するもの:
- 15問すべての stem / answer / choices（型ごとに並べる）
- 反証2パスの判定（unique / multi / bad_answer）と**和集合**
- **パスAとパスBの食い違い件数**（1パスでは何件取りこぼしたか＝2パスの価値の実測）
- 使ったモデルと消費トークン

**承認が出るまで Task 3 に進まない。** 率ではなく**作り方**を見てもらう。

---

### Task 3: 本走行 — 生成（7体・約84万トークン）

**Files:**
- Modify: `tools/build_synonym_n5_wf.py`（パイロットの指摘を反映）

**Interfaces:**
- Consumes: Task 2 で承認された生成プロンプトと返却スキーマ
- Produces: 199問の生成物（journal.jsonl 経由でディスク上）

- [ ] **Step 1: パイロットの指摘をプロンプトに反映する**

ユーザー承認時の指摘を、Task 2 Step 2 のプロンプトへ反映する。

- [ ] **Step 2: 199問を7バッチ（30問/体）に束ねる**

内訳（設計書 §4.4）:

| バッチ | 問数 | 出所 | `pattern` |
|---|---:|---|---|
| 1〜4 | 93 | 既存93問（文レベル化＋誤答作り直し） | `noun`/`adj`/`verb`/`hypernym` を生成時に判定 |
| 5〜6 | 66 | 未使用の使えるペア66組 | 同上 |
| 7 | 40 | クロス新規（否定20・視点20） | `negation_cross` / `perspective_cross` |

**1バッチ=1agentの細粒度分割は禁止**（規定8）。30問/体に束ねる。

- [ ] **Step 3: LF と埋め込みデータを検証する**

Run:
```bash
cd "c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ" && python -c "
import io,sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
b=io.open('<生成されたスクリプトのパス>','rb').read()
assert b'\r' not in b, 'CRLF混入=Workflowが拒否する'
print('LF OK / bytes=', len(b))
print(b.decode('utf-8')[:600])
"
```
Expected: `LF OK` と、**先頭に実データが埋め込まれていること**（`undefined` が出ていないこと）を目視確認。

- [ ] **Step 4: 生成を起動する**

Workflow ツールで起動。`pipeline(BATCHES, gen)` でバッチごと独立に流す（バリア不要）。

**run ID を必ず記録して報告する。** 30問＝全体の約15%ごとに journal.jsonl へ自動追記されるため、
落ちても `Workflow({scriptPath, resumeFromRunId})` で完了分は**0トークン**復元できる。

- [ ] **Step 5: 生成結果を実測する（推測禁止）**

Run:
```bash
cd "c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ" && python tools/harvest_workflow.py <runId> -o pilot_out/gen_n5.json && python -c "
import json,io,sys,collections
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
d=json.load(io.open('pilot_out/gen_n5.json',encoding='utf-8'))
items=[x for b in d for x in (b.get('items') or [])]
print('生成件数:', len(items))
print('pattern分布:', dict(collections.Counter(x.get('pattern') for x in items)))
print('誤答数分布:', dict(collections.Counter(len(x.get('choices',[])) for x in items)))
cross=[x for x in items if str(x.get('pattern','')).endswith('_cross')]
bad=[x['id'] for x in cross if len(x.get('choices',[]))!=3]
print('★クロス型で誤答3個でないもの:', bad)
print('★空返しagent:', [i for i,b in enumerate(d) if not (b.get('items') or [])])
"
```
Expected: 生成件数 ≒199 / クロス型は全て誤答3個 / 空返しagentが無い。
**空返しがあれば `resumeFromRunId` で埋める**（0トークンで復元）。

---

### Task 4: 反証2パス＋和集合で削除（14体・約56万トークン）

**Files:**
- Create: `tools/apply_synonym_n5_audit.py`

**Interfaces:**
- Consumes: Task 3 の生成物 `pilot_out/gen_n5.json`、Task 2 の反証スキーマ
- Produces: 確定データ `pilot_out/synonym_N5_final.json`（Task 5 が投入する）

**なぜ2パスか**（設計書 §5.0）: 同じ問題を2回判定させると結果が**約41%食い違う**。1パスでは用法で約12%・言い換えで**26〜29%**取りこぼす。スキルの「非一意8%」は**過小評価**だった。

- [ ] **Step 1: 反証パスAを起動する**

Workflow で起動（7体・30問/体）。**run ID を記録。**

- [ ] **Step 2: 反証パスBを起動する（バッチを切り直す）**

**固定シードでシャッフルしてバッチを切り直す。** 同じ問題が別の隣人と一緒に判定されるため、
判定が相関しにくく取りこぼしを拾いやすい（同一バッチの再実行では相関して意味が薄い）。
**run ID を記録。**

- [ ] **Step 3: 和集合を取って削除するスクリプトを書く**

`tools/apply_synonym_n5_audit.py` を作る。参考＝`tools/apply_synonym_audit.py`。方針:

- **どれか1パスでも valid なら削除**する（損害が非対称: 誤って消す＝軽微・下限で保護 ／ 第2の正解を見逃す＝**バグ出荷**）
- **選択肢は番号(添字)で同定する。** テキスト照合は**ふりがな括弧の表記ゆれで空振りする**（削除したつもりが削除されない＝実績あり）
- **追加生成しない。** 削除するだけ＝新しい第2の正解が構造的に入らない（修理段は実際に4件の新バグを作った）
- 削除後の下限:

| 型 | 下限 | 割ったら |
|---|---|---|
| 非クロス | 誤答3個 | 5→4→3 まで減らして確定。3未満なら**変更せず報告**し個別対応 |
| `*_cross` | **3個ちょうど** | 1個でも消えたら**クロスが壊れる**＝軸選びの失敗。**その問題を捨てて別の軸で作り直す**（4択に減らさない） |

- [ ] **Step 4: 削除を適用し、実測する**

Run:
```bash
cd "c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ" && python tools/apply_synonym_n5_audit.py --gen pilot_out/gen_n5.json --pass-a <runIdA> --pass-b <runIdB> -o pilot_out/synonym_N5_final.json --report pilot_out/audit_n5.md
```
Expected: レポートに次が出る。**すべて実測値で報告する**:
- パスAのみが指摘した件数 / パスBのみが指摘した件数 / 両方が指摘した件数
- **＝1パスなら何件取りこぼしたか**（2パスの価値の実測）
- 誤答が下限を割った問題のリスト（個別対応が要るもの）
- クロス型で軸が壊れた問題のリスト（作り直しが要るもの）

- [ ] **Step 5: 下限割れとクロス破損を個別対応する**

報告されたものだけ手当てする。**追加のエージェントは立てない**（少数なのでこの場で書く）。
クロス型の作り直しは、別の軸（例: {あかるい, しずか} が駄目なら {おおきい, あたらしい}）で組み直す。

---

### Task 5: データ投入＋テスト（TDD・1コミット）

**Files:**
- Modify: `app/content/problems/moji_goi/synonym_N5.json`
- Modify: `app/src/data/dict/sentenceFuri.json`
- Modify: `app/src/data/synonymFormat.test.ts`

**Interfaces:**
- Consumes: `pilot_out/synonym_N5_final.json`（Task 4）、`SynonymPattern`（Task 1）
- Produces: 出題可能な199問

- [ ] **Step 1: 失敗するテストを書く**

`app/src/data/synonymFormat.test.ts` の**ファイル冒頭コメントを事実に合わせて直し**（現在の
「N4公式=文レベル / N3・N5=語レベル」は投入後に**嘘になる**）、次のテストを追加する:

```ts
// 冒頭コメントを次に差し替える:
// 言い換えの公式形式2通り＋データ整合。実行: node --import tsx --test src/data/synonymFormat.test.ts
// N4・N5公式=文レベル(選択肢も文) / N3=語レベル(下線語→語)。同じ大問名だが選択肢の単位が違う。
// 出題ゲートは無い(edb076f・2026-07-17)。verified は進捗メタ。

test('N5言い換え: 全問が文レベル(stem有)＝公式形式。語レベル(N3形式)に戻っていない', () => {
  const n5 = SYNONYM_BANK.filter((e) => e.level === 'N5');
  assert.ok(n5.length > 150, `N5が作り直し後の規模: ${n5.length}`);
  for (const e of n5) assert.ok(e.stem, `${e.id}: stem が無い(語レベルのまま)`);
});

test('N5言い換え: sentence/underline/word を保持(学習カードが読む)', () => {
  for (const e of SYNONYM_BANK.filter((x) => x.level === 'N5')) {
    assert.ok(e.sentence, `${e.id}: sentence が消えている=学習カードが壊れる`);
    assert.ok(e.underline, `${e.id}: underline が消えている`);
    assert.ok(e.word, `${e.id}: word が消えている`);
  }
});

test('N5言い換え: クロス型は誤答ちょうど3個(build4Choicesの動的3抽出で壊れないため)', () => {
  const cross = SYNONYM_BANK.filter((e) => e.level === 'N5' && e.pattern?.endsWith('_cross'));
  assert.ok(cross.length > 0, 'クロス型が実在する(=テストが空回りしていない)');
  for (const e of cross) {
    const d = e.choices.filter((c) => c !== e.answer);
    assert.equal(d.length, 3, `${e.id}: クロス型の誤答が${d.length}個(3個でないとクロスが毎回1セル欠ける)`);
  }
});

test('N5言い換え: 非クロス型の誤答は3〜5個・全問に pattern がある', () => {
  const PATTERNS = ['noun', 'adj', 'verb', 'hypernym', 'negation_cross', 'perspective_cross'];
  for (const e of SYNONYM_BANK.filter((x) => x.level === 'N5')) {
    assert.ok(e.pattern && PATTERNS.includes(e.pattern), `${e.id}: pattern が無い/不正: ${e.pattern}`);
    if (e.pattern.endsWith('_cross')) continue;
    const d = e.choices.filter((c) => c !== e.answer);
    assert.ok(d.length >= 3 && d.length <= 5, `${e.id}: 誤答が${d.length}個`);
  }
});

test('N5言い換え: 分かち書きがある(N5のみ。N4には無い)', () => {
  const n5 = SYNONYM_BANK.filter((e) => e.level === 'N5');
  const spaced = n5.filter((e) => /\s/.test(e.stem!));
  assert.ok(spaced.length > n5.length * 0.9, `大半が分かち書き: ${spaced.length}/${n5.length}`);
});

test('N5言い換え: ルビは半角カッコ(N4と同形式・RubyTextが読む)', () => {
  for (const e of SYNONYM_BANK.filter((x) => x.level === 'N5')) {
    assert.ok(!/（/.test(e.stem!), `${e.id}: stem に全角カッコ(SENTENCE_FURI用)が混入`);
    for (const c of e.choices) assert.ok(!/（/.test(c), `${e.id}: 選択肢に全角カッコが混入`);
  }
});

test('N5言い換え: SENTENCE_FURI が全問にある(学習カードのルビ)', () => {
  for (const e of SYNONYM_BANK.filter((x) => x.level === 'N5')) {
    assert.ok(SENTENCE_FURI[e.id], `${e.id}: sentenceFuri が無い=学習カードのルビが出ない`);
  }
});

test('出題数: N5が増えている・0でない(edb076fで直した「出題0」の再発防止線)', () => {
  assert.ok(daimonUnitIds('N5', 'synonym', 'all').length > 150, 'N5の言い換えが出題される');
});

test('出題数: N4=185/N3=1000 が変わらない(本波はN5だけに触る=巻き込み事故の防止線)', () => {
  // 実測値(2026-07-17・投入前): N5=93 / N4=185 / N3=1000
  assert.equal(daimonUnitIds('N4', 'synonym', 'all').length, 185);
  assert.equal(daimonUnitIds('N3', 'synonym', 'all').length, 1000);
});
```

`SENTENCE_FURI` の import を足す: `import { SYNONYM_BANK, SENTENCE_FURI } from './index.ts';`

また既存の**「語レベル(stem無)」テスト（30行目）は `LEVELS` を回している**。N5が文レベル化すると
N5は該当しなくなりN3だけで `checked > 0` を満たす＝**緑のままだが意味が変わる**。
テスト名を `'語レベル(stem無=N3のみ)は「意味がいちばん近い語」を問い、下線が引かれる'` に更新する。

- [ ] **Step 2: テストを走らせて【落ちる】ことを確認する**

Run: `cd app && node --import tsx --test src/data/synonymFormat.test.ts`
Expected: **FAIL**。`N5言い換え: 全問が文レベル(stem有)` が `stem が無い(語レベルのまま)` で落ちる（現データは stem=0/93）。
**ここで落ちなければテストが空回りしている。**

- [ ] **Step 3: データを投入する**

`pilot_out/synonym_N5_final.json` を `app/content/problems/moji_goi/synonym_N5.json` へ、
ふりがなを `app/src/data/dict/sentenceFuri.json` へマージする（既存の sy:n5- 85件は上書き）。

**ふりがなは LLM が正本**（MeCab/`gen_furigana.py` は18%誤るので流用禁止＝[[sentence-furigana-needs-llm]]）。
Task 3 の生成物に含まれる `sentenceFuri` を使う。

- [ ] **Step 4: テストを走らせて【通る】ことを確認する**

Run: `cd app && node --import tsx --test src/data/synonymFormat.test.ts`
Expected: **全テスト PASS**

Run: `cd app && npm test`
Expected: 全テスト PASS（`daimon4choices.test.ts` / `contextGate.test.ts` を巻き込んでいないこと）

Run: `cd app && npx tsc --noEmit`
Expected: エラー0件

- [ ] **Step 5: クロス型テストが空回りでないことを確認する**

クロス型の1問だけ誤答を4個にした偽データを一時的に作り、テストが**落ちること**を確認してから戻す。

Run: `cd app && node --import tsx --test src/data/synonymFormat.test.ts 2>&1 | grep -c "クロス型の誤答が4個"`
Expected: `1`（落ちる）。確認後、偽データを戻して再実行し PASS を確認する。

- [ ] **Step 6: コミット**

```bash
cd app && git add content/problems/moji_goi/synonym_N5.json src/data/dict/sentenceFuri.json src/data/synonymFormat.test.ts && git commit -m "$(cat <<'EOF'
feat(synonym): 言い換えN5を公式の文レベルへ作り直し(93→約199問・独立2パス反証)

公式N5は「文とだいたい同じ意味の文を選ぶ」文レベル(N4と同形式)だが、アプリの93問は
語レベル(N3形式)で【形式が丸ごと誤り】だった(stem保有=0/93・実測)。誤答も荒唐無稽で
(朝→午前 に 果物・電車・財布)、語の意味を知らなくても消せる=測定になっていなかった。

- 93問を文レベル化＋誤答を全て作り直し。stem を足すと daimon.ts:209 が自動で
  文レベル出題へ切り替わるためUIコードの変更なし。sentence/underline は学習カード
  (daimon.ts:271)が読むので保持。
- 取りこぼしていた66組を追加(vocabSynonyms.json の N5 425組のうち、答えがN5/N4範囲内は
  114組。残りは感冒・乳酪などの範囲外語)。
- 公式の山場2型(反対語の否定・授受の視点転換)を新規40問。これらは語→語の類義ではないため
  vocabSynonyms.json に構造上0件だった。
- pattern=*_cross は誤答ちょうど3個。build4Choices が4個以上だと動的に3個抽出するため、
  2×2クロスの1セルが毎回欠けて壊れる。
- 品質保証=独立2パスの反証＋和集合削除。1パスでは26〜29%取りこぼす(実測)。追加生成せず
  削除のみ=新しい第2の正解が構造的に入らない。

ゲートは入れない(edb076f のユーザー判断を維持)。

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 実行時検証と報告（ビルド緑 ≠ 実行時安全）

**Files:** なし（検証のみ）

**Interfaces:**
- Consumes: Task 5 の投入済みデータ

**なぜ必要か**: `tsc` とテストが緑でも実機で落ちた実績がある（[[verify-runtime-not-just-build]]）。
真っ白クラッシュの教訓＝**生成データ走査は node 実行で検証する**。

- [ ] **Step 1: 全199問を実際に出題させて走査する**

Run:
```bash
cd app && node --import tsx -e "
import { daimonUnitIds, questionForUnit } from './src/data/daimon.ts';
import { learnCardForUnit } from './src/data/daimon.ts';
const rng = () => 0.5;
let q0 = 0, c0 = 0;
const units = daimonUnitIds('N5', 'synonym', 'all');
console.log('N5 言い換え 出題ユニット数 =', units.length);
for (const u of units) {
  const q = questionForUnit(u, rng);
  if (!q) { console.log('★問題が作れない:', u); q0++; continue; }
  if (q.choices.length !== 4) console.log('★4択でない:', u, q.choices.length);
  if (q.choices[q.answerIndex] === undefined) console.log('★正解が無い:', u);
}
console.log('問題化できない:', q0);
"
```
Expected: `出題ユニット数 = 約199` / `問題化できない: 0` / 星印の警告なし

- [ ] **Step 2: 学習カードが壊れていないことを確認する（sentence を消していない証明）**

Run:
```bash
cd app && node --import tsx -e "
import { daimonUnitIds, learnCardFor } from './src/data/daimon.ts';
let bad = 0;
for (const u of daimonUnitIds('N5', 'synonym', 'all')) {
  const c = learnCardFor(u);
  if (!c || !c.note) { console.log('★カードが作れない/noteが空:', u); bad++; }
}
console.log('学習カード異常:', bad);
"
```
Expected: `学習カード異常: 0`

※`learnCardFor` は `app/src/data/daimon.ts:243`（実測 2026-07-17）。`note` は
`markFuri(SENTENCE_FURI[sy.id] ?? sy.sentence, sy.underline)` で作られる＝**`sentence` と `underline` を
消していないことの証明**になる。ここが 0 でなければ Task 5 でフィールドを落としている。

- [ ] **Step 3: 4択のシャッフルでクロスが壊れないことを確認する**

Run:
```bash
cd app && node --import tsx -e "
import { daimonUnitIds, questionForUnit } from './src/data/daimon.ts';
import { SYNONYM_BANK } from './src/data/index.ts';
const cross = SYNONYM_BANK.filter(e => e.level==='N5' && e.pattern?.endsWith('_cross'));
console.log('クロス型:', cross.length, '問');
let broken = 0;
for (const e of cross) {
  const u = e.id.slice(3) + '#synonym';
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    const q = questionForUnit(u, () => Math.random());
    for (const c of q.choices) seen.add(c);
  }
  // 誤答3個＋正解1個 = 4個。毎回全部出るはず(動的抽出が起きない)
  if (seen.size !== 4) { console.log('★クロスが壊れている:', e.id, '出た選択肢=', seen.size); broken++; }
}
console.log('クロス破損:', broken);
"
```
Expected: `クロス破損: 0`（誤答3個なので `build4Choices` の動的抽出が発動せず、毎回同じ4択になる）

- [ ] **Step 4: 実測値だけで報告する**

報告に**必ず含める**もの:
- **モデル名と消費トークン**（例: 「Opus 4.8 で生成7体＋反証14体＝計21体・約140万トークン。課金は定額内＝**¥0**、ただしセッションのクォータを約140万消費」）
- **実測した件数**（N5言い換え 93問 → ◯◯問。`pattern` 別の内訳）
- **反証2パスの食い違い実測**（パスAのみ◯件／パスBのみ◯件／両方◯件＝1パスなら◯件取りこぼしていた）
- **全 run ID**（生成／反証A／反証B）
- 落とした問題・減らした誤答の件数（**減らすのは正当な判断**）

- [ ] **Step 5: テスト用の残骸を掃除する**

Run: `cd "c:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ" && ls pilot_out/`
使い捨ての中間ファイル（`gen_n5.json` 等）を確認して削除し、作業ツリーを綺麗に保つ（CLAUDE.md #3）。
`audit_n5.md`（実測レポート）は残す判断もある＝ユーザーに確認する。

---

## 完了チェックリスト（スキル §8＋本設計）

- [ ] パイロットでユーザー承認を得たか（Task 2 Step 5）
- [ ] 独立反証を**2パス**通したか（1パスでは26〜29%取りこぼす）
- [ ] 削除は**番号(添字)**で同定したか（テキスト照合は表記ゆれで空振り）
- [ ] **追加生成をしていない**か（修理段は新バグを作る）
- [ ] 誤答の個数: 非クロス3〜5個／**クロスちょうど3個**
- [ ] 荒唐無稽ダミーが無いか（分野違い＝当てずっぽうで消せる）
- [ ] N5範囲外の語（感冒・乳酪・美味しい）が無いか
- [ ] 個人名なし・役割ベースか
- [ ] 分かち書きがあるか／ルビは半角カッコか／`sentenceFuri` は全角カッコか
- [ ] `sentence`/`underline`/`word` を残したか（学習カード）
- [ ] **ゲートを入れていない**か（入れるとN5が出題0に戻る＝今朝直した事故）
- [ ] N4=185／N3=1000 を巻き込んでいないか
- [ ] テストが**空回りしていない**か（偽データで落ちることを確認したか）
- [ ] **node で実行時走査**したか（ビルド緑≠実行時安全）
- [ ] run ID を報告したか／`harvest` で救済できるか
- [ ] **実測した数字だけを報告した**か
- [ ] 使ったモデルと実費を報告したか（定額内＝¥0だが**quotaは消費**）
- [ ] テスト残骸を掃除したか
