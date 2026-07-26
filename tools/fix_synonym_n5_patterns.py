# -*- coding: utf-8 -*-
"""生成物の pattern を実データに合わせて振り直す＋両親をhypernym化する。

背景(2026-07-17 実走行):
- SynonymPattern を noun/adj/verb/hypernym/*_cross の閉じた型で定義したが、
  実データの24問中7問が【副詞・疑問詞】(ちょうど/ちょっと/どう/どうして/時々/とても/なぜ/もう/そして)。
  adv が無いため生成役3体が別々に adj や noun へ寄せた。→ adv を足して機械で振り直す。
- 両親は RECIPE の「rebuildはanswerそのまま」に従い noun(両親→親)になったが、
  公式の型「上位語の分解(両親→父と母)」が全体で0件になった。パイロット版(反証2パス通過済)へ差し替える。

使い方: python tools/fix_synonym_n5_patterns.py [--dry]
"""
import argparse
import glob
import io
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ap = argparse.ArgumentParser()
ap.add_argument('--dry', action='store_true')
a = ap.parse_args()


def load(p):
    d = json.load(io.open(p, encoding='utf-8'))
    return d if isinstance(d, list) else (d.get('items') or list(d.values())[0])


# ── 品詞(pos)の索引。adv 判定に使う
pos = {}
for x in load(os.path.join(ROOT, 'app/dict/ja-vocab.json')):
    w = x.get('word') or x.get('kanji') or x.get('expression')
    if w and w not in pos:
        p = x.get('pos') or []
        pos[w] = [str(t) for t in (p if isinstance(p, list) else [p])]


def is_adv(w):
    """★【主品詞＝先頭のタグ】で判定する。

    このposデータは主品詞を先頭に置く:
        朝   ['n', 'adv']            主=名詞。副詞的用法があるだけ(今朝行く)で品詞は名詞
        少し ['adv']                 純粋な副詞
        大変 ['adv', 'adj-na', 'n']  主=副詞
    `'adv' in タグ列` で見ると 朝・午前・昼・夜・晩・所・近く・全部・大勢 まで副詞になる(実際に踏んだ)。
    """
    t = pos.get(w) or []
    return bool(t) and t[0] in ('adv', 'adv-to', 'conj', 'adj-pn')


# 疑問詞は int(感動詞)/pn(代名詞)/None になり主品詞判定に漏れるため明示する
INTERROG = {'いかが', 'どう', 'どうして', 'なぜ', 'どちら', 'どれ', 'いつ', 'どこ', 'なに', '何'}

# ── 両親: パイロット版(反証2パス通過済)へ差し替え
pilot = {x['id']: x for x in load(os.path.join(ROOT, 'pilot_out/pilot16.json'))}
RYOUSHIN = 'sy:n5-v-700'

changed_adv, changed_hyp = [], []
for p in sorted(glob.glob(os.path.join(ROOT, 'pilot_out', 'gen_*.json'))):
    d = json.load(io.open(p, encoding='utf-8'))
    dirty = False
    for i, x in enumerate(d):
        if x.get('needsDrop'):
            continue
        # (1) 両親 → hypernym(パイロット版)
        if x['id'] == RYOUSHIN and x.get('pattern') != 'hypernym':
            src = pilot.get(RYOUSHIN)
            if src:
                keep = {k: src[k] for k in src if k != 'needsDrop'}
                d[i] = keep
                changed_hyp.append(f"{x['id']} {x['word']}: {x['pattern']}(両親→{x['answer'][-12:]}) → hypernym(両親→父と母)")
                dirty = True
                continue
        # (2) 副詞・疑問詞 → adv
        w = x.get('word') or ''
        if x.get('pattern') in ('noun', 'adj') and (is_adv(w) or w in INTERROG):
            changed_adv.append(f"{x['id']} {w}: {x['pattern']} → adv")
            x['pattern'] = 'adv'
            dirty = True
    if dirty and not a.dry:
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
        assert b'\r' not in io.open(p, 'rb').read()

print(f'★ adv へ振り直し: {len(changed_adv)}件')
for s in changed_adv:
    print(f'   {s}')
print(f'\n★ hypernym へ差し替え: {len(changed_hyp)}件')
for s in changed_hyp:
    print(f'   {s}')
if a.dry:
    print('\n(--dry: 書いていません)')
