# -*- coding: utf-8 -*-
"""言い換えN5 文レベル作り直しの生成バッチを組み立てる。

設計: docs/superpowers/specs/2026-07-17-n5-synonym-sentence-level-design.md
方針:
- データは【エージェントのプロンプトに貼らない】。バッチファイルを書き、各生成役が自分の担当分だけ読む
  (CLAUDE.md #8: 読むだけのagent禁止・argsが巨大なら1体に束ねて自分でWrite)。
- 1語=1問(id=sy:<vocabId>)。同じ語で2問は作れないので、総数は「使えるvocabIdの数」で決まる。

出力: pilot_out/batch_<n>.json (LF・UTF-8)
使い方: python tools/build_synonym_n5_batches.py
"""
import io
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'pilot_out')


def load(p):
    d = json.load(io.open(os.path.join(ROOT, p), encoding='utf-8'))
    return d if isinstance(d, list) else (d.get('items') or list(d.values())[0])


def dump(name, obj):
    p = os.path.join(OUT, name)
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    raw = io.open(p, 'rb').read()          # ★バイナリで読む(テキストモードだと\rが見えない)
    assert b'\r' not in raw, f'{name}: CRLF混入'
    return len(obj)


os.makedirs(OUT, exist_ok=True)
syn_q = load('app/content/problems/moji_goi/synonym_N5.json')
vocab = load('app/src/data/shared/vocab.json')
furi = json.load(io.open(os.path.join(ROOT, 'app/src/data/dict/sentenceFuri.json'), encoding='utf-8'))
n5 = [v for v in vocab if v.get('level') == 'N5']
by_word = {}
for v in n5:
    by_word.setdefault(v['word'], v)
used = {e['id'][3:] for e in syn_q}

# ── A. 既存93問(文レベル化＋誤答を全部作り直す。現行の誤答は荒唐無稽なので捨てる)
existing = [{
    'id': e['id'], 'word': e['word'], 'sentence': e['sentence'],
    'underline': e['underline'], 'answer': e['answer'],
    'sentenceFuri': furi.get(e['id']),
    'task': 'rebuild',
} for e in syn_q]

# ── B. 未使用ペア(59組から手で選別=辞書は自他/品詞違い/助数詞/下位語/混線で汚染されている)
PAIRS = [
    ('言う', '話す'), ('行く', '参る'), ('多い', '沢山'), ('お母さん', '母'),
    ('奥さん', '妻'), ('お父さん', '父'), ('男', '男性'), ('お姉さん', '姉'),
    ('来る', '参る'), ('死ぬ', '亡くなる'), ('上手', 'うまい'), ('丈夫', '強い'),
    ('する', 'やる'), ('大変', 'とても'), ('使う', '利用'), ('なる', '変わる'),
    ('話す', '言う'), ('物', '品物'), ('門', '入口'),
]
pairs = []
for w, ans in PAIRS:
    v = by_word.get(w)
    if not v or v['id'] in used:
        print(f'  [skip] {w}: {"使用済" if v else "N5に無し"}')
        continue
    pairs.append({'id': f"sy:{v['id']}", 'word': w, 'reading': v.get('reading'),
                  'answer': ans, 'task': 'new_pair'})

# ── C. perspective_cross(授受8語。実測で全て空き)
JYUJU = ['貸す', '借りる', '教える', '習う', '売る', '買う', '出す', '入れる']
persp = []
for w in JYUJU:
    v = by_word.get(w)
    if not v or v['id'] in used:
        print(f'  [skip] {w}: {"使用済" if v else "N5に無し"}')
        continue
    persp.append({'id': f"sy:{v['id']}", 'word': w, 'reading': v.get('reading'),
                  'pattern': 'perspective_cross', 'task': 'new_cross'})

# ── D. negation_cross(空きのN5形容詞。対義語が明確なものだけ生成役が採用し、他は needsDrop)
ja = load('app/dict/ja-vocab.json')
pos = {}
for x in ja:
    w = x.get('word') or x.get('kanji') or x.get('expression')
    if w and w not in pos:
        p = x.get('pos') or []
        pos[w] = p if isinstance(p, list) else [p]


def is_adj(w):
    return any('adj-i' in str(t) or 'adj-na' in str(t) for t in pos.get(w, []))


neg = [{'id': f"sy:{v['id']}", 'word': v['word'], 'reading': v.get('reading'),
        'pattern': 'negation_cross', 'task': 'new_cross'}
       for v in n5 if v['id'] not in used and is_adj(v['word'])]

# ── バッチ化(30問/体・規定8「少数の大きめエージェント」)
batches = []
for i in range(0, len(existing), 24):
    batches.append(existing[i:i + 24])
batches.append(pairs + persp)
for i in range(0, len(neg), 24):       # 否定クロス候補71は3体に分ける(1体=71問は大きすぎる)
    batches.append(neg[i:i + 24])

total = 0
for i, b in enumerate(batches, 1):
    n = dump(f'batch_{i}.json', b)
    total += n
    kinds = sorted({x['task'] for x in b})
    print(f'batch_{i}.json: {n}問  {kinds}')
print(f'\n合計 {total}問 / {len(batches)}バッチ')
print(f'  既存の作り直し={len(existing)}  新ペア={len(pairs)}  '
      f'視点クロス={len(persp)}  否定クロス候補={len(neg)}(対義語が無いものは生成役がneedsDrop)')
