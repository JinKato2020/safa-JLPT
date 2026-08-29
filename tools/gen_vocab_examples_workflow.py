# -*- coding: utf-8 -*-
"""語彙(辞書)例文の作り直しWorkflowを生成する（例文のみ・選択肢/解説なし）。

用途: 文脈規定の問題文と類似度0.3以上＝丸写し〜強い重複の語彙例文を、別の文へ作り直す。
- データは args を使わず JS リテラルで埋め込む（args=undefined 全滅の再発防止）
- 改行は LF のみ
使い方: python tools/gen_vocab_examples_workflow.py N4     [LIMIT]
入力: scratchpad/vocab_swap2/target_{LV}.json  ({id, vocabId, word, contextPrompt, oldExample})
出力: scratchpad/vocab_swap2/wf_vocabex_{LV}.mjs
"""
import io, json, os, sys, math

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv[1:]
DIR, pos, i = 'vocab_swap2', [], 0            # DIR=入出力ディレクトリ（scratchpad配下）。N3は vocab_swap3 等
while i < len(argv):
    a = argv[i]
    if a == '--dir':
        DIR = argv[i + 1]; i += 2; continue
    if a.startswith('--'):
        i += 1; continue
    pos.append(a); i += 1
LEVEL = (pos[0] if pos else 'N4').upper()
LIMIT = int(pos[1]) if len(pos) > 1 else None

LEVEL_SPEC = {
    'N4': r'''- **分かち書きはしない**。漢字はそのまま書く（**ルビは後で機械が振るので書かない**）
- 文は概ね15〜35字。日常の場面（学校・店・家・駅・仕事）
- ていねい体でも普通体でもよいが、1文で完結させる''',
    'N5': r'''- **分かち書きする**（ひらがな中心・語の間に半角スペース）。漢字は使ってよい（**ルビは後で機械が振るので書かない**）
- 文は概ね10〜25字。日常のやさしい場面（学校・家・店・駅）
- 「〜です／〜ます／〜ました」などのていねい体を基本に、1文で完結させる''',
    'N3': r'''- **分かち書きはしない**。漢字はそのまま書く（**ルビは後で機械が振るので書かない**）
- 文は概ね20〜40字。社会寄りの場面も可（仕事・地域・公共・報道）だが、国・宗教・政治的に中立に
- 漢語名詞・複合動詞・やや抽象的な語も自然に使ってよい。普通体・ていねい体どちらでも1文で完結''',
}[LEVEL]

sel = json.load(io.open(os.path.join(ROOT, f'scratchpad/{DIR}/target_{LEVEL}.json'), encoding='utf-8'))
words = [{'id': e['id'], 'vocabId': e['vocabId'], 'word': e['word'],
          'avoidContext': e['contextPrompt'], 'avoidOld': e['oldExample']} for e in sel]
if LIMIT:
    words = words[:LIMIT]
BATCH = min(40, max(30, math.ceil(len(words) / 10)))   # 1体あたり最大40語（N3など大規模は体数が増える）

GEN_RULES = r'''あなたはJLPT ''' + LEVEL + r''' の語彙学習用「例文」を作る担当です。渡された語について、1語につき1文、その語の意味と使い方がよく分かる自然な例文を作ります。

## 作るもの
- **穴埋めではない・ふつうの例文**。空所〔　〕やダミー選択肢は作らない。解説も書かない。
- その語を**自然な形で1回**使う（活用・助詞はその文に合わせてよい）。
- 読み手がその語の意味を思い出せる、**手がかりのある文脈**にする（例:「時間を守る」ではなく「約束の時間に５分おくれて、あわてて走った」のように場面を描く）。

## 【最重要】重複を避ける
各語には避けるべき文が2つ付いている。
- `avoidContext` … その語の**文脈規定の問題文**（丸写し厳禁の相手）。
- `avoidOld` … 現行の語彙例文（これも作り直す対象）。
**どちらとも違う、別の場面・別の言い回しの文を新しく作る**。同じ題材・同じ主要語・同じ一節の使い回しは不可。読み手が「別の例だ」と分かる新しさを出す。
ただし**語義は avoid の文と同じ**にする（多義語で別の意味に流れない）。

## ''' + LEVEL + r''' の形式
''' + LEVEL_SPEC + r'''
- **個人名を使わない**。役割で書く（先生・学生・店員・客・近所の人・同僚 等）。国・宗教・政治的に中立に。
- ルビは書かない（後で機械が振る）。括弧書きの補足も付けない。

## 品質チェック（出力前に必ず）
1. その語が自然に使われているか（不自然なら文ごと作り直す）。
2. avoidContext / avoidOld と場面・言い回しが被っていないか。被っていたら作り直す。
3. 1文で完結し、''' + LEVEL + r''' の学習者が読める語彙・文法か。'''

GEN_SCHEMA = {
    'type': 'object', 'required': ['items'],
    'properties': {'items': {'type': 'array', 'items': {
        'type': 'object', 'required': ['id', 'vocabId', 'ja'],
        'properties': {
            'id': {'type': 'string'},
            'vocabId': {'type': 'string'},
            'ja': {'type': 'string', 'description': 'ルビ無し・空所無しの完成した1文'},
        }}}},
}

batches = [words[i:i + BATCH] for i in range(0, len(words), BATCH)]

js = f'''export const meta = {{
  name: 'vocabex-{LEVEL.lower()}-regen',
  description: '語彙例文{LEVEL} {len(words)}語を作り直し（例文のみ・自己検算）',
  phases: [
    {{ title: '生成', detail: '{BATCH}語×{len(batches)}体・Opus high・例文のみ' }},
  ],
}}

const GEN_RULES = {json.dumps(GEN_RULES, ensure_ascii=False)}
const GEN_SCHEMA = {json.dumps(GEN_SCHEMA, ensure_ascii=False)}
const BATCHES = {json.dumps(batches, ensure_ascii=False)}

const out = await pipeline(
  BATCHES,
  (batch, _orig, i) =>
    agent(GEN_RULES + '\\n\\n## 対象語(' + batch.length + '語)\\n' + JSON.stringify(batch),
      {{ label: 'gen:b' + (i + 1), phase: '生成', schema: GEN_SCHEMA, effort: 'high' }}),
)
const good = out.filter(Boolean).flatMap((r) => (r && Array.isArray(r.items)) ? r.items : [])
const emptyBatches = out.filter(Boolean).filter((r) => !r || !Array.isArray(r.items) || !r.items.length).length
log('生成=' + good.length + '文 / 空バッチ=' + emptyBatches)
return {{ level: '{LEVEL}', good, emptyBatches }}
'''

out = os.path.join(ROOT, f'scratchpad/{DIR}/wf_vocabex_{LEVEL}.mjs')
with io.open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)
raw = io.open(out, 'rb').read()
assert b'\r' not in raw, 'CRLFが混入した'
print(f'出力: {out}')
print(f'  語数={len(words)} バッチ={len(batches)}(各{BATCH}語) 予定エージェント={len(batches)}体')
print(f'  先頭: {json.dumps(batches[0][0], ensure_ascii=False)[:200]}')
