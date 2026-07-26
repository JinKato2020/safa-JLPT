# -*- coding: utf-8 -*-
"""反証の削除適用＋修理の反映を統合し、確定データを作る。

順序が重要:
 1. merged.json(生成153問) に反証2パスの【和集合】削除を適用
 2. bad_answer(正解が成立しない)は問題ごと落とす
 3. 修理済み(fixed_*.json)は choices を【丸ごと差し替え】る
    ※修理役は誤答を作り直しているので、1.の削除は適用しない(古いchoicesへの添字なので無意味)
 4. cannotFix は元のまま残す(表層の手がかりは受け入れ=ユーザー判断 2026-07-17)

★修理済みは【再反証】が要る(修理役が新しい第2の正解を作る=スキル daimon-question-build §3 実証済)。
  本スクリプトは再反証【前】の統合まで。再反証の結果は apply_reverify で反映する。

使い方: python tools/finalize_synonym_n5.py -o pilot_out/final.json
"""
import argparse
import collections
import glob
import io
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CROSS = ('negation_cross', 'perspective_cross')

ap = argparse.ArgumentParser()
ap.add_argument('-o', '--out', required=True)
a = ap.parse_args()


def load(p):
    return json.load(io.open(os.path.join(ROOT, p), encoding='utf-8'))


items = {x['id']: x for x in load('pilot_out/merged.json')}

# ── 反証2パスの結果
res = collections.defaultdict(dict)
for tag in ('A', 'B'):
    for p in sorted(glob.glob(os.path.join(ROOT, 'pilot_out', f'r{tag}_*.json'))):
        for r in json.load(io.open(p, encoding='utf-8')):
            res[r['id']][tag] = r

# ── 修理結果(choicesを丸ごと差し替え)
fixed, cannot = {}, {}
for p in sorted(glob.glob(os.path.join(ROOT, 'pilot_out', 'fixed_*.json'))):
    for x in json.load(io.open(p, encoding='utf-8')):
        if x.get('cannotFix'):
            cannot[x['id']] = x.get('reason', '')
        else:
            fixed[x['id']] = x['choices']

out, dropped, shrunk = [], [], []
for i, x in items.items():
    r = res.get(i, {})
    # (2) bad_answer は問題ごと落とす
    if any(r.get(t, {}).get('verdict') == 'bad_answer' for t in ('A', 'B')):
        why = next(r[t].get('note', '') for t in ('A', 'B') if r.get(t, {}).get('verdict') == 'bad_answer')
        dropped.append((i, x['word'], 'bad_answer=正解が成立しない', why[:70]))
        continue
    y = dict(x)
    # (3) 修理済み: choices を丸ごと差し替え(削除は適用しない=古い添字なので無意味)
    if i in fixed:
        y['choices'] = fixed[i]
        y['repaired'] = True
        out.append(y)
        continue
    # (1) 未修理: 和集合で削除
    rm = set()
    for t in ('A', 'B'):
        rm |= set(r.get(t, {}).get('validChoices') or [])
        for pr in (r.get(t, {}).get('pairIssue') or []):
            if isinstance(pr, (list, tuple)) and len(pr) == 2:
                rm.add(max(pr))          # 等価ペアの片方(添字の大きい方)を落とす=決定的
    if not rm:
        out.append(y)
        continue
    ch = [c for k, c in enumerate(x['choices']) if k not in rm]
    if x['pattern'] in CROSS and len(ch) != 3:
        dropped.append((i, x['word'], f'クロスが{len(ch)}個に割れた=軸選びの失敗', ''))
        continue
    if len(ch) < 3:
        dropped.append((i, x['word'], f'誤答が{len(ch)}個で下限3を割った', ''))
        continue
    y['choices'] = ch
    out.append(y)
    shrunk.append((i, len(x['choices']), len(ch)))

print(f'生成 {len(items)}問 → 確定 {len(out)}問')
print(f'  修理を反映 = {len(fixed)}件 / 直せず受け入れ(cannotFix) = {len(cannot)}件')
for i, why in cannot.items():
    print(f'      {i} {items[i]["word"]}: {why[:60]}')
print(f'  誤答を減らした = {len(shrunk)}件')
print(f'  ★落とした = {len(dropped)}件')
for i, w, why, note in dropped:
    print(f'      {i} {w}: {why} {note}')
print(f'\n  pattern分布: {dict(collections.Counter(x["pattern"] for x in out))}')
print(f'  誤答数分布: {dict(sorted(collections.Counter(len(x["choices"]) for x in out).items()))}')

# ── 機械検査(投入前の最終)
err = collections.defaultdict(list)
for x in out:
    if x['answer'] in x['choices']:
        err['正解がchoicesに混入'].append(x['id'])
    if len(set(x['choices'])) != len(x['choices']):
        err['誤答が重複'].append(x['id'])
    n = len(x['choices'])
    if x['pattern'] in CROSS and n != 3:
        err['クロスなのに誤答3個でない'].append(f'{x["id"]}:{n}')
    if not (3 <= n <= 5):
        err['誤答が3〜5個でない'].append(f'{x["id"]}:{n}')
    for c in x['choices']:
        if '（' in c:
            err['選択肢に全角カッコ混入'].append(x['id'])
if err:
    print('\n★機械検査で違反:')
    for k, v in err.items():
        print(f'   [{len(v)}] {k}: {v[:5]}')
else:
    print('\n機械検査: 違反なし')

out.sort(key=lambda x: int(x['id'].rsplit('-', 1)[1]))
p = os.path.join(ROOT, a.out)
with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
assert b'\r' not in io.open(p, 'rb').read()
print(f'\n書きました: {p}')

# ── 再反証にかけるのは【修理済みだけ】(安い保険)
rep = [x for x in out if x.get('repaired')]
p2 = os.path.join(ROOT, 'pilot_out/reverify.json')
with io.open(p2, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(rep, f, ensure_ascii=False, indent=1)
assert b'\r' not in io.open(p2, 'rb').read()
print(f'再反証の対象(修理済みだけ) = {len(rep)}問 → {p2}')
