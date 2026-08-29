# -*- coding: utf-8 -*-
"""N3 用法(⑤文字・語彙)の新規作問Workflowを生成する（生成のみ・検証/反証なし）。

用途: usage backlog から選んだ対象語について、1語=1問(4択)を作る。
- 正用文1＋近接類義/選択制限/自他等の誤用文3。各誤用に repl(その文で正しくなる語)/type(殺し方)を付ける。
- データは args を使わず JS リテラルで埋め込む（args=undefined 全滅の再発防止）。改行は LF のみ。
使い方: python tools/gen_usage_workflow.py [BATCH]
入力: scratchpad/usage_n3_300/targets.json  ({vocabId, word, reading, meaning, pos, synonym, kanjiMax, risk})
出力: scratchpad/usage_n3_300/wf_usage_N3.mjs
"""
import io, json, os, sys, math

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRP = os.path.join(ROOT, 'scratchpad', 'usage_n3_300')
LEVEL = 'N3'

tgt = json.load(io.open(os.path.join(DIRP, 'targets.json'), encoding='utf-8'))
BATCH = int(sys.argv[1]) if len(sys.argv) > 1 else 20
batches = [tgt[i:i + BATCH] for i in range(0, len(tgt), BATCH)]

GEN_RULES = r'''あなたはJLPT N3「用法(⑤文字・語彙)」の作問担当です。渡された対象語について、1語につき1問(4択)を作ります。**最も誤答が出やすい大問**なので一意性を厳守します。

## 大問の形式
- 対象語を1つ提示し、その語を**正しく使っている文**を4択から選ばせる。各選択肢は別々の文。
- 正解＝対象語を**自然に正しく使った文(correct)**。誤答3＝対象語を入れると**不自然になる文**（その文脈では別の語が正しい）。

## 【最重要=一意性】正解は1つだけ・誤答に第2の正解を作らない
- 誤答文は「対象語を入れると明確に誤り／不自然」でなければならない。**対象語もギリギリ使える文は誤答にしない**（=第2正解事故。過去に「探す」で両方正しくなり非一意化した実バグあり）。
- 誤答文は「その文脈で正しくなる別語(repl)」が必ず1つ存在するように作る。repl を入れれば自然、対象語だと不自然、が理想。

## ダミー設計（最強の型＝近接類義語の置換）
対象語と同じ意味フィールドの**近接類義語がそれぞれ最適になる文脈**を作り、対象語だけが不自然になるようにする。
- 例(届ける=遠い場所/相手へ物を到達させる): 正用「落とした財布を交番に届けた」。誤答①「本を棚の上に届ける」→repl=のせる ②「父に塩を届ける」→repl=渡す ③「妻を車で会社に届ける」→repl=送る。
- 手順: (1)対象語の意味フィールドと固有ニュアンス(距離/直接性/対象の有生無生/フォーマルさ)を特定 (2)近接類義語を選ぶ (3)各語が最適になる文脈を1文ずつ作る (4)対象語を入れると不自然と確認。

## 殺し方(type)のタクソノミー ＝ 各誤答に type と repl を付ける
- **自他**: 自動詞↔他動詞(冷める↔冷やす/割れる↔割る)。同じ漢字家族で語形違い。
- **近接**: 近接類義語の置換(届ける→のせる/渡す/送る)。
- **選択**: 選択制限の1歩外し(故障=機械限定→コップ/指/本に使う誤り)。
- **コロケ**: 共起枠のズレ(「きれいに〜ておく」に合う/合わない)。
- **別義**: 多義/多読の別義・統語/格の誤り(勉強を苦労します 等)。
- **呼応**: 副詞の呼応ズレ(ちっとも＋肯定 等)。
- **対義/授受**: 対義語・やりもらいのズレ。

## ★ダミーの多様性(番人あり・厳守)
- **(P1) 1問内で repl(その誤答が正しくなる語)を3つとも別語にする**。同じ置換語を2回使わない(自他2連発禁止)。
- **(P2) 3誤答の type を2種以上に散らす**(理想3種)。例外＝選択制限型(故障)や否定呼応型など公式が認める単一殺し方の良問のみ。

## N3の文づくり
- 場面を描いて手がかりを出す(語を知らなくても文脈でニュアンスが分かる)。文は概ね15〜40字。
- 漢語名詞・複合動詞・やや抽象語も可。**個人名を使わない**(役割で: 先生/店員/客/同僚/近所の人)。国・宗教・政治的に中立。
- **ルビは書かない**(後で機械が振る)。括弧補足も付けない。対象語は正用文では活用/助詞をその文に合わせてよいが語幹は保つ。
- 対象語の**漢字が大問級(N3)より上の場合、同音異字(同じ読みの別漢字)ダミーは使わない**(ルビで同読み化し非一意になる)。近接類義・選択制限・自他で外す。

## 品質チェック（出力前に必ず・生成のみ＝あなたの自己検算が最終）
1. 正解文は対象語が自然に正用されているか。
2. 誤答3は対象語だと明確に不自然で、repl を入れれば自然になるか。**対象語も成立してしまう誤答は書き直す**。
3. P1(repl全て別語)・P2(type2種以上)を満たすか。
4. 個人名・ルビ・括弧補足が無いか。'''

