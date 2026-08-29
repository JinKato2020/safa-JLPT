# -*- coding: utf-8 -*-
"""文脈規定のうち「辞書例文の丸写し(流用)」を選ぶ（機械処理・0トークン）。

辞書の例文(vocabExamplesAi.json / content/lexicon/example_*.json)と、
同じ vocabId の文脈規定 prompt を文字bigramで比較し、sim>=THRESH の問題を
作り直し対象として選ぶ。verified 状態は問わない（流用は verified 済みが多いため）。

出力: scratchpad/context_regen/select_{lv}.json
  各要素 = {id, word(=answer), oldPrompt, dictExample(避ける文), oldChoices(既存の誤答)}
使い方: python tools/select_context_reuse.py           # 既定 N5,N4 / THRESH=0.8
        python tools/select_context_reuse.py N5 N4 0.8
"""
import io, json, os, re, sys, glob
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

args = sys.argv[1:]
THRESH = 0.8
levels = []
for a in args:
    try:
        THRESH = float(a)
    except ValueError:
        levels.append(a.upper())
if not levels:
    levels = ['N5', 'N4']


def load(p):
    return json.load(io.open(os.path.join(ROOT, p), encoding='utf-8'))


def norm(s):
    if not s:
        return ''
    s = re.sub(r'[（(][^）)]*[）)]', '', s)          # ルビ括弧除去
    return re.sub(r'[　\s【】〔〕\[\]_＿…、。･・,\.！？!?]+', '', s)


def bigrams(s):
    return set(s[i:i + 2] for i in range(len(s) - 1))


def sim(a, b):
    A, B = bigrams(a), bigrams(b)
    return len(A & B) / len(A | B) if A and B else 0.0


# 辞書例文: vocabId -> [文,...]
dexpl = defaultdict(list)
for v, o in load('src/data/dict/vocabExamplesAi.json').items():
    if isinstance(o, dict) and o.get('ja'):
        dexpl[v].append(o['ja'])
for f in glob.glob(os.path.join(ROOT, 'content/lexicon/example_*.json')):
    for v, o in json.load(io.open(f, encoding='utf-8')).get('items', {}).items():
        j = o.get('ja') if isinstance(o, dict) else o
        if j:
            dexpl[v].append(j)

os.makedirs(os.path.join(ROOT, 'scratchpad/context_regen'), exist_ok=True)

for lv in levels:
    d = load(f'content/problems/moji_goi/context_{lv}.json')
    picked = []
    for x in d['items']:
        v = x.get('vocabId')
        p = x.get('prompt')
        if not p or v not in dexpl:
            continue
        best_s, best_d = 0.0, ''
        for dd in dexpl[v]:
            s = sim(norm(p), norm(dd))
            if s > best_s:
                best_s, best_d = s, dd
        if best_s >= THRESH:
            picked.append({
                'id': x['id'],
                'word': x.get('answer', ''),
                'oldPrompt': p,
                'dictExample': best_d,
                'oldChoices': x.get('choices', []),
                'sim': round(best_s, 3),
            })
    out = os.path.join(ROOT, f'scratchpad/context_regen/select_{lv}.json')
    with io.open(out, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(picked, f, ensure_ascii=False, indent=1)
    print(f'=== {lv} ===  流用(sim>={THRESH}) = {len(picked)}問  出力: {out}')
    print(f'  例(先頭8語): {[e["word"] for e in picked[:8]]}')
