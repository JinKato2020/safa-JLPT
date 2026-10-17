# -*- coding: utf-8 -*-
"""文法問題(grammar_form/order/passage)に pointId を付与(in-place)。
   主信号=explain の「…」引用(問うている形を明示)→ 副=answer+選択肢の最長一致 → 無ければnull。
   計測(measure_grammar_tagging.py)で explain引用 gf84%/order92% を確認済。
"""
import os, json, re
from collections import Counter
ROOT = r'C:\Users\jwpsa\Documents\desktop\claude\JLPTアプリ'
D = os.path.join(ROOT, 'app', 'src', 'data')
KBP = os.path.join(D, 'knowledgeBank.json')
KB = json.load(open(KBP, encoding='utf-8'))
G = json.load(open(os.path.join(D, 'grammar.json'), encoding='utf-8'))

LV = ['N5','N4','N3','N2','N1']
def le(lv): return set(LV[:(LV.index(lv)+1 if lv in LV else len(LV))])
def strip_furi(s): return re.sub(r'（[^）]*）', '', s or '')
def variants(point):
    out = []
    for p in re.split(r'[・／/、,]', point):
        p = strip_furi(p.strip().lstrip('〜～~').strip())
        if len(p) >= 2: out.append(p)
    return out

pv = []  # (variant, level, id) 最長優先で照合
for g in G:
    for v in variants(g['point']): pv.append((v, g['level'], g['id']))

def best_in(text, cand):
    text = strip_furi(text)
    best = None
    for v, glv, gid in pv:
        if glv in cand and v in text and (best is None or len(v) > best[0]):
            best = (len(v), gid)
    return best[1] if best else None

GD = ('grammar_form','order','passage_grammar')
stat = Counter()
for x in KB:
    if x.get('daimon') not in GD: continue
    cand = le(x.get('level','N3'))
    pid = None
    for q in re.findall(r'「([^」]+)」', x.get('explain','')):   # 主: explain引用
        pid = best_in(q.lstrip('〜～~'), cand)
        if pid: break
    if not pid:                                                  # 副: answer+選択肢
        pid = best_in(x.get('answer','') + ' ' + ' '.join(x.get('choices', [])), cand)
    x['pointId'] = pid
    stat[x['daimon']] += 1 if pid else 0
    stat[x['daimon']+'_tot'] += 1

json.dump(KB, open(KBP, 'w', encoding='utf-8'), ensure_ascii=False)
for d in GD:
    t = stat[d+'_tot']; print(f'  {d}: pointId付与 {stat[d]}/{t} ({100*stat[d]//t}%)')
print('書込: knowledgeBank.json (grammar系に pointId 付与)')