GEN_SCHEMA = {
    'type': 'object', 'required': ['items'],
    'properties': {'items': {'type': 'array', 'items': {
        'type': 'object', 'required': ['vocabId', 'word', 'correct', 'distractors'],
        'properties': {
            'vocabId': {'type': 'string'},
            'word': {'type': 'string', 'description': '提示する語(targetsのwordそのまま)'},
            'correct': {'type': 'string', 'description': '対象語を正しく使った正用文(ルビ無し)'},
            'distractors': {
                'type': 'array', 'minItems': 3, 'maxItems': 3,
                'items': {
                    'type': 'object', 'required': ['sentence', 'repl', 'type'],
                    'properties': {
                        'sentence': {'type': 'string', 'description': '対象語だと不自然な誤用文(ルビ無し)'},
                        'repl': {'type': 'string', 'description': 'その文脈で正しくなる別語'},
                        'type': {'type': 'string', 'enum': ['自他', '近接', '選択', 'コロケ', '別義', '呼応', '対義', '授受']},
                    }}},
        }}}},
}

js = f'''export const meta = {{
  name: 'usage-n3-gen',
  description: 'N3用法 {len(tgt)}語を新規作問（4択・生成のみ・自己検算）',
  phases: [
    {{ title: '作問', detail: '{BATCH}語×{len(batches)}体・Opus high・検証なし' }},
  ],
}}

const GEN_RULES = {json.dumps(GEN_RULES, ensure_ascii=False)}
const GEN_SCHEMA = {json.dumps(GEN_SCHEMA, ensure_ascii=False)}
const BATCHES = {json.dumps(batches, ensure_ascii=False)}

const out = await pipeline(
  BATCHES,
  (batch, _orig, i) =>
    agent(GEN_RULES + '\\n\\n## 対象語(' + batch.length + '語)\\n各語について1問。wordは必ずそのまま使う。\\n' + JSON.stringify(batch),
      {{ label: 'usage:b' + (i + 1), phase: '作問', schema: GEN_SCHEMA, effort: 'high' }}),
)
const good = out.filter(Boolean).flatMap((r) => (r && Array.isArray(r.items)) ? r.items : [])
const emptyBatches = out.filter(Boolean).filter((r) => !r || !Array.isArray(r.items) || !r.items.length).length
log('作問=' + good.length + '問 / 空バッチ=' + emptyBatches)
return {{ level: '{LEVEL}', good, emptyBatches }}
'''

out = os.path.join(DIRP, 'wf_usage_N3.mjs')
with io.open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)
raw = io.open(out, 'rb').read()
assert b'\r' not in raw, 'CRLFが混入した'
print(f'出力: {out}')
print(f'  語数={len(tgt)} バッチ={len(batches)}(各{BATCH}語) 予定エージェント={len(batches)}体')
print(f'  先頭: {json.dumps(batches[0][0], ensure_ascii=False)[:200]}')
