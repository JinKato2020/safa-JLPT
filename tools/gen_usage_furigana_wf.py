# -*- coding: utf-8 -*-
"""用法(N3)新規問題のふりがなWorkflowを生成する（ルビのみ・監査なし）。

各問の word / correct / distractors×3 を1文=1行に展開し、既存の文脈規定と同じルビ規則で
Opusにふりがなを付けさせる（MeCab下書きを校正）。改行はLFのみ。

使い方: python tools/gen_usage_furigana_wf.py
入力: scratchpad/usage_n3_300/all300.json  ({vocabId, word, correct, distractors[{sentence,repl,type}]})
出力: scratchpad/usage_n3_300/wf_usage_furi.mjs
回収後: gen_furigana は has_kanji で無漢字文を除外するので、無漢字文は元テキストを ruby として使う。
"""
import io, json, os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'data-build'))
from gen_furigana import furigana, has_kanji  # noqa: E402
DIRP = os.path.join(ROOT, 'scratchpad', 'usage_n3_300')
LEVEL = 'N3'
RUBY_BATCH = 100

allq = json.load(io.open(os.path.join(DIRP, 'all300.json'), encoding='utf-8'))
# 1文=1行に展開。id = f"{vocabId}|{slot}"  slot∈{w,a,0,1,2}
rows = []
for q in allq:
    vid = q['vocabId']
    texts = [('w', q['word']), ('a', q['correct'])]
    for i, d in enumerate(q['distractors']):
        texts.append((str(i), d['sentence']))
    for slot, t in texts:
        if has_kanji(t):
            rows.append({'id': f'{vid}|{slot}', 'prompt': t, 'draft': furigana(t)})

RUBY_RULES = r'''あなたはJLPT ''' + LEVEL + r''' の教材にふりがな（ルビ）を付ける担当です。

## やること
各文（語または例文）の漢字に `漢字（かな）` 形式でふりがなを付けます。
`draft` は**MeCabによる機械生成の下書き**です。**実測で約18%が間違っています**。必ず自分で読みを確認し、直してください。

## 書式（厳守）
- 読みは**全角の丸括弧**`（）`で、漢字の**直後**に置く
- **送りがなは括弧の外**に出す。例: `立（た）ち上（あ）がった` / `休（やす）みます` / `習（なら）った`
- 熟語は**まとまりでルビを振ってよい**。例: `日曜日（にちようび）` `集中力（しゅうちゅうりょく）` `頂上（ちょうじょう）`
- **漢字を含む語は必ずルビを付ける**（下書きが振り漏らすことがある）
- ひらがな・カタカナ・数字・記号にはルビを付けない

## 下書きの実際の間違い（必ず直す）
- `日曜（にちよう）日（ひ）` → 正しくは `日曜日（にちようび）`
- `送べつ`（ルビが全く無い） → 正しくは `送（おく）べつ`
- 熟語を不自然に割る／送りがなを括弧に巻き込む
- 多読み漢字は文脈で正しい読みに（例 `辛（つら）い`/`辛（から）い`、`治（なお）す`/`治（おさ）める`）

## 【絶対の検算】
`furi` から**括弧とその中身を全部取り除いた文字列が、`prompt` と1文字も違わず一致**しなければなりません。
文字を足しても減らしてもいけません。出力前に必ず自分で確認してください。

## 出力
各文について {"id":..., "furi": ふりがな付きの文}'''

RUBY_SCHEMA = {
    'type': 'object', 'required': ['items'],
    'properties': {'items': {'type': 'array', 'items': {
        'type': 'object', 'required': ['id', 'furi'],
        'properties': {'id': {'type': 'string'}, 'furi': {'type': 'string'}}}}},
}

rb = [rows[i:i + RUBY_BATCH] for i in range(0, len(rows), RUBY_BATCH)]

js = f'''export const meta = {{
  name: 'usage-{LEVEL.lower()}-furi',
  description: '用法{LEVEL}新規{len(allq)}問のふりがな（{len(rows)}文・ルビのみ）',
  phases: [
    {{ title: 'ルビ', detail: '{RUBY_BATCH}文×{len(rb)}体・MeCab下書きをOpusが校正' }},
  ],
}}

const RUBY_RULES = {json.dumps(RUBY_RULES, ensure_ascii=False)}
const RUBY_SCHEMA = {json.dumps(RUBY_SCHEMA, ensure_ascii=False)}
const RUBY_BATCHES = {json.dumps(rb, ensure_ascii=False)}

const ruby = await parallel(RUBY_BATCHES.map((b, i) => () =>
  agent(RUBY_RULES + '\\n\\n## 対象(' + b.length + '文)\\n' + JSON.stringify(b),
    {{ label: 'ruby:b' + (i + 1), phase: 'ルビ', schema: RUBY_SCHEMA }})))
const items = (ruby || []).filter(Boolean).flatMap((r) => (r && r.items) || [])
log('ルビ=' + items.length + '文')
return {{ level: '{LEVEL}', items }}
'''

out = os.path.join(DIRP, 'wf_usage_furi.mjs')
with io.open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)
assert b'\r' not in io.open(out, 'rb').read(), 'CRLF混入'
print(f'出力: {out}')
print(f'  問題={len(allq)} ルビ対象文={len(rows)}(無漢字は除外) バッチ={len(rb)}(各{RUBY_BATCH}文)')
